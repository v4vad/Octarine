import type { ColorMethod, ColorStop, GeneratedStop, PaletteResult, Stop, Color, GlobalSettings, ChromaCurve, HueShiftCurve } from "./types"
import { CHROMA_CURVE_PRESETS, HUE_SHIFT_CURVE_PRESETS } from "./types"
import { oklch, rgb, formatHex } from "culori"
import { clampChromaToGamut, getMaxChroma } from "./gamut-table"

export interface OKLCH {
  l: number
  c: number
  h: number
}

// Convert hex to OKLCH using culori (accurate)
export function hexToOklch(hex: string): OKLCH {
  const color = oklch(hex)
  if (!color) {
    return { l: 0.5, c: 0.1, h: 0 }
  }
  return {
    l: color.l ?? 0,
    c: color.c ?? 0,
    h: color.h ?? 0,
  }
}

// Convert OKLCH to hex using culori (accurate)
export function oklchToHex(color: OKLCH): string {
  const result = formatHex({
    mode: "oklch",
    l: color.l,
    c: color.c,
    h: color.h,
  })
  return result || "#000000"
}

// Convert OKLCH to CSS oklch() string
export function oklchToCss(color: OKLCH): string {
  return `oklch(${(color.l * 100).toFixed(1)}% ${color.c.toFixed(3)} ${color.h.toFixed(1)})`
}

export function parseOklch(color: string): OKLCH {
  if (color.startsWith("#")) {
    return hexToOklch(color)
  }
  // Try parsing as any color format
  const parsed = oklch(color)
  if (parsed) {
    return {
      l: parsed.l ?? 0,
      c: parsed.c ?? 0,
      h: parsed.h ?? 0,
    }
  }
  return { l: 0.5, c: 0.1, h: 0 }
}

// ============================================
// SMART MINIMUM CHROMA (Preserve Color Identity)
// ============================================

/**
 * Get smart minimum chroma for a hue to preserve color identity.
 *
 * Different hues have different gamut limits at high lightness:
 * - Blues (200-280°): Tightest gamut - need higher minimum chroma
 * - Cyans/Magentas: Medium gamut
 * - Reds/Greens: Moderate gamut
 * - Yellows (40-80°): Most generous gamut at high L - need less minimum
 *
 * @param hue - Hue angle in degrees (0-360)
 * @returns Minimum chroma to preserve color identity
 */
export function getMinChromaForHue(hue: number): number {
  hue = ((hue % 360) + 360) % 360

  // Blues (200-280): Need higher min chroma (gamut is tightest at high L)
  if (hue >= 200 && hue < 280) return 0.025

  // Cyans (160-200) and Magentas (280-340): Medium
  if ((hue >= 160 && hue < 200) || (hue >= 280 && hue < 340)) return 0.02

  // Reds (340-360, 0-40) and Greens (80-160): Lower
  if (hue >= 80 && hue < 160) return 0.015
  if (hue >= 340 || hue < 40) return 0.015

  // Yellows/Oranges (40-80): Lowest (generous gamut at high L)
  return 0.012
}

/**
 * Find maximum lightness that still allows minimum chroma for this hue.
 *
 * Uses binary search against the gamut table to find the highest lightness
 * where getMaxChroma(L, hue) >= minChroma.
 *
 * @param hue - Hue angle in degrees (0-360)
 * @param minChroma - Minimum chroma required
 * @returns Maximum lightness that can achieve the minimum chroma
 */
export function getMaxLightnessForMinChroma(
  hue: number,
  minChroma: number
): number {
  // Binary search for the highest L where getMaxChroma(L, hue) >= minChroma
  let low = 0.5
  let high = 1.0

  for (let i = 0; i < 15; i++) {
    const mid = (low + high) / 2
    const maxC = getMaxChroma(mid, hue)

    if (maxC >= minChroma) {
      low = mid  // Can go lighter
    } else {
      high = mid  // Need to go darker
    }
  }

  return low
}

// Calculate relative luminance for WCAG contrast
function getRelativeLuminance(hex: string): number {
  const color = rgb(hex)
  if (!color) return 0

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  const r = toLinear(color.r ?? 0)
  const g = toLinear(color.g ?? 0)
  const b = toLinear(color.b ?? 0)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Calculate WCAG contrast ratio between two colors
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1)
  const lum2 = getRelativeLuminance(color2)

  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

// Find lightness that achieves target contrast against background
export function findLightnessForContrast(
  baseColor: OKLCH,
  background: string,
  targetContrast: number
): number {
  const bgOklch = hexToOklch(background)

  // Binary search for the right lightness
  let low = 0
  let high = 1
  let bestL = 0.5
  let bestDiff = Infinity

  // Determine if we need to go lighter or darker than background
  const goLighter = bgOklch.l < 0.5

  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2
    const testColor = oklchToHex({ l: mid, c: baseColor.c, h: baseColor.h })
    const contrast = getContrastRatio(testColor, background)
    const diff = Math.abs(contrast - targetContrast)

    if (diff < bestDiff) {
      bestDiff = diff
      bestL = mid
    }

    if (Math.abs(contrast - targetContrast) < 0.01) {
      return mid
    }

    // Adjust search direction based on whether we need more or less contrast
    if (goLighter) {
      // Light colors on dark background: higher L = more contrast
      if (contrast < targetContrast) {
        low = mid
      } else {
        high = mid
      }
    } else {
      // Dark colors on light background: lower L = more contrast
      if (contrast < targetContrast) {
        high = mid
      } else {
        low = mid
      }
    }
  }

  return bestL
}

