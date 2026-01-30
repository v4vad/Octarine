/**
 * Contrast Utilities Module
 *
 * WCAG contrast calculations and contrast-based color generation.
 * Uses culori's built-in WCAG functions for accurate, standard-compliant calculations.
 */

import { wcagContrast, wcagLuminance } from "culori"
import type { OKLCH } from "./color-conversions"
import { hexToOklch, oklchToHex } from "./color-conversions"
import { clampChromaToGamut } from "./gamut-table"

/**
 * Calculate WCAG contrast ratio between two colors
 *
 * Uses culori's built-in wcagContrast for accurate calculations.
 * Contrast ratio ranges from 1:1 (identical) to 21:1 (black/white).
 *
 * WCAG guidelines:
 * - 4.5:1 minimum for normal text (AA)
 * - 3:1 minimum for large text (AA)
 * - 7:1 enhanced contrast (AAA)
 */
export function getContrastRatio(color1: string, color2: string): number {
  return wcagContrast(color1, color2)
}

/**
 * Get relative luminance of a color (for internal use)
 *
 * Uses culori's wcagLuminance for accurate WCAG-compliant calculation.
 * Range: 0 (black) to 1 (white)
 */
export function getRelativeLuminance(color: string): number {
  return wcagLuminance(color)
}

/**
 * Determine if light text should be used on a background color
 *
 * @param backgroundColor - The background color in hex format
 * @returns true if light text should be used (dark background)
 */
export function shouldUseLightText(backgroundColor: string): boolean {
  const luminance = wcagLuminance(backgroundColor)
  return luminance < 0.4
}

/**
 * Find lightness that achieves target contrast against background
 *
 * Uses binary search to find the OKLCH lightness value that produces
 * the desired contrast ratio against a given background color.
 *
 * @param baseColor - The base color with chroma and hue to preserve
 * @param background - Background color for contrast calculation
 * @param targetContrast - Desired contrast ratio (e.g., 4.5 for AA)
 * @returns Lightness value (0-1) that achieves the target contrast
 */
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
