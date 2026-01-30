/**
 * Perceptual Corrections Module
 *
 * Compensates for human visual perception quirks:
 * - Helmholtz-Kohlrausch (HK): Saturated colors appear brighter
 * - Bezold-Brücke (BB): Perceived hue shifts with lightness changes
 *
 * These are pure math functions with no dependencies on other color-utils modules.
 */

import type { OKLCH } from "./color-conversions"

// ============================================
// HELMHOLTZ-KOHLRAUSCH EFFECT COMPENSATION
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

// ============================================
// BEZOLD-BRÜCKE SHIFT CORRECTION
// ============================================

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
// COMBINED PERCEPTUAL CORRECTION PIPELINE
// ============================================

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
