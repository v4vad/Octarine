/**
 * Color Distinctness Module
 *
 * Handles color difference calculations and duplicate detection/nudging.
 * Uses a custom Delta-E formula optimized for color palette generation.
 */

import type { OKLCH } from "./color-conversions"
import { hexToOklch, oklchToHex } from "./color-conversions"
import { getContrastRatio } from "./contrast-utils"

// ============================================
// DELTA-E (Color Difference)
// ============================================

/**
 * Calculate Delta-E (color difference) in OKLCH space
 *
 * CUSTOM IMPLEMENTATION - Do not replace with culori's differenceEuclidean()
 *
 * Why custom: This formula weights hue by chroma level, which is more
 * perceptually accurate for color palettes. For desaturated colors (low chroma),
 * hue differences matter less visually. Standard Euclidean distance would
 * incorrectly report gray-ish blue vs gray-ish red as "very different"
 * when they actually look almost identical to humans.
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
// NUDGE CONSTANTS
// ============================================

/**
 * Minimum lightness nudge step (approximately 1 hex level)
 * In hex, each channel has 256 levels. In OKLCH, lightness range is 0-1,
 * so 1/256 ≈ 0.004 is roughly one step.
 */
export const MIN_LIGHTNESS_NUDGE = 0.004

/**
 * Minimum chroma nudge step
 */
export const MIN_CHROMA_NUDGE = 0.002

/**
 * Minimum hue nudge step (in degrees)
 * Small hue shifts create different hex values with minimal contrast impact
 */
export const MIN_HUE_NUDGE = 1

// ============================================
// DUPLICATE COLOR DETECTION & NUDGING
// ============================================

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
