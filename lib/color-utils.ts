import type { ColorMode, ColorStop } from "./types"
import { oklch, rgb, formatHex } from "culori"

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

// Hue shift direction type
export type HueShiftDirection = "warm-cool" | "cool-warm"

// Generate color for a specific stop
export function generateColor(
  baseColor: string,
  stop: string,
  stopData: ColorStop | undefined,
  globalMode: ColorMode,
  globalLightness?: Record<string, number>,
  globalContrast?: Record<string, number>,
  backgroundColor?: string,
  perceptualCorrections?: PerceptualCorrectionOptions,
  hueShiftAmount?: number,
  hueShiftDirection?: HueShiftDirection,
  chromaShiftAmount?: number,
  chromaShiftDirection?: ChromaShiftDirection
): string {
  // If there's a manual override, use it directly
  if (stopData?.manualOverride) {
    return oklchToHex(stopData.manualOverride)
  }

  const baseOklch = hexToOklch(baseColor)
  const bgOklch = backgroundColor ? hexToOklch(backgroundColor) : { l: 1, c: 0, h: 0 }

  // Determine effective mode for this stop
  const effectiveMode = stopData?.modeOverride === "global" || !stopData?.modeOverride
    ? globalMode
    : stopData.modeOverride

  let targetL: number

  if (effectiveMode === "contrast" && backgroundColor) {
    // Contrast mode: find lightness that achieves target contrast
    const targetContrast = stopData?.contrast ?? globalContrast?.[stop] ?? 4.5
    targetL = findLightnessForContrast(baseOklch, backgroundColor, targetContrast)
  } else {
    // Lightness mode: use target lightness directly
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

  // Apply chroma reduction for very light/dark colors to stay in gamut
  let targetC = baseOklch.c
  if (targetL > 0.9) {
    targetC *= 0.3 + (0.7 * (1 - targetL) / 0.1)
  } else if (targetL < 0.15) {
    targetC *= 0.3 + (0.7 * targetL / 0.15)
  }

  let result: OKLCH = {
    l: targetL,
    c: targetC,
    h: baseOklch.h,
  }

  // Apply hue shift if specified (artistic hue variation across stops)
  if (hueShiftAmount && hueShiftAmount > 0) {
    // Flip the sign for cool-warm direction
    const effectiveShift = hueShiftDirection === "cool-warm"
      ? -hueShiftAmount
      : hueShiftAmount
    result = applyHueShift(result, targetL, effectiveShift)
  }

  // Apply chroma/saturation shift if specified (artistic saturation variation)
  if (chromaShiftAmount && chromaShiftAmount > 0) {
    result = applyChromaShift(result, targetL, chromaShiftAmount, chromaShiftDirection)
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
 */
export function getHKCompensation(chroma: number, hue: number): number {
  // Effect magnitude varies by hue (peak at blue ~270°, minimum at yellow ~90°)
  // Using cosine wave centered on blue (270°) so effect is strongest there
  const hueFactor = 0.5 + 0.5 * Math.cos((hue - 270) * Math.PI / 180) // 1 at blue, 0 at yellow

  // Effect increases with chroma (saturation)
  const chromaFactor = Math.min(chroma / 0.2, 1) // Normalize to typical chroma range

  // Maximum compensation ~0.05 L units for highly saturated blue
  return 0.05 * chromaFactor * hueFactor
}

export function applyHKCompensation(color: OKLCH, isLightBackground: boolean): OKLCH {
  const compensation = getHKCompensation(color.c, color.h)

  // On light backgrounds (dark text), reduce lightness since color appears brighter
  // On dark backgrounds (light text), increase lightness
  const adjustedL = isLightBackground
    ? color.l - compensation
    : color.l + compensation

  return { ...color, l: Math.max(0, Math.min(1, adjustedL)) }
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
 */
export function getBBShiftCorrection(baseHue: number, lightness: number): number {
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

  // Calculate shift magnitude (max ~5° at extremes)
  const shiftMagnitude = 5 * Math.pow(Math.abs(deviation) * 2, 1.5)

  // Shift AWAY from the attractor to counteract perceived shift
  const toAttractor = angularDistance(baseHue, attractor)
  const shiftDirection = toAttractor > 0 ? -1 : 1

  return shiftDirection * shiftMagnitude
}

export function applyBBCorrection(color: OKLCH): OKLCH {
  const hueCorrection = getBBShiftCorrection(color.h, color.l)
  const correctedHue = (color.h + hueCorrection + 360) % 360

  return { ...color, h: correctedHue }
}

// ============================================
// HUE SHIFT (Artistic hue variation across stops)
// ============================================

/**
 * Intentional Hue Shift Across Lightness
 *
 * Unlike Bezold-Brücke correction (which counteracts unwanted perceptual shifts),
 * this is an artistic feature that intentionally varies hue across lightness levels.
 *
 * Example: A blue palette can shift toward purple in dark stops and toward cyan in light stops.
 *
 * @param color - The color to shift
 * @param targetL - The target lightness (0-1)
 * @param shiftAmount - Total degrees to shift (positive = warm→cool, negative = cool→warm)
 */
export function applyHueShift(
  color: OKLCH,
  targetL: number,
  shiftAmount: number
): OKLCH {
  if (shiftAmount === 0) return color

  // Map lightness to shift amount:
  // - High L (light colors) → shift one direction
  // - Low L (dark colors) → shift opposite direction
  // - Mid L (0.5) → no shift
  //
  // normalizedL ranges from -1 (at L=0) to +1 (at L=1)
  const normalizedL = (targetL - 0.5) * 2

  // For positive shiftAmount (warm→cool):
  // - Light colors (positive normalizedL) → shift toward warm (subtract from hue)
  // - Dark colors (negative normalizedL) → shift toward cool (add to hue)
  const hueOffset = -normalizedL * (shiftAmount / 2)

  const newHue = (color.h + hueOffset + 360) % 360
  return { ...color, h: newHue }
}

// ============================================
// CHROMA/SATURATION SHIFT (Artistic saturation variation across stops)
// ============================================

// Chroma shift direction type
export type ChromaShiftDirection = "vivid-muted" | "muted-vivid"

/**
 * Intentional Chroma (Saturation) Shift Across Lightness
 *
 * Varies saturation across lightness levels for artistic effect.
 *
 * @param color - The color to shift
 * @param targetL - The target lightness (0-1)
 * @param shiftAmount - Percentage to shift (0-100). At 100%, extremes are fully desaturated.
 * @param direction - "vivid-muted" = light is vivid, dark is muted. "muted-vivid" = opposite.
 */
export function applyChromaShift(
  color: OKLCH,
  targetL: number,
  shiftAmount: number,
  direction: ChromaShiftDirection = "vivid-muted"
): OKLCH {
  if (shiftAmount === 0 || color.c === 0) return color

  // Map lightness to a multiplier:
  // - normalizedL ranges from -1 (at L=0) to +1 (at L=1)
  const normalizedL = (targetL - 0.5) * 2

  // Calculate how much to reduce chroma (0 = no reduction, 1 = full reduction)
  // For "vivid-muted": light colors keep chroma, dark colors lose it
  // For "muted-vivid": dark colors keep chroma, light colors lose it
  let reductionFactor: number
  if (direction === "vivid-muted") {
    // Light (high L, positive normalizedL) → keep chroma (low reduction)
    // Dark (low L, negative normalizedL) → reduce chroma (high reduction)
    reductionFactor = Math.max(0, -normalizedL)
  } else {
    // Light (high L, positive normalizedL) → reduce chroma (high reduction)
    // Dark (low L, negative normalizedL) → keep chroma (low reduction)
    reductionFactor = Math.max(0, normalizedL)
  }

  // Apply the shift amount (0-100 maps to 0-1)
  const chromaMultiplier = 1 - (reductionFactor * (shiftAmount / 100))
  const newChroma = color.c * Math.max(0, chromaMultiplier)

  return { ...color, c: newChroma }
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
