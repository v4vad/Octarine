/**
 * Artistic Curves Module
 *
 * Intentional hue and chroma variations across lightness levels:
 * - Hue Shift: Artistic hue variation (e.g., blues → cyan in lights, purple in darks)
 * - Chroma Curves: Bell-shaped saturation distribution for professional palettes
 *
 * These are design features, not perceptual corrections.
 * They only depend on types.ts for preset constants.
 */

import type { OKLCH } from "./color-conversions"
import type { HueShiftCurve, ChromaCurve } from "./types"
import { HUE_SHIFT_CURVE_PRESETS, CHROMA_CURVE_PRESETS } from "./types"

// ============================================
// HUE SHIFT (Artistic hue variation across stops)
// ============================================

/**
 * Calculate equivalent light/dark shift values for yellows
 * Used when initializing Custom mode from a preset
 *
 * For yellows (hue 70-110°), presets use a special formula instead of
 * the standard light/dark shift values. This function calculates what
 * the equivalent slider values would be, so Custom mode can display them.
 *
 * @param hue - Hue angle in degrees (0-360)
 * @returns Object with light and dark shift amounts, or null if not a yellow
 */
export function getYellowEquivalentShifts(hue: number): { light: number; dark: number } | null {
  const normalizedHue = ((hue % 360) + 360) % 360
  const isYellow = normalizedHue >= 70 && normalizedHue <= 110

  if (!isYellow) return null

  // yellowFactor: 1.0 at pure yellow (90°), tapering to 0 at edges
  const yellowFactor = 1 - Math.abs(normalizedHue - 90) / 20
  const maxShift = -45  // Maximum shift toward orange at L=0

  // Calculate shift at representative lightness levels
  const lightL = 0.85  // Typical light stop
  const darkL = 0.25   // Typical dark stop

  return {
    light: Math.round(maxShift * (1 - lightL) * yellowFactor),  // e.g., -7° for pure yellow
    dark: Math.round(maxShift * (1 - darkL) * yellowFactor)     // e.g., -34° for pure yellow
  }
}

/**
 * Get Hue Shift Values from Curve Configuration
 *
 * Extracts the light and dark shift amounts from a HueShiftCurve,
 * handling both presets and custom configurations.
 *
 * @param curve - The hue shift curve configuration
 * @returns Object with light and dark shift amounts in degrees
 */
export function getHueShiftValues(curve: HueShiftCurve | undefined): { light: number; dark: number } {
  if (!curve || curve.preset === "none") {
    return { light: 0, dark: 0 }
  }

  if (curve.preset === "custom") {
    return {
      light: curve.lightShift ?? 0,
      dark: curve.darkShift ?? 0
    }
  }

  return HUE_SHIFT_CURVE_PRESETS[curve.preset]
}

/**
 * Intentional Hue Shift Across Lightness (Curve-Based)
 *
 * Unlike Bezold-Brücke correction (which counteracts unwanted perceptual shifts),
 * this is an artistic feature that intentionally varies hue across lightness levels.
 *
 * The curve-based approach allows asymmetric shifts - for example, darks can shift
 * more than lights, matching what professional color palettes do.
 *
 * Example: A blue palette can shift toward cyan in light stops and toward purple in dark stops.
 *
 * Special handling for yellows in Vivid mode:
 * Yellow (hue ~90°) has a unique problem: the standard light shift (+12°) pushes it
 * toward green (102°), making it look olive/muddy. Instead of using the standard
 * light/dark region logic, yellows get a continuous shift toward orange at ALL
 * lightness levels, with the shift increasing as the color gets darker.
 *
 * @param color - The color to shift
 * @param targetL - The target lightness (0-1)
 * @param curve - Object with light (shift for L>0.5) and dark (shift for L<0.5) amounts in degrees
 * @param yellowAware - If true (Vivid preset), apply special yellow handling
 * @returns Color with hue shifted based on lightness region
 */
