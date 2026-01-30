import type { ColorMethod, ColorStop, GeneratedStop, PaletteResult, Color, EffectiveSettings, ChromaCurve, HueShiftCurve } from "./types"

// Re-export all color conversions for backward compatibility
export {
  OKLCH,
  hexToOklch,
  oklchToHex,
  oklchToCss,
  parseOklch,
  hexToRgb,
  rgbToHex,
  rgbToHsb,
  hsbToRgb,
  rgbToOklch,
  oklchToRgb,
} from "./color-conversions"

// Re-export perceptual corrections for backward compatibility
export {
  getHKCompensation,
  applyHKCompensation,
  getBBShiftCorrection,
  applyBBCorrection,
  applyPerceptualCorrections,
  PerceptualCorrectionOptions,
} from "./perceptual-corrections"

// Re-export artistic curves for backward compatibility
export {
  getYellowEquivalentShifts,
  getHueShiftValues,
  applyHueShift,
  applyChromaCurve,
} from "./artistic-curves"

// Re-export contrast utilities for backward compatibility
export {
  getContrastRatio,
  getRelativeLuminance,
  shouldUseLightText,
  findLightnessForContrast,
  refineContrastToTarget,
} from "./contrast-utils"

// Re-export gamut utilities for backward compatibility
export {
  getMaxChroma,
  clampChromaToGamut,
  isInGamut,
  getMinChromaForHue,
  getMaxLightnessForMinChroma,
  validateAndClampToGamut,
} from "./gamut-utils"

// Import for internal use
import { OKLCH, hexToOklch, oklchToHex } from "./color-conversions"
import { applyPerceptualCorrections, PerceptualCorrectionOptions } from "./perceptual-corrections"
import { getHueShiftValues, applyHueShift, applyChromaCurve } from "./artistic-curves"
import { getContrastRatio, findLightnessForContrast, refineContrastToTarget } from "./contrast-utils"
import { clampChromaToGamut, getMinChromaForHue, getMaxLightnessForMinChroma, validateAndClampToGamut } from "./gamut-utils"

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
  // Yellow-aware logic applies to presets (not custom) to keep yellows golden
  // Custom mode uses slider values directly so users can fine-tune
  if (hueShiftCurve && hueShiftCurve.preset !== "none") {
    const hueShiftValues = getHueShiftValues(hueShiftCurve)
    const yellowAware = hueShiftCurve.preset !== "custom"
    result = applyHueShift(result, targetL, hueShiftValues, yellowAware)
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
  globalSettings: EffectiveSettings
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
    // Yellow-aware logic applies to presets (not custom) to keep yellows golden
    // Custom mode uses slider values directly so users can fine-tune
    if (color.hueShiftCurve && color.hueShiftCurve.preset !== "none") {
      const hueShiftValues = getHueShiftValues(color.hueShiftCurve)
      const yellowAware = color.hueShiftCurve.preset !== "custom"
      result = applyHueShift(result, targetL, hueShiftValues, yellowAware)
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
