/**
 * ============================================================================
 * ARCHIVED: This file was replaced by lib/gamut-utils.ts in January 2026.
 *
 * REASON FOR ARCHIVING:
 * The 101×360 pre-computed lookup table was replaced with culori's built-in
 * clampChroma() function, which performs binary search on-demand.
 *
 * BENEFITS OF THE NEW APPROACH:
 * - Removed ~170 lines of code
 * - Eliminated module load time (100-200ms table generation)
 * - Same accuracy through binary search
 * - Maintained by culori library (less code to maintain ourselves)
 *
 * This file is kept for historical reference and in case we need to revert.
 * ============================================================================
 */

/**
 * Gamut Lookup Table for OKLCH → sRGB
 *
 * This module provides pre-calculated maximum chroma values for any
 * lightness/hue combination in the OKLCH color space that fits within
 * the sRGB gamut.
 *
 * WHY THIS EXISTS:
 * Different hues have different gamut limits at different lightness levels:
 * - Blues can stay saturated when dark, but clip quickly when light
 * - Yellows clip quickly when dark, but can stay vivid when light
 * - Reds/Oranges have medium range in both directions
 *
 * The previous threshold-based approach (reduce chroma when L > 0.9 or L < 0.15)
 * was too conservative for some colors and not conservative enough for others.
 * This lookup table uses actual gamut boundaries for each hue.
 */

import { rgb } from "culori"

/**
 * Check if an OKLCH color is within the sRGB gamut
 *
 * When culori converts an out-of-gamut OKLCH color to RGB,
 * the resulting RGB values will be outside the 0-1 range.
 */
function isInGamut(l: number, c: number, h: number): boolean {
  const color = rgb({ mode: "oklch", l, c, h })
  if (!color) return false

  // Get RGB values with defaults for undefined
  const r = color.r ?? 0
  const g = color.g ?? 0
  const b = color.b ?? 0

  // Check if all RGB channels are within valid range (with tiny tolerance for floating point)
  const tolerance = 0.0001
  return (
    r >= -tolerance && r <= 1 + tolerance &&
    g >= -tolerance && g <= 1 + tolerance &&
    b >= -tolerance && b <= 1 + tolerance
  )
}

/**
 * Find maximum in-gamut chroma for a given lightness and hue
 * using binary search.
 *
 * Note: Instead of hard-clipping at L < 0.001 or L > 0.999, we let the
 * binary search find actual (tiny) max chroma values. This provides
 * smoother transitions at palette edges instead of abrupt jumps to zero.
 */
function findMaxChroma(l: number, h: number): number {
  // Exact black and white have no chroma
  if (l <= 0 || l >= 1) return 0

  // For near-extremes, use a smaller search range since max chroma is tiny
  // This is more efficient and avoids numerical issues
  const maxPossibleChroma = l < 0.02 || l > 0.98
    ? 0.1  // Smaller search range for extremes
    : 0.4  // Full search range (max OKLCH chroma for sRGB is ~0.37)

  let low = 0
  let high = maxPossibleChroma

  // Binary search with 15 iterations gives precision of ~0.00001
  for (let i = 0; i < 15; i++) {
    const mid = (low + high) / 2
    if (isInGamut(l, mid, h)) {
      low = mid
    } else {
      high = mid
    }
  }

  return low
}

/**
 * Generate the full lookup table
 *
 * Structure: GAMUT_TABLE[lightness_index][hue_index] = max_chroma
 * - lightness_index: 0-100 (representing L = 0.00 to 1.00 in steps of 0.01)
 * - hue_index: 0-359 (representing H = 0 to 359 degrees)
 *
 * This is computed once at module load time.
 */
function generateGamutTable(): number[][] {
  const table: number[][] = []

  for (let lIndex = 0; lIndex <= 100; lIndex++) {
    const l = lIndex / 100
    const row: number[] = []

    for (let h = 0; h < 360; h++) {
      row.push(findMaxChroma(l, h))
    }

    table.push(row)
  }

  return table
}

// Generate the table once when module loads
// This takes ~100-200ms but only happens once
const GAMUT_TABLE = generateGamutTable()

/**
 * Get maximum in-gamut chroma for a given lightness and hue
 *
 * Uses bilinear interpolation between grid points for smooth results.
 *
 * @param l - Lightness (0-1)
 * @param h - Hue (0-360 degrees)
 * @returns Maximum chroma that will stay in sRGB gamut
 */
export function getMaxChroma(l: number, h: number): number {
  // Clamp lightness to valid range
  l = Math.max(0, Math.min(1, l))

  // Normalize hue to 0-360 range
  h = ((h % 360) + 360) % 360

  // Convert to table indices
  const lIndex = l * 100
  const hIndex = h

  // Get the four surrounding grid points
  const l0 = Math.floor(lIndex)
  const l1 = Math.min(100, l0 + 1)
  const h0 = Math.floor(hIndex)
  const h1 = (h0 + 1) % 360

  // Get fractional parts for interpolation
  const lFrac = lIndex - l0
  const hFrac = hIndex - h0

  // Bilinear interpolation
  // Get the four corner values
  const c00 = GAMUT_TABLE[l0][h0]
  const c01 = GAMUT_TABLE[l0][h1]
  const c10 = GAMUT_TABLE[l1][h0]
  const c11 = GAMUT_TABLE[l1][h1]

  // Interpolate along hue axis first
  const c0 = c00 + (c01 - c00) * hFrac
  const c1 = c10 + (c11 - c10) * hFrac

  // Then interpolate along lightness axis
  const maxC = c0 + (c1 - c0) * lFrac

  return maxC
}

/**
 * Clamp chroma to the maximum in-gamut value
 *
 * This is the main function to use when generating colors.
 * It ensures the chroma stays within the sRGB gamut for the given
 * lightness and hue.
 *
 * @param c - Desired chroma
 * @param l - Lightness (0-1)
 * @param h - Hue (0-360 degrees)
 * @returns Chroma clamped to maximum in-gamut value
 */
export function clampChromaToGamut(c: number, l: number, h: number): number {
  const maxC = getMaxChroma(l, h)
  return Math.min(c, maxC)
}