/**
 * Refine Contrast to Target
 *
 * After color transformations (chroma reduction, hue shift, etc.), the actual
 * contrast may differ from the target. This function iteratively adjusts
 * lightness until the actual contrast matches the target.
 *
 * This fixes the issue where saturated colors (like orange) end up with wrong
 * contrast because chroma reduction changes their luminance.
 *
 * @param color - The color after all transformations
 * @param targetContrast - The desired contrast ratio
 * @param backgroundColor - Background color for contrast calculation
 * @param tolerance - How close to target is acceptable (default 0.005 for WCAG compliance)
 * @returns Color with adjusted lightness to achieve target contrast
 */
export function refineContrastToTarget(
  color: OKLCH,
  targetContrast: number,
  backgroundColor: string,
  tolerance: number = 0.005
): OKLCH {
  const bgL = hexToOklch(backgroundColor).l
  const isLightBg = bgL > 0.5

  // Store original chroma - we'll use this as the base for recalculating
  // chroma at each new lightness level
  const originalChroma = color.c

  let currentColor = { ...color }

  for (let i = 0; i < 20; i++) {
    const currentHex = oklchToHex(currentColor)
    const currentContrast = getContrastRatio(currentHex, backgroundColor)
    const error = currentContrast - targetContrast

    // Within tolerance? Done!
    if (Math.abs(error) <= tolerance) break

    // Adjust lightness based on error
    // Light bg: decrease L = more contrast, increase L = less contrast
    // Dark bg: increase L = more contrast, decrease L = less contrast
    //
    // If error > 0: contrast too high, need less contrast
    // If error < 0: contrast too low, need more contrast
    //
    // Use proportional adjustment that decreases as we get closer
    const adjustmentMagnitude = Math.min(Math.abs(error) * 0.15, 0.05)

    let direction: number
    if (error > 0) {
      // Contrast too high - move TOWARD background
      direction = isLightBg ? 1 : -1  // lighter on light bg, darker on dark bg
    } else {
      // Contrast too low - move AWAY from background
      direction = isLightBg ? -1 : 1  // darker on light bg, lighter on dark bg
    }

    const newL = Math.max(0, Math.min(1, currentColor.l + direction * adjustmentMagnitude))

    // KEY FIX: Also adjust chroma to stay in gamut
    // Use the gamut lookup table to find actual max chroma for this hue/lightness
    const newC = clampChromaToGamut(originalChroma, newL, currentColor.h)

    currentColor = {
      l: newL,
      c: newC,
      h: currentColor.h
    }
  }

  return currentColor
}

// Generate color for a specific stop
export function generateColor(
  baseColor: string,
  stop: string,
  stopData: ColorStop | undefined,
  globalMode: ColorMethod,
  globalLightness?: Record<string, number>,
  globalContrast?: Record<string, number>,
  backgroundColor?: string,
  perceptualCorrections?: PerceptualCorrectionOptions,
  hueShiftCurve?: HueShiftCurve,
  chromaCurve?: ChromaCurve
): string {
  const bgOklch = backgroundColor ? hexToOklch(backgroundColor) : { l: 1, c: 0, h: 0 }

  // If there's a manual override, optionally apply corrections
  if (stopData?.manualOverride) {
    if (stopData.applyCorrectionsToManual && perceptualCorrections &&
        (perceptualCorrections.hkCompensation || perceptualCorrections.bbCorrection)) {
      // Apply perceptual corrections to the manually overridden color
      const corrected = applyPerceptualCorrections(stopData.manualOverride, bgOklch, perceptualCorrections)
      return oklchToHex(corrected)
    }
    // No corrections - use manual override directly
    return oklchToHex(stopData.manualOverride)
  }

  const baseOklch = hexToOklch(baseColor)

  // Determine effective method for this stop
  const effectiveMethod = stopData?.methodOverride === "global" || !stopData?.methodOverride
    ? globalMode
    : stopData.methodOverride

  let targetL: number

  if (effectiveMethod === "contrast" && backgroundColor) {
    // Contrast method: find lightness that achieves target contrast
    const targetContrast = stopData?.contrast ?? globalContrast?.[stop] ?? 4.5
    targetL = findLightnessForContrast(baseOklch, backgroundColor, targetContrast)
  } else {
    // Lightness method: use target lightness directly
    if (stopData?.lightness !== undefined) {
      targetL = stopData.lightness
    } else if (globalLightness && globalLightness[stop] !== undefined) {
      targetL = globalLightness[stop]
    } else {
      // Default fallback based on stop number
      const stopNum = Number.parseInt(stop)
      targetL = stopNum <= 500 ? 0.95 - (stopNum / 500) * 0.45 : 0.5 - ((stopNum - 500) / 450) * 0.45
    }
  }

  // Apply chroma reduction to stay in gamut using lookup table
  const targetC = clampChromaToGamut(baseOklch.c, targetL, baseOklch.h)

  let result: OKLCH = {
    l: targetL,
    c: targetC,
    h: baseOklch.h,
  }

  // Apply hue shift if specified (artistic hue variation across stops)
  if (hueShiftCurve && hueShiftCurve.preset !== "none") {
    const hueShiftValues = getHueShiftValues(hueShiftCurve)
    result = applyHueShift(result, targetL, hueShiftValues, hueShiftCurve.preset === "vivid")
  }

  // Apply chroma curve if specified (artistic saturation distribution)
  if (chromaCurve && chromaCurve.preset !== "flat") {
    result = applyChromaCurve(result, targetL, chromaCurve)
  }

  // Apply perceptual corrections if enabled
  if (perceptualCorrections && (perceptualCorrections.hkCompensation || perceptualCorrections.bbCorrection)) {
    result = applyPerceptualCorrections(result, bgOklch, perceptualCorrections)
  }

  return oklchToHex(result)
}

