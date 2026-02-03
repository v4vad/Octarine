/**
 * Stop Value Curves
 *
 * Mathematical curves that determine lightness/contrast values for each stop.
 * Instead of fixed lookup tables, values are interpolated from 3 control points
 * (light, mid, dark) using a smooth step function.
 *
 * The same curve approach works for both:
 * - Lightness method: values 0-1
 * - Contrast method: values 1-21 (WCAG ratio)
 */

import type { StopValueCurve } from "./types"
import { LIGHTNESS_CURVE_PRESETS, CONTRAST_CURVE_PRESETS } from "./types"

// Re-export preset constants from types for convenience
export { LIGHTNESS_CURVE_PRESETS, CONTRAST_CURVE_PRESETS }

/**
 * Smooth step function for interpolation
 * Creates natural-looking transitions between control points
 */
function smoothStep(x: number): number {
  // Clamp to 0-1
  x = Math.max(0, Math.min(1, x))
  // Hermite interpolation (3x² - 2x³)
  return x * x * (3 - 2 * x)
}

/**
 * Normalize stop number to 0-1 position
 * @param stopNum - The stop number (e.g., 50, 100, 500, 900)
 * @param minStop - Minimum stop in the scale (typically 50)
 * @param maxStop - Maximum stop in the scale (typically 900)
 * @returns Position from 0 (lightest) to 1 (darkest)
 */
export function normalizeStopPosition(
  stopNum: number,
  minStop: number,
  maxStop: number
): number {
  if (minStop === maxStop) return 0.5
  return (stopNum - minStop) / (maxStop - minStop)
}

/**
 * Interpolate value using 3 control points with smooth step
 *
 * The curve is split into two segments:
 * - Light → Mid (position 0 to 0.5)
 * - Mid → Dark (position 0.5 to 1)
 *
 * @param position - Normalized position 0-1 (0=light, 1=dark)
 * @param light - Value at the light end (position 0)
 * @param mid - Value at the middle (position 0.5)
 * @param dark - Value at the dark end (position 1)
 */
export function interpolateCurveValue(
  position: number,
  light: number,
  mid: number,
  dark: number
): number {
  if (position <= 0.5) {
    // Light to mid segment
    const t = smoothStep(position / 0.5)
    return light + (mid - light) * t
  } else {
    // Mid to dark segment
    const t = smoothStep((position - 0.5) / 0.5)
    return mid + (dark - mid) * t
  }
}

/**
 * Get lightness value from curve for a specific stop
 *
 * @param stopNum - Stop number (e.g., 500)
 * @param allStops - All stop numbers in sorted order
 * @param curve - The lightness curve configuration
 * @returns Lightness value 0-1
 */
export function getLightnessFromCurve(
  stopNum: number,
  allStops: number[],
  curve: StopValueCurve
): number {
  // Check for per-stop override first
  if (curve.overrides?.[stopNum] !== undefined) {
    return curve.overrides[stopNum]
  }

  // Get control points from preset or custom values
  let light: number, mid: number, dark: number

  if (curve.preset === "custom") {
    // Custom mode uses explicit control points
    light = curve.lightValue ?? 0.95
    mid = curve.midValue ?? 0.55
    dark = curve.darkValue ?? 0.20
  } else {
    // Use preset values
    const presetValues = LIGHTNESS_CURVE_PRESETS[curve.preset]
    light = presetValues.light
    mid = presetValues.mid
    dark = presetValues.dark
  }

  // Handle edge cases
  if (allStops.length === 0) return mid
  if (allStops.length === 1) return mid

  const sorted = [...allStops].sort((a, b) => a - b)
  const minStop = sorted[0]
  const maxStop = sorted[sorted.length - 1]

  // Two stops: interpolate directly between light and dark
  if (allStops.length === 2) {
    const position = normalizeStopPosition(stopNum, minStop, maxStop)
    const t = smoothStep(position)
    return light + (dark - light) * t
  }

  // Normal case: use 3-point interpolation
  const position = normalizeStopPosition(stopNum, minStop, maxStop)
  return interpolateCurveValue(position, light, mid, dark)
}

/**
 * Get contrast value from curve for a specific stop
 *
 * @param stopNum - Stop number (e.g., 500)
 * @param allStops - All stop numbers in sorted order
 * @param curve - The contrast curve configuration
 * @returns Contrast ratio 1-21
 */
export function getContrastFromCurve(
  stopNum: number,
  allStops: number[],
  curve: StopValueCurve
): number {
  // Check for per-stop override first
  if (curve.overrides?.[stopNum] !== undefined) {
    return curve.overrides[stopNum]
  }

  // Get control points from preset or custom values
  let light: number, mid: number, dark: number

  if (curve.preset === "custom") {
    // Custom mode uses explicit control points
    light = curve.lightValue ?? 1.2
    mid = curve.midValue ?? 4.5
    dark = curve.darkValue ?? 15
  } else {
    // Use preset values
    const presetValues = CONTRAST_CURVE_PRESETS[curve.preset]
    light = presetValues.light
    mid = presetValues.mid
    dark = presetValues.dark
  }

  // Handle edge cases
  if (allStops.length === 0) return mid
  if (allStops.length === 1) return mid

  const sorted = [...allStops].sort((a, b) => a - b)
  const minStop = sorted[0]
  const maxStop = sorted[sorted.length - 1]

  // Two stops: interpolate directly between light and dark
  if (allStops.length === 2) {
    const position = normalizeStopPosition(stopNum, minStop, maxStop)
    const t = smoothStep(position)
    return light + (dark - light) * t
  }

  // Normal case: use 3-point interpolation
  const position = normalizeStopPosition(stopNum, minStop, maxStop)
  return interpolateCurveValue(position, light, mid, dark)
}

/**
 * Get effective control point values from a curve
 * Useful for UI display (e.g., showing current light/mid/dark values)
 */
export function getCurveControlPoints(
  curve: StopValueCurve,
  presets: Record<string, { light: number; mid: number; dark: number }>
): { light: number; mid: number; dark: number } {
  if (curve.preset === "custom") {
    return {
      light: curve.lightValue ?? presets["linear"].light,
      mid: curve.midValue ?? presets["linear"].mid,
      dark: curve.darkValue ?? presets["linear"].dark
    }
  }
  return presets[curve.preset]
}
