/**
 * Gamut Utilities Module
 *
 * Functions for working with sRGB gamut boundaries in OKLCH color space.
 * Uses culori's built-in gamut clamping (binary search on-demand)
 * instead of a pre-computed lookup table.
 *
 * NOTE: This replaces the previous gamut-table.ts which used a 101x360
 * pre-computed lookup table. The archived version is in docs/archived/gamut-table.ts.
 */

import { clampChroma, displayable } from "culori"
import type { OKLCH } from "./color-conversions"

/**
 * Check if an OKLCH color is within the sRGB gamut
 *
 * @param l - Lightness (0-1)
 * @param c - Chroma (0-0.4)
 * @param h - Hue (0-360 degrees)
 * @returns true if the color is displayable in sRGB
 */
export function isInGamut(l: number, c: number, h: number): boolean {
  return displayable({ mode: 'oklch', l, c, h })
}

/**
 * Get maximum in-gamut chroma for a given lightness and hue
 *
 * Uses culori's clampChroma which performs binary search to find
 * the maximum chroma that fits within sRGB gamut.
 *
 * @param l - Lightness (0-1)
 * @param h - Hue (0-360 degrees)
 * @returns Maximum chroma that will stay in sRGB gamut
 */
export function getMaxChroma(l: number, h: number): number {
  // Exact black and white have no chroma
  if (l <= 0 || l >= 1) return 0

  // Start with a high chroma value and let culori find the max
  const maxPossibleChroma = 0.4 // Max OKLCH chroma for sRGB is ~0.37

  // Create a color with high chroma and clamp it
  const color = { mode: 'oklch' as const, l, c: maxPossibleChroma, h }
  const clamped = clampChroma(color, 'oklch')

  // Return the clamped chroma value
  return clamped?.c ?? 0
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
  // If already in gamut, return as-is
  if (displayable({ mode: 'oklch', l, c, h })) {
    return c
  }

  // Clamp to max chroma
  const color = { mode: 'oklch' as const, l, c, h }
  const clamped = clampChroma(color, 'oklch')

  return clamped?.c ?? 0
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
 * Uses binary search to find the highest lightness where
 * getMaxChroma(L, hue) >= minChroma.
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
  if (displayable({ mode: 'oklch', ...color })) {
    return color
  }

  // Clamp to gamut
  const clamped = clampChroma({ mode: 'oklch', ...color }, 'oklch')

  return {
    l: color.l,
    c: clamped?.c ?? 0,
    h: color.h
  }
}