export function shouldUseLightText(backgroundColor: string): boolean {
  const luminance = getRelativeLuminance(backgroundColor)
  return luminance < 0.4
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const color = rgb(hex)
  return {
    r: Math.round((color?.r ?? 0) * 255),
    g: Math.round((color?.g ?? 0) * 255),
    b: Math.round((color?.b ?? 0) * 255),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const result = formatHex({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 })
  return result || "#000000"
}

export function rgbToHsb(r: number, g: number, b: number): { h: number; s: number; b: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6
    } else {
      h = ((r - g) / delta + 4) / 6
    }
  }

  const s = max === 0 ? 0 : delta / max
  const brightness = max

  return { h: h * 360, s: s * 100, b: brightness * 100 }
}

export function hsbToRgb(h: number, s: number, b: number): { r: number; g: number; b: number } {
  h /= 360
  s /= 100
  b /= 100

  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = b * (1 - s)
  const q = b * (1 - f * s)
  const t = b * (1 - (1 - f) * s)

  let r = 0,
    g = 0,
    bl = 0

  switch (i % 6) {
    case 0:
      ;(r = b), (g = t), (bl = p)
      break
    case 1:
      ;(r = q), (g = b), (bl = p)
      break
    case 2:
      ;(r = p), (g = b), (bl = t)
      break
    case 3:
      ;(r = p), (g = q), (bl = b)
      break
    case 4:
      ;(r = t), (g = p), (bl = b)
      break
    case 5:
      ;(r = b), (g = p), (bl = q)
      break
  }

  return { r: r * 255, g: g * 255, b: bl * 255 }
}

export function rgbToOklch(r: number, g: number, b: number): OKLCH {
  return hexToOklch(rgbToHex(r, g, b))
}

export function oklchToRgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  const hex = oklchToHex({ l, c, h })
  return hexToRgb(hex)
}

// ============================================
// PERCEPTUAL CORRECTIONS (Phase 5)
// ============================================

/**
 * Helmholtz-Kohlrausch Effect Compensation
 *
 * Problem: Saturated (high chroma) colors appear brighter than their
 * measured luminance suggests. This can make contrast calculations inaccurate.
 *
 * Solution: Adjust lightness based on chroma - higher chroma means we
 * reduce lightness slightly to compensate for perceived brightness increase.
 *
 * The effect is strongest for blue-magenta hues and weakest for yellow.
 * It's also lightness-aware: the effect peaks at mid-lightness where
 * human perception is most sensitive, and reduces at extremes.
 */
export function getHKCompensation(chroma: number, hue: number, lightness: number = 0.5): number {
  // Skip correction for near-gray colors (no perceptual HK effect)
  if (chroma < 0.01) return 0

  // Effect magnitude varies by hue (peak at blue ~270°, minimum at yellow ~90°)
  // Using cosine wave centered on blue (270°) so effect is strongest there
  const hueFactor = 0.5 + 0.5 * Math.cos((hue - 270) * Math.PI / 180) // 1 at blue, 0 at yellow

  // Effect increases with chroma (saturation)
  const chromaFactor = Math.min(chroma / 0.2, 1) // Normalize to typical chroma range

  // Lightness-aware scaling: peak at mid-lightness (0.5), reduce at extremes
  // Uses sine curve: sin(π * L) gives 0 at L=0, 1 at L=0.5, 0 at L=1
  const lightnessFactor = Math.sin(Math.PI * lightness)

  // Maximum compensation ~0.05 L units for highly saturated blue at mid-lightness
  return 0.05 * chromaFactor * hueFactor * lightnessFactor
}

export function applyHKCompensation(color: OKLCH, isLightBackground: boolean): OKLCH {
  const compensation = getHKCompensation(color.c, color.h, color.l)

  // On light backgrounds (dark text), reduce lightness since color appears brighter
  // On dark backgrounds (light text), increase lightness
  const adjustedL = isLightBackground
    ? color.l - compensation
    : color.l + compensation

  return { ...color, l: Math.max(0, Math.min(1, adjustedL)) }
}

/**
 * Get the maximum BB shift for a given hue based on perceptual research.
 * Blues and magentas experience stronger BB effects, while reds and greens
 * are more stable.
 */
function getMaxBBShiftForHue(hue: number): number {
  // Normalize hue to 0-360
  hue = ((hue % 360) + 360) % 360

  // Hue regions and their max shifts (based on perceptual research):
  // - Blues (200-280): 12-15° - strongest effect
  // - Magentas (280-340): 10-12° - strong effect
  // - Cyans (160-200): 8-10° - moderate effect
  // - Yellows (40-80): 6-8° - moderate effect (near unique yellow ~90°)
  // - Reds (340-360, 0-40): 5-7° - weaker (near unique red ~0°)
  // - Greens (80-160): 5-7° - weaker (near unique green ~140°)

  // Use smooth interpolation between regions
  if (hue >= 200 && hue < 280) {
    // Blues: strongest effect (12-15°)
    const t = (hue - 200) / 80 // 0 at 200, 1 at 280
    return 12 + 3 * Math.sin(t * Math.PI) // Peak at 240°
  } else if (hue >= 280 && hue < 340) {
    // Magentas: strong effect (10-12°)
    return 10 + 2 * Math.sin(((hue - 280) / 60) * Math.PI)
  } else if (hue >= 160 && hue < 200) {
    // Cyans: moderate (8-10°)
    return 8 + 2 * Math.sin(((hue - 160) / 40) * Math.PI)
  } else if (hue >= 40 && hue < 80) {
    // Yellows: moderate (6-8°)
    return 6 + 2 * Math.sin(((hue - 40) / 40) * Math.PI)
  } else if (hue >= 80 && hue < 160) {
    // Greens: weaker (5-7°)
    return 5 + 2 * Math.sin(((hue - 80) / 80) * Math.PI)
  } else {
    // Reds (340-360, 0-40): weaker (5-7°)
    // Normalize to continuous range
    const normalizedHue = hue >= 340 ? hue - 360 : hue // -20 to 40
    const t = (normalizedHue + 20) / 60 // 0 at -20 (340°), 1 at 40
    return 5 + 2 * Math.sin(t * Math.PI)
  }
}

