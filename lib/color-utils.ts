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

// Re-export color distinctness utilities for backward compatibility
export {
  calculateDeltaE,
  DELTA_E_THRESHOLD,
  MIN_LIGHTNESS_NUDGE,
  MIN_CHROMA_NUDGE,
  MIN_HUE_NUDGE,
  ensureUniqueHexColors,
} from "./color-distinctness"

// Import for internal use
import { OKLCH, hexToOklch, oklchToHex } from "./color-conversions"
import { applyPerceptualCorrections, PerceptualCorrectionOptions } from "./perceptual-corrections"
import { getHueShiftValues, applyHueShift, applyChromaCurve } from "./artistic-curves"
import { getContrastRatio, findLightnessForContrast, refineContrastToTarget } from "./contrast-utils"
import { clampChromaToGamut, getMinChromaForHue, getMaxLightnessForMinChroma, validateAndClampToGamut } from "./gamut-utils"
import { calculateDeltaE, DELTA_E_THRESHOLD, ensureUniqueHexColors } from "./color-distinctness"

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
// PALETTE GENERATION
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
