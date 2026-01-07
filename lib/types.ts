// ============================================
// DATA MODEL FOR OCTARINE
// ============================================

// Color mode determines how color stops are calculated
export type ColorMode = "lightness" | "contrast"

// Default stop numbers
export const DEFAULT_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

// Default lightness values for each stop (0-1)
export const DEFAULT_LIGHTNESS: Record<number, number> = {
  50: 0.97,
  100: 0.93,
  200: 0.85,
  300: 0.75,
  400: 0.65,
  500: 0.55,
  600: 0.45,
  700: 0.35,
  800: 0.25,
  900: 0.15,
}

// Default contrast values for each stop (WCAG ratio)
export const DEFAULT_CONTRAST: Record<number, number> = {
  50: 1.1,
  100: 1.3,
  200: 1.8,
  300: 2.5,
  400: 3.5,
  500: 4.5,
  600: 6,
  700: 8,
  800: 11,
  900: 15,
}

// ============================================
// COLOR STOP (used by generateColor function)
// ============================================
export type ColorStop = {
  lightness?: number
  contrast?: number
  manualOverride?: {
    l: number
    c: number
    h: number
  }
  modeOverride?: ColorMode | "global"
  applyCorrectionsToManual?: boolean
}

// ============================================
// STOP (UI data model with full features)
// ============================================
export type Stop = {
  number: number  // e.g., 50, 100, 200

  // Override lightness/contrast for this specific stop
  lightnessOverride?: number
  contrastOverride?: number

  // Override hue/saturation shift for this stop
  hueShiftOverride?: number
  saturationShiftOverride?: number

  // Manual color override (via color picker)
  manualOverride?: {
    l: number  // Lightness (0-1)
    c: number  // Chroma
    h: number  // Hue (0-360)
  }

  // If manual override is set, should corrections still apply?
  applyCorrectionsToManual?: boolean
}

// ============================================
// COLOR
// ============================================
export type Color = {
  id: string
  label: string       // e.g., "Primary", "Blue"
  baseColor: string   // Hex color like "#0066CC"

  // Override global settings for this color
  modeOverride?: ColorMode
  hkCorrectionOverride?: boolean
  bbCorrectionOverride?: boolean

  // Artistic shifts (only at color level and stop level)
  hueShift?: number                                     // 0-100
  hueShiftDirection?: "warm-cool" | "cool-warm"         // Default: warm-cool
  saturationShift?: number                              // 0-100
  saturationShiftDirection?: "vivid-muted" | "muted-vivid"  // Default: vivid-muted

  // Array of stops for this color
  stops: Stop[]
}

// ============================================
// GLOBAL SETTINGS
// ============================================
export type GlobalSettings = {
  backgroundColor: string  // For contrast calculations, default "#ffffff"
  mode: ColorMode          // "lightness" or "contrast"
  hkCorrection: boolean    // Helmholtz-Kohlrausch compensation
  bbCorrection: boolean    // Bezold-Brücke correction

  // Default lightness/contrast values per stop number
  defaultLightness: Record<number, number>
  defaultContrast: Record<number, number>
}

// ============================================
// APP STATE
// ============================================
export type AppState = {
  globalSettings: GlobalSettings
  colors: Color[]
}

// Helper to create a new color with default stops
export function createDefaultColor(id: string, label: string, baseColor: string): Color {
  return {
    id,
    label,
    baseColor,
    stops: DEFAULT_STOPS.map(num => ({ number: num }))
  }
}

// Helper to create default global settings
export function createDefaultGlobalSettings(): GlobalSettings {
  return {
    backgroundColor: "#ffffff",
    mode: "lightness",
    hkCorrection: false,
    bbCorrection: false,
    defaultLightness: { ...DEFAULT_LIGHTNESS },
    defaultContrast: { ...DEFAULT_CONTRAST }
  }
}