/**
 * Bezold-Brücke Shift Correction
 *
 * Problem: Perceived hue shifts as lightness changes. Most hues shift
 * toward yellow at high lightness and toward blue at low lightness.
 * A "constant hue" palette doesn't actually look constant.
 *
 * Solution: Counter-rotate the hue as lightness deviates from mid-range
 * to maintain perceived hue constancy.
 *
 * Unique hues (red, yellow, green, blue) are stable reference points.
 * The correction magnitude now varies by hue region based on perceptual research.
 */
export function getBBShiftCorrection(baseHue: number, lightness: number, chroma: number = 0.1): number {
  // Skip correction for near-gray colors (no perceptual BB effect)
  if (chroma < 0.01) return 0

  // No correction needed at mid-lightness
  const midPoint = 0.5
  const deviation = lightness - midPoint

  if (Math.abs(deviation) < 0.1) return 0 // Dead zone around middle

  // Calculate angular distance accounting for wraparound
  const angularDistance = (from: number, to: number): number => {
    let diff = to - from
    if (diff > 180) diff -= 360
    if (diff < -180) diff += 360
    return diff
  }

  // Bezold-Brücke effect:
  // - High lightness: hues appear to shift toward yellow (90°) or blue (270°)
  // - Low lightness: hues appear to shift toward red (0°) or green (140°)
  // We correct by shifting AWAY from the attractor

  let attractor: number
  if (deviation > 0) {
    // High lightness: find whether yellow or blue is closer
    const distToYellow = Math.abs(angularDistance(baseHue, 90))
    const distToBlue = Math.abs(angularDistance(baseHue, 270))
    attractor = distToYellow < distToBlue ? 90 : 270
  } else {
    // Low lightness: find whether red or green is closer
    const distToRed = Math.abs(angularDistance(baseHue, 0))
    const distToGreen = Math.abs(angularDistance(baseHue, 140))
    attractor = distToRed < distToGreen ? 0 : 140
  }

  // Get hue-specific maximum shift amount
  const maxShift = getMaxBBShiftForHue(baseHue)

  // Calculate shift magnitude scaled by lightness deviation
  // Use power curve for smoother transition
  const shiftMagnitude = maxShift * Math.pow(Math.abs(deviation) * 2, 1.5)

  // Shift AWAY from the attractor to counteract perceived shift
  const toAttractor = angularDistance(baseHue, attractor)
  const shiftDirection = toAttractor > 0 ? -1 : 1

  return shiftDirection * shiftMagnitude
}

export function applyBBCorrection(color: OKLCH): OKLCH {
  const hueCorrection = getBBShiftCorrection(color.h, color.l, color.c)
  const correctedHue = (color.h + hueCorrection + 360) % 360

  return { ...color, h: correctedHue }
}

// ============================================
// HUE SHIFT (Artistic hue variation across stops)
// ============================================

/**
 * Get Hue Shift Values from Curve Configuration
 *
 * Extracts the light and dark shift amounts from a HueShiftCurve,
 * handling both presets and custom configurations.
 *
 * @param curve - The hue shift curve configuration
 * @returns Object with light and dark shift amounts in degrees
 */
export function getHueShiftValues(curve: HueShiftCurve | undefined): { light: number; dark: number } {
  if (!curve || curve.preset === "none") {
    return { light: 0, dark: 0 }
  }

  if (curve.preset === "custom") {
    return {
      light: curve.lightShift ?? 0,
      dark: curve.darkShift ?? 0
    }
  }

  return HUE_SHIFT_CURVE_PRESETS[curve.preset]
}

/**
 * Intentional Hue Shift Across Lightness (Curve-Based)
 *
 * Unlike Bezold-Brücke correction (which counteracts unwanted perceptual shifts),
 * this is an artistic feature that intentionally varies hue across lightness levels.
 *
 * The curve-based approach allows asymmetric shifts - for example, darks can shift
 * more than lights, matching what professional color palettes do.
 *
 * Example: A blue palette can shift toward cyan in light stops and toward purple in dark stops.
 *
 * Special handling for yellows in Vivid mode:
 * Yellow (hue ~90°) has a unique problem: the standard light shift (+12°) pushes it
 * toward green (102°), making it look olive/muddy. Instead of using the standard
 * light/dark region logic, yellows get a continuous shift toward orange at ALL
 * lightness levels, with the shift increasing as the color gets darker.
 *
 * @param color - The color to shift
 * @param targetL - The target lightness (0-1)
 * @param curve - Object with light (shift for L>0.5) and dark (shift for L<0.5) amounts in degrees
 * @param yellowAware - If true (Vivid preset), apply special yellow handling
 * @returns Color with hue shifted based on lightness region
 */
