import type { ColorMethod, ColorStop, GeneratedStop, PaletteResult, Stop, Color, GlobalSettings } from "./types"
import { oklch, rgb, formatHex } from "culori"
import { clampChromaToGamut } from "./gamut-table"

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
 * @param tolerance - How close to target is acceptable (default 0.02)
 * @returns Color with adjusted lightness to achieve target contrast
 */
export function refineContrastToTarget(
  color: OKLCH,
  targetContrast: number,
  backgroundColor: string,
  tolerance: number = 0.02
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

// Hue shift direction type
export type HueShiftDirection = "warm-cool" | "cool-warm"

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
  hueShiftAmount?: number,
  hueShiftDirection?: HueShiftDirection,
  chromaShiftAmount?: number,
  chromaShiftDirection?: ChromaShiftDirection
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

    // Apply hue shift if specified
    const hueShift = stop.hueShiftOverride ?? color.hueShift ?? 0
    if (hueShift > 0) {
      const effectiveShift = (color.hueShiftDirection ?? "warm-cool") === "cool-warm"
        ? -hueShift
        : hueShift
      result = applyHueShift(result, targetL, effectiveShift)
    }

    // Apply chroma/saturation shift if specified
    const chromaShift = stop.saturationShiftOverride ?? color.saturationShift ?? 0
    if (chromaShift > 0) {
      result = applyChromaShift(
        result,
        targetL,
        chromaShift,
        color.saturationShiftDirection ?? "vivid-muted"
      )
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

  // Convert to final format
  const generatedStops: GeneratedStop[] = uniqueStops.map(s => ({
    stopNumber: s.stopNumber,
    hex: s.hex,
    originalL: s.originalL,
    expandedL: s.expandedL,
    wasNudged: s.wasNudged,
    nudgeAmount: s.nudgeAmount
  }))

  return {
    colorId: color.id,
    stops: generatedStops,
    hadDuplicates
  }
}