export function applyHueShift(
  color: OKLCH,
  targetL: number,
  curve: { light: number; dark: number },
  yellowAware: boolean = false
): OKLCH {
  // Skip hue shift for near-neutral colors (prevents grey tinting)
  if (color.c < 0.02) return color

  if (curve.light === 0 && curve.dark === 0) return color

  let hueOffset = 0

  // Check if this is a yellow hue (70-110°)
  const normalizedHue = ((color.h % 360) + 360) % 360
  const isYellow = normalizedHue >= 70 && normalizedHue <= 110

  if (yellowAware && isYellow) {
    // For yellows in Vivid mode: continuous shift toward orange
    // Shift increases as color gets darker (more orange in shadows)
    // yellowFactor: 1.0 at pure yellow (90°), tapering to 0 at zone edges (70°, 110°)
    const yellowFactor = 1 - Math.abs(normalizedHue - 90) / 20
    const maxShift = -45  // Maximum shift toward orange at L=0
    hueOffset = maxShift * (1 - targetL) * yellowFactor
  } else {
    // Standard light/dark region logic for non-yellows
    // - Light (L > 0.5): use light shift, scaled by how far from midpoint
    // - Mid (L = 0.5): no shift
    // - Dark (L < 0.5): use dark shift, scaled by how far from midpoint
    if (targetL > 0.5) {
      // Light region: interpolate from 0 at mid to full shift at extremes
      const t = (targetL - 0.5) / 0.5  // 0 at L=0.5, 1 at L=1.0
      hueOffset = curve.light * t
    } else {
      // Dark region: interpolate from 0 at mid to full shift at extremes
      const t = (0.5 - targetL) / 0.5  // 0 at L=0.5, 1 at L=0
      hueOffset = curve.dark * t
    }
  }

  const newHue = (color.h + hueOffset + 360) % 360
  return { ...color, h: newHue }
}

// ============================================
// CHROMA CURVES (Saturation distribution across lightness)
// ============================================

/**
 * Smooth step function for interpolation
 * Creates smooth transitions between control points
 */
function smoothStep(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Interpolate chroma curve based on lightness
 *
 * Uses three control points (light, mid, dark) to create a smooth
 * curve that defines chroma percentage at each lightness level.
 *
 * @param L - Target lightness (0-1)
 * @param lightPct - Chroma percentage at light end (0-100)
 * @param midPct - Chroma percentage at mid-range (0-100)
 * @param darkPct - Chroma percentage at dark end (0-100)
 * @returns Chroma multiplier percentage (0-100)
 */
function interpolateChromaCurve(
  L: number,
  lightPct: number,
  midPct: number,
  darkPct: number
): number {
  // Define lightness positions for control points
  const LIGHT_L = 0.85  // Light end (stops 50-200)
  const MID_L = 0.50    // Mid-range (stops 400-600)
  const DARK_L = 0.15   // Dark end (stops 800-950)

  if (L >= MID_L) {
    // Interpolate between mid and light
    const t = Math.max(0, Math.min(1, (L - MID_L) / (LIGHT_L - MID_L)))
    return midPct + (lightPct - midPct) * smoothStep(t)
  } else {
    // Interpolate between dark and mid
    const t = Math.max(0, Math.min(1, (L - DARK_L) / (MID_L - DARK_L)))
    return darkPct + (midPct - darkPct) * smoothStep(t)
  }
}

/**
 * Apply Chroma Curve to a Color
 *
 * Adjusts chroma based on lightness using a curve defined by three
 * control points (light, mid, dark). This enables professional-looking
 * palettes with bell-shaped saturation distributions.
 *
 * @param color - The OKLCH color to modify
 * @param lightness - The target lightness level (0-1)
 * @param curve - The chroma curve configuration
 * @returns Color with adjusted chroma
 */
export function applyChromaCurve(
  color: OKLCH,
  lightness: number,
  curve: ChromaCurve
): OKLCH {
  // If chroma is 0 (grey), no adjustment needed
  if (color.c === 0) return color

  // Get control points from preset or custom values
  let lightPct: number, midPct: number, darkPct: number

  if (curve.preset === "custom") {
    lightPct = curve.lightChroma ?? 100
    midPct = curve.midChroma ?? 100
    darkPct = curve.darkChroma ?? 100
  } else {
    const preset = CHROMA_CURVE_PRESETS[curve.preset]
    lightPct = preset.light
    midPct = preset.mid
    darkPct = preset.dark
  }

  // Get chroma multiplier for this lightness level
  const multiplier = interpolateChromaCurve(lightness, lightPct, midPct, darkPct)

  // Apply multiplier to chroma
  return { ...color, c: color.c * (multiplier / 100) }
}