export function applyHueShift(
  color: OKLCH,
  targetL: number,
  curve: { light: number; dark: number },
  yellowAware: boolean = false
): OKLCH {
  // Skip hue shift for near-neutral colors (prevents grey tinting)
  if (color.c < 0.02) return color

  if (curve.light === 0 && curve.dark === 0) return color

  let hueOffset = 0

  // Check if this is a yellow hue (70-110°)
  const normalizedHue = ((color.h % 360) + 360) % 360
  const isYellow = normalizedHue >= 70 && normalizedHue <= 110

  if (yellowAware && isYellow) {
    // For yellows in Vivid mode: continuous shift toward orange
    // Shift increases as color gets darker (more orange in shadows)
    // yellowFactor: 1.0 at pure yellow (90°), tapering to 0 at zone edges (70°, 110°)
    const yellowFactor = 1 - Math.abs(normalizedHue - 90) / 20
    const maxShift = -45  // Maximum shift toward orange at L=0
    hueOffset = maxShift * (1 - targetL) * yellowFactor
  } else {
    // Standard light/dark region logic for non-yellows
    // - Light (L > 0.5): use light shift, scaled by how far from midpoint
    // - Mid (L = 0.5): no shift
    // - Dark (L < 0.5): use dark shift, scaled by how far from midpoint
    if (targetL > 0.5) {
      // Light region: interpolate from 0 at mid to full shift at extremes
      const t = (targetL - 0.5) / 0.5  // 0 at L=0.5, 1 at L=1.0
      hueOffset = curve.light * t
    } else {
      // Dark region: interpolate from 0 at mid to full shift at extremes
      const t = (0.5 - targetL) / 0.5  // 0 at L=0.5, 1 at L=0
      hueOffset = curve.dark * t
    }
  }

  const newHue = (color.h + hueOffset + 360) % 360
  return { ...color, h: newHue }
}

// ============================================
// CHROMA CURVES (Saturation distribution across lightness)
// ============================================

/**
 * Smooth step function for interpolation
 * Creates smooth transitions between control points
 */
function smoothStep(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Interpolate chroma curve based on lightness
 *
 * Uses three control points (light, mid, dark) to create a smooth
 * curve that defines chroma percentage at each lightness level.
 *
 * @param L - Target lightness (0-1)
 * @param lightPct - Chroma percentage at light end (0-100)
 * @param midPct - Chroma percentage at mid-range (0-100)
 * @param darkPct - Chroma percentage at dark end (0-100)
 * @returns Chroma multiplier percentage (0-100)
 */
function interpolateChromaCurve(
  L: number,
  lightPct: number,
  midPct: number,
  darkPct: number
): number {
  // Define lightness positions for control points
  const LIGHT_L = 0.85  // Light end (stops 50-200)
  const MID_L = 0.50    // Mid-range (stops 400-600)
  const DARK_L = 0.15   // Dark end (stops 800-950)

  if (L >= MID_L) {
    // Interpolate between mid and light
    const t = Math.max(0, Math.min(1, (L - MID_L) / (LIGHT_L - MID_L)))
    return midPct + (lightPct - midPct) * smoothStep(t)
  } else {
    // Interpolate between dark and mid
    const t = Math.max(0, Math.min(1, (L - DARK_L) / (MID_L - DARK_L)))
    return darkPct + (midPct - darkPct) * smoothStep(t)
  }
}

/**
 * Apply Chroma Curve to a Color
 *
 * Adjusts chroma based on lightness using a curve defined by three
 * control points (light, mid, dark). This enables professional-looking
 * palettes with bell-shaped saturation distributions.
 *
 * @param color - The OKLCH color to modify
 * @param lightness - The target lightness level (0-1)
 * @param curve - The chroma curve configuration
 * @returns Color with adjusted chroma
 */
export function applyChromaCurve(
  color: OKLCH,
  lightness: number,
  curve: ChromaCurve
): OKLCH {
  // If chroma is 0 (grey), no adjustment needed
  if (color.c === 0) return color

  // Get control points from preset or custom values
  let lightPct: number, midPct: number, darkPct: number

  if (curve.preset === "custom") {
    lightPct = curve.lightChroma ?? 100
    midPct = curve.midChroma ?? 100
    darkPct = curve.darkChroma ?? 100
  } else {
    const preset = CHROMA_CURVE_PRESETS[curve.preset]
    lightPct = preset.light
    midPct = preset.mid
    darkPct = preset.dark
  }

  // Get chroma multiplier for this lightness level
  const multiplier = interpolateChromaCurve(lightness, lightPct, midPct, darkPct)

  // Apply multiplier to chroma
  return { ...color, c: color.c * (multiplier / 100) }
}

/**
 * Combined Perceptual Correction Pipeline
 *
 * Applies all perceptual corrections in the right order:
 * 1. Chroma reduction for gamut mapping (already in generateColor)
 * 2. Bezold-Brücke hue correction for perceived hue constancy
 * 3. Helmholtz-Kohlrausch compensation for saturated colors
 */
export interface PerceptualCorrectionOptions {
  hkCompensation?: boolean  // Helmholtz-Kohlrausch
  bbCorrection?: boolean    // Bezold-Brücke
}

export function applyPerceptualCorrections(
  color: OKLCH,
  backgroundColor: OKLCH,
  options: PerceptualCorrectionOptions = {}
): OKLCH {
  let result = { ...color }

  // Apply Bezold-Brücke hue correction to maintain perceived constant hue
  // Only apply when explicitly enabled (true), not when undefined
  if (options.bbCorrection === true) {
    result = applyBBCorrection(result)
  }

  // Apply Helmholtz-Kohlrausch compensation for saturated colors
  // Only apply when explicitly enabled (true), not when undefined
  if (options.hkCompensation === true) {
    const isLightBg = backgroundColor.l > 0.5
    result = applyHKCompensation(result, isLightBg)
  }

  return result
}

// ============================================
// COLOR DISTINCTNESS (Delta-E)
// ============================================

/**
 * Calculate Delta-E (color difference) in OKLCH space
 *
 * Uses a simplified perceptual distance formula for OKLCH:
 * - Lightness difference is weighted heavily (most noticeable)
 * - Chroma difference is secondary
 * - Hue difference is computed accounting for circular nature
 *
 * A Delta-E < 5 means colors are very similar and may look identical
 * to the human eye, even if hex codes differ.
 *
 * @param color1 - First OKLCH color
 * @param color2 - Second OKLCH color
 * @returns Delta-E value (0 = identical, higher = more different)
 */
export function calculateDeltaE(color1: OKLCH, color2: OKLCH): number {
  // Lightness difference (scale 0-1 to roughly 0-100 for traditional Delta-E scale)
  const deltaL = (color1.l - color2.l) * 100

  // Chroma difference (scale to similar range)
  const deltaC = (color1.c - color2.c) * 100

  // Hue difference - account for circular nature
  let deltaH = color1.h - color2.h
  if (deltaH > 180) deltaH -= 360
  if (deltaH < -180) deltaH += 360

  // Weight hue difference by average chroma (hue matters less for desaturated colors)
  const avgChroma = (color1.c + color2.c) / 2
  const chromaWeight = Math.min(avgChroma / 0.15, 1) // Full weight at c >= 0.15
  const weightedDeltaH = deltaH * chromaWeight * 0.5 // Scale hue contribution

  // Euclidean distance in weighted OKLCH space
  return Math.sqrt(deltaL * deltaL + deltaC * deltaC + weightedDeltaH * weightedDeltaH)
}

/**
 * Threshold for "too similar" colors
 * Colors with Delta-E < 5 may look identical to human eyes
 */
export const DELTA_E_THRESHOLD = 5

// ============================================
// FINAL GAMUT VALIDATION
// ============================================

/**
 * Validate and Clamp Color to sRGB Gamut
 *
 * After all transformations (hue shift, chroma shift, perceptual corrections),
 * colors may end up outside the displayable sRGB gamut. This function ensures
 * the final color is valid by re-clamping chroma if needed.
 *
 * @param color - The OKLCH color to validate
 * @returns Color with chroma clamped to stay in gamut
 */
export function validateAndClampToGamut(color: OKLCH): OKLCH {
  const maxChroma = clampChromaToGamut(color.c, color.l, color.h)

  // If current chroma exceeds the maximum for this lightness/hue, clamp it
  if (color.c > maxChroma) {
    return { ...color, c: maxChroma }
  }

  return color
}

// ============================================
// DUPLICATE COLOR DETECTION & NUDGING (Phase 8)
// ============================================

/**
 * Minimum lightness nudge step (approximately 1 hex level)
 * In hex, each channel has 256 levels. In OKLCH, lightness range is 0-1,
 * so 1/256 ≈ 0.004 is roughly one step.
 */
const MIN_LIGHTNESS_NUDGE = 0.004

/**
 * Minimum chroma nudge step
 */
const MIN_CHROMA_NUDGE = 0.002

/**
 * Minimum hue nudge step (in degrees)
 * Small hue shifts create different hex values with minimal contrast impact
 */
const MIN_HUE_NUDGE = 1

/**
 * Ensure Unique Hex Colors (Multi-Dimensional, Contrast-Aware)
 *
 * Detects duplicate hex colors in a palette and nudges them apart using
 * hue, chroma, and lightness adjustments - in that priority order to
 * minimize contrast deviation from targets.
 *
 * Strategy:
 * 1. Identify which stops have the same hex color
 * 2. For duplicates, try nudging in this order:
 *    a. Hue (minimal contrast impact)
 *    b. Chroma (small contrast impact)
 *    c. Lightness (most contrast impact, but direction-aware)
 * 3. When using lightness, nudge TOWARD target contrast, not away from it
 *
 * @param stops - Array of generated stops with OKLCH values
 * @param baseChroma - The original chroma of the base color
 * @param backgroundColor - Background color for contrast calculations
 * @returns Updated stops with wasNudged and nudgeAmount populated
 */
export function ensureUniqueHexColors(
  stops: Array<{
    stopNumber: number
    hex: string
    l: number
    c: number
    h: number
    originalL: number
    expandedL: number
    isManualOverride: boolean
    targetContrast?: number  // Target contrast ratio (if using contrast mode)
  }>,
  baseChroma: number,
  backgroundColor: string
): Array<{
  stopNumber: number
  hex: string
  l: number
  c: number
  h: number
  originalL: number
  expandedL: number
  wasNudged: boolean
  nudgeAmount?: { lightness: number; chroma: number; hue: number }
}> {
  const bgOklch = hexToOklch(backgroundColor)

  // Create a map to track hex colors and their stop indices
  const hexToIndices = new Map<string, number[]>()

  // Build the map
  stops.forEach((stop, index) => {
    if (!stop.isManualOverride) {
      const existing = hexToIndices.get(stop.hex) || []
      existing.push(index)
      hexToIndices.set(stop.hex, existing)
    }
  })

  // Process duplicates
  const result = stops.map(stop => ({
    ...stop,
    wasNudged: false,
    nudgeAmount: undefined as { lightness: number; chroma: number; hue: number } | undefined
  }))

  for (const [, indices] of hexToIndices) {
    if (indices.length <= 1) continue // No duplicates

    // Sort by stop number to maintain natural order
    const sortedIndices = [...indices].sort(
      (a, b) => stops[a].stopNumber - stops[b].stopNumber
    )

    // Keep the first one unchanged, nudge the rest
    for (let i = 1; i < sortedIndices.length; i++) {
      const idx = sortedIndices[i]
      const stop = result[idx]

      // Skip manual overrides
      if (stops[idx].isManualOverride) continue

      let currentL = stop.l
      let currentC = stop.c
      let currentH = stop.h
      let lightnessNudge = 0
      let chromaNudge = 0
      let hueNudge = 0
      let newHex = stop.hex
      let foundUnique = false

      // Helper to check if hex is unique
      const isHexUnique = (hex: string) => !result.some(
        (s, sIdx) => sIdx !== idx && s.hex === hex
      )

      // PHASE 1: Try hue nudges first (minimal contrast impact)
      const hueOffsets = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]
      for (const offset of hueOffsets) {
        const testH = (stop.h + offset + 360) % 360
        const testHex = oklchToHex({ l: stop.l, c: stop.c, h: testH })
        if (isHexUnique(testHex)) {
          currentH = testH
          hueNudge = offset
          newHex = testHex
          foundUnique = true
          break
        }
      }

      // PHASE 2: Try chroma nudges (small contrast impact)
      if (!foundUnique) {
        const chromaOffsets = [-0.002, 0.002, -0.004, 0.004, -0.006, 0.006, -0.008, 0.008]
        for (const offset of chromaOffsets) {
          const testC = Math.max(0, stop.c + offset)
          const testHex = oklchToHex({ l: stop.l, c: testC, h: stop.h })
          if (isHexUnique(testHex)) {
            currentC = testC
            chromaNudge = offset
            newHex = testHex
            foundUnique = true
            break
          }
        }
      }

      // PHASE 3: Lightness nudges (affects contrast most, but direction-aware)
      if (!foundUnique) {
        // Determine nudge direction based on target contrast (if available)
        let lightnessDirection: number

        if (stop.targetContrast !== undefined) {
          // Smart direction: nudge toward target contrast
          const currentContrast = getContrastRatio(stop.hex, backgroundColor)

          if (currentContrast < stop.targetContrast) {
            // Need MORE contrast → move AWAY from background lightness
            // Light bg (bgL > 0.5): darker = more contrast → direction -1
            // Dark bg (bgL < 0.5): lighter = more contrast → direction +1
            lightnessDirection = bgOklch.l > 0.5 ? -1 : 1
          } else {
            // Need LESS contrast → move TOWARD background lightness
            lightnessDirection = bgOklch.l > 0.5 ? 1 : -1
          }
        } else {
          // No target contrast (lightness mode) - use legacy behavior
          // Lighter colors go lighter, darker colors go darker
          lightnessDirection = stop.l >= 0.5 ? 1 : -1
        }

        // Try lightness nudges in the calculated direction
        for (let step = 1; step <= 25; step++) {
          const nudgeAmount = lightnessDirection * MIN_LIGHTNESS_NUDGE * step
          const testL = Math.max(0, Math.min(1, stop.l + nudgeAmount))
          const testHex = oklchToHex({ l: testL, c: stop.c, h: stop.h })
          if (isHexUnique(testHex)) {
            currentL = testL
            lightnessNudge = nudgeAmount
            newHex = testHex
            foundUnique = true
            break
          }
        }

        // If still not found, try the opposite direction as fallback
        if (!foundUnique) {
          const oppositeDirection = -lightnessDirection
          for (let step = 1; step <= 25; step++) {
            const nudgeAmount = oppositeDirection * MIN_LIGHTNESS_NUDGE * step
            const testL = Math.max(0, Math.min(1, stop.l + nudgeAmount))
            const testHex = oklchToHex({ l: testL, c: stop.c, h: stop.h })
            if (isHexUnique(testHex)) {
              currentL = testL
              lightnessNudge = nudgeAmount
              newHex = testHex
              foundUnique = true
              break
            }
          }
        }
      }

      if (hueNudge !== 0 || chromaNudge !== 0 || lightnessNudge !== 0) {
        result[idx] = {
          ...result[idx],
          hex: newHex,
          l: currentL,
          c: currentC,
          h: currentH,
          wasNudged: true,
          nudgeAmount: { lightness: lightnessNudge, chroma: chromaNudge, hue: hueNudge }
        }
      }
    }
  }

  return result
}

// ============================================
// PALETTE GENERATION (Phase 8)
// ============================================

/**
 * Generate Color Palette
 *
 * Generates all stops for a color at once, applying:
 * 1. All transformations (hue shift, chroma shift, corrections)
 * 2. Duplicate detection and smart nudging (hue → chroma → lightness)
 *
 * @returns PaletteResult with all generated stops and metadata
 */
export function generateColorPalette(
  color: Color,
  globalSettings: GlobalSettings
): PaletteResult {
  const baseOklch = hexToOklch(color.baseColor)

  // Determine effective settings (color-level overrides global)
  const effectiveMethod = color.methodOverride ?? globalSettings.method
  // HK/BB corrections are per-color settings (default: off)
  const effectiveHK = color.hkCorrection ?? false
  const effectiveBB = color.bbCorrection ?? false
  const bgOklch = hexToOklch(globalSettings.backgroundColor)

  // First pass: generate all colors with expansion
  const intermediateStops = color.stops.map(stop => {
    const stopNum = stop.number
    const stopKey = String(stopNum)

    // Check for manual override first
    if (stop.manualOverride) {
      let finalColor = stop.manualOverride
      if (stop.applyCorrectionsToManual && (effectiveHK || effectiveBB)) {
        finalColor = applyPerceptualCorrections(finalColor, bgOklch, {
          hkCompensation: effectiveHK,
          bbCorrection: effectiveBB
        })
      }
      return {
        stopNumber: stopNum,
        hex: oklchToHex(finalColor),
        l: finalColor.l,
        c: finalColor.c,
        h: finalColor.h,
        originalL: finalColor.l,
        expandedL: finalColor.l,
        isManualOverride: true,
        targetContrast: undefined  // Manual overrides don't have target contrast
      }
    }

    // Calculate target lightness and track target contrast (if in contrast mode)
    let targetL: number
    let stopTargetContrast: number | undefined = undefined

    if (effectiveMethod === "contrast") {
      stopTargetContrast = stop.contrastOverride ??
        globalSettings.defaultContrast[stopNum] ?? 4.5
      targetL = findLightnessForContrast(baseOklch, globalSettings.backgroundColor, stopTargetContrast)
    } else {
      targetL = stop.lightnessOverride ??
        globalSettings.defaultLightness[stopNum] ?? 0.5
    }

    const originalL = targetL

    // Apply chroma reduction to stay in gamut using lookup table
    const targetC = clampChromaToGamut(baseOklch.c, targetL, baseOklch.h)

    let result: OKLCH = {
      l: targetL,
      c: targetC,
      h: baseOklch.h
    }

    // Apply hue shift if specified (using curve-based approach)
    if (color.hueShiftCurve && color.hueShiftCurve.preset !== "none") {
      const hueShiftValues = getHueShiftValues(color.hueShiftCurve)
      result = applyHueShift(result, targetL, hueShiftValues, color.hueShiftCurve.preset === "vivid")
    }

    // Apply chroma curve if specified (color-level setting)
    if (color.chromaCurve && color.chromaCurve.preset !== "flat") {
      result = applyChromaCurve(result, targetL, color.chromaCurve)
    }

    // Apply perceptual corrections if enabled
    if (effectiveHK || effectiveBB) {
      result = applyPerceptualCorrections(result, bgOklch, {
        hkCompensation: effectiveHK,
        bbCorrection: effectiveBB
      })
    }

    // Refine lightness to achieve target contrast (for contrast mode)
    // This compensates for contrast changes caused by chroma reduction,
    // hue/saturation shifts, and perceptual corrections
    if (effectiveMethod === "contrast" && stopTargetContrast !== undefined) {
      result = refineContrastToTarget(
        result,
        stopTargetContrast,
        globalSettings.backgroundColor
      )
    }

    // Smart Minimum Chroma: Preserve color identity at extreme lightness
    // When enabled (default), caps lightness to maintain perceptible color
    // BUT: only if capping wouldn't cause unacceptable contrast deviation (±0.03)
    const preserveIdentity = color.preserveColorIdentity !== false  // Default: true
    const MAX_CONTRAST_DEVIATION = 0.03  // ±0.03 tolerance for contrast targets

    if (preserveIdentity && baseOklch.c > 0.02) {  // Only for chromatic base colors
      const minChroma = getMinChromaForHue(result.h)
      const maxL = getMaxLightnessForMinChroma(result.h, minChroma)

      // Check if capping is needed
      if (result.l > maxL) {
        // For contrast method: only cap if deviation stays within tolerance
        if (effectiveMethod === "contrast" && stopTargetContrast !== undefined) {
          // Calculate what contrast we'd get at the capped lightness
          const cappedC = clampChromaToGamut(baseOklch.c, maxL, result.h)
          const cappedHex = oklchToHex({ l: maxL, c: cappedC, h: result.h })
          const cappedContrast = getContrastRatio(cappedHex, globalSettings.backgroundColor)
          const deviation = Math.abs(cappedContrast - stopTargetContrast)

          // Only apply cap if deviation is acceptable
          if (deviation <= MAX_CONTRAST_DEVIATION) {
            result.l = maxL
            result.c = cappedC
          }
          // Otherwise: don't cap, let the color stay lighter (possibly grey) to hit target
        } else {
          // For lightness method: always apply the cap (no contrast target to miss)
          result.l = maxL
          result.c = clampChromaToGamut(baseOklch.c, result.l, result.h)
        }
      }
    }

    // Final gamut validation - ensure color is displayable after all transformations
    result = validateAndClampToGamut(result)

    return {
      stopNumber: stopNum,
      hex: oklchToHex(result),
      l: result.l,
      c: result.c,
      h: result.h,
      originalL,
      expandedL: originalL,  // No expansion - same as original
      isManualOverride: false,
      targetContrast: stopTargetContrast  // Pass target contrast for smart nudging
    }
  })

  // Second pass: ensure unique hex colors (now with background for contrast-aware nudging)
  const uniqueStops = ensureUniqueHexColors(intermediateStops, baseOklch.c, globalSettings.backgroundColor)

  // Check if any duplicates were found and fixed
  const hadDuplicates = uniqueStops.some(s => s.wasNudged)

  // Convert to final format and calculate Delta-E between consecutive stops
  const generatedStops: GeneratedStop[] = uniqueStops.map((s, index) => {
    const stop: GeneratedStop = {
      stopNumber: s.stopNumber,
      hex: s.hex,
      originalL: s.originalL,
      expandedL: s.expandedL,
      wasNudged: s.wasNudged,
      nudgeAmount: s.nudgeAmount
    }

    // Calculate Delta-E to previous stop (if not first)
    if (index > 0) {
      const prevStop = uniqueStops[index - 1]
      const currentColor: OKLCH = { l: s.l, c: s.c, h: s.h }
      const prevColor: OKLCH = { l: prevStop.l, c: prevStop.c, h: prevStop.h }
      const deltaE = calculateDeltaE(currentColor, prevColor)

      stop.deltaE = deltaE
      stop.tooSimilar = deltaE < DELTA_E_THRESHOLD
    }

    return stop
  })

  return {
    colorId: color.id,
    stops: generatedStops,
    hadDuplicates
  }
}
