// ============================================
// DATA MODEL FOR OCTARINE
// ============================================

// Color method determines how color stops are calculated
export type ColorMethod = "lightness" | "contrast"

// ============================================
// CHROMA CURVES
// ============================================

// Preset curve types for chroma distribution across lightness
export type ChromaCurvePreset = "flat" | "bell" | "pastel" | "jewel" | "linear-fade" | "custom"

// Chroma curve configuration
export type ChromaCurve = {
  preset: ChromaCurvePreset
  lightChroma?: number   // 0-100 (only for custom)
  midChroma?: number     // 0-100 (only for custom)
  darkChroma?: number    // 0-100 (only for custom)
}

// Preset values for each curve type (percentage of base chroma)
export const CHROMA_CURVE_PRESETS: Record<Exclude<ChromaCurvePreset, "custom">, { light: number; mid: number; dark: number }> = {
  flat: { light: 100, mid: 100, dark: 100 },           // Uniform saturation (default)
  bell: { light: 45, mid: 100, dark: 65 },             // Colorful throughout, peak at mids
  pastel: { light: 30, mid: 70, dark: 50 },            // Soft but visibly colored
  jewel: { light: 55, mid: 100, dark: 85 },            // Rich and vibrant at all stops
  "linear-fade": { light: 25, mid: 60, dark: 100 }    // Fade from saturated darks to colorful lights
}

// ============================================
// HUE SHIFT CURVES
// ============================================

// Preset curve types for hue shift distribution across lightness
export type HueShiftCurvePreset = "none" | "subtle" | "natural" | "dramatic" | "custom"

// Hue shift curve configuration
export type HueShiftCurve = {
  preset: HueShiftCurvePreset
  lightShift?: number   // degrees (only for custom) - positive = toward cool/cyan
  darkShift?: number    // degrees (only for custom) - negative = toward warm/purple
}

// Preset values for hue shift curves
// Positive values = shift toward cyan/cool, negative = shift toward purple/warm
// All presets automatically use yellow-aware logic to keep yellows golden (not green)
export const HUE_SHIFT_CURVE_PRESETS: Record<Exclude<HueShiftCurvePreset, "custom">, { light: number; dark: number }> = {
  none: { light: 0, dark: 0 },              // No shift (default)
  subtle: { light: 4, dark: -5 },           // Gentle professional shift
  natural: { light: 8, dark: -10 },         // Reference palette match
  dramatic: { light: 12, dark: -15 },       // Bold artistic effect
}

// Default stop numbers
export const DEFAULT_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

// Default lightness values for each stop (0-1)
// Dark stops (700-900) use lifted values to preserve color identity.
// At L<0.20, sRGB gamut constraints limit chroma to ~0.02-0.03, making colors
// nearly indistinguishable from black. These values keep chroma ≥0.04 for
// visible color while matching industry standards (Tailwind, Primer, etc.)
export const DEFAULT_LIGHTNESS: Record<number, number> = {
  50: 0.97,
  100: 0.93,
  200: 0.85,
  300: 0.75,
  400: 0.65,
  500: 0.55,
  600: 0.45,
  700: 0.36,
  800: 0.28,
  900: 0.22,
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
  methodOverride?: ColorMethod | "global"
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
  autoLabel?: boolean  // true = name was auto-generated, can auto-update on base color change

  // Color generation method and default values (formerly on GroupSettings)
  method: ColorMethod                          // "lightness" or "contrast"
  defaultLightness: Record<number, number>     // Default lightness per stop number
  defaultContrast: Record<number, number>      // Default contrast per stop number

  // Perceptual corrections (per-color settings)
  hkCorrection?: boolean   // Helmholtz-Kohlrausch: compensates for saturated colors appearing brighter
  bbCorrection?: boolean   // Bezold-Brücke: corrects for hue shifts at different lightness levels

  // Color identity preservation (default: true)
  // When enabled, caps lightness to maintain visible color at light/dark extremes
  // Prevents blues from becoming grey at very light stops
  preserveColorIdentity?: boolean

  // Artistic shifts
  // Hue shift curve - controls hue variation across lightness levels
  hueShiftCurve?: HueShiftCurve

  // Chroma curve - controls saturation distribution across lightness levels
  chromaCurve?: ChromaCurve

  // Array of stops for this color
  stops: Stop[]
}

// ============================================
// GLOBAL CONFIG (App-wide settings)
// ============================================
export type GlobalConfig = {
  backgroundColor: string  // For contrast calculations, default "#ffffff"
}

// ============================================
// COLOR SETTINGS (For color generation functions)
// ============================================
// Combines per-color settings with backgroundColor for palette generation
export type ColorSettings = {
  method: ColorMethod
  defaultLightness: Record<number, number>
  defaultContrast: Record<number, number>
  backgroundColor: string
}

// ============================================
// APP STATE
// ============================================
export type AppState = {
  globalConfig: GlobalConfig
  colors: Color[]
}

// ============================================
// PALETTE GENERATION RESULTS
// ============================================

// Result for a single generated stop (tracks what the algorithm did)
export type GeneratedStop = {
  stopNumber: number       // e.g., 50, 100, 200
  hex: string              // Final hex color like "#E6F0FF"
  originalL: number        // Lightness before expansion
  expandedL: number        // Lightness after expansion
  wasNudged: boolean       // Was this color adjusted to be unique?
  nudgeAmount?: {          // How much was it nudged?
    lightness: number      // Lightness adjustment (positive = lighter)
    chroma: number         // Chroma adjustment (positive = more saturated)
    hue: number            // Hue adjustment in degrees (positive = clockwise)
  }
  tooSimilar?: boolean     // Is this stop too similar to previous stop (Delta-E < 5)?
  deltaE?: number          // Delta-E to previous stop (for debugging/display)
}

// Result for an entire palette (all stops for one color)
export type PaletteResult = {
  colorId: string           // ID of the Color this belongs to
  stops: GeneratedStop[]    // All generated stops
  hadDuplicates: boolean    // Were any duplicates found and fixed?
}

// Helper to create a new color with default stops and settings
export function createDefaultColor(id: string, label: string, baseColor: string): Color {
  return {
    id,
    label,
    baseColor,
    method: "lightness",
    defaultLightness: { ...DEFAULT_LIGHTNESS },
    defaultContrast: { ...DEFAULT_CONTRAST },
    stops: DEFAULT_STOPS.map(num => ({ number: num }))
  }
}

// Helper to create default global config
export function createDefaultGlobalConfig(): GlobalConfig {
  return {
    backgroundColor: "#ffffff",
  }
}

// Helper to create initial app state
export function createInitialAppState(): AppState {
  const defaultColor: Color = { ...createDefaultColor('color-1', 'RoyalBlue', '#0066CC'), autoLabel: true }
  return {
    globalConfig: createDefaultGlobalConfig(),
    colors: [defaultColor],
  }
}

// ============================================
// STATE PERSISTENCE & MIGRATION
// ============================================
export const STORAGE_KEY = 'octarine-state'
export const STORAGE_VERSION = 8  // Bumped: added autoLabel for CSS color naming

export type PersistedState = {
  version: number
  state: AppState
}

// ============================================
// OLD STATE TYPES (for migration only)
// ============================================

// Old GroupSettings type (used in v2-v6)
type OldGroupSettings = {
  method: ColorMethod
  defaultLightness: Record<number, number>
  defaultContrast: Record<number, number>
}

// Old Color type with methodOverride (used in v2-v6)
type OldColor = Omit<Color, 'method' | 'defaultLightness' | 'defaultContrast'> & {
  methodOverride?: ColorMethod
}

// Type for old v1 state format
type AppStateV1 = {
  globalSettings: OldGroupSettings & { backgroundColor?: string }
  colors: OldColor[]
}

// Type for old v2 state format
type AppStateV2 = {
  groups: Array<{
    id: string
    name: string
    settings: OldGroupSettings & { backgroundColor?: string }
    colors: OldColor[]
  }>
  activeGroupId: string | null
}

// Type for old v3-v6 state format (groups-based)
type AppStateV3V6 = {
  globalConfig: GlobalConfig
  groups: Array<{
    id: string
    name: string
    settings: OldGroupSettings & { lightnessCurve?: unknown; contrastCurve?: unknown }
    colors: OldColor[]
  }>
  activeGroupId: string | null
  expandedGroupId?: string | null
}

// Helper: flatten groups into colors for v6→v7 migration
function flattenGroupsToColors(groups: AppStateV3V6['groups']): Color[] {
  const colors: Color[] = []
  for (const group of groups) {
    // Strip curve fields from settings if present
    const { lightnessCurve: _lc, contrastCurve: _cc, ...cleanSettings } = group.settings
    for (const oldColor of group.colors) {
      // Resolve methodOverride: color override wins, else group method
      const { methodOverride, ...colorWithoutOverride } = oldColor as OldColor & { methodOverride?: ColorMethod }
      const color: Color = {
        ...colorWithoutOverride,
        method: methodOverride ?? cleanSettings.method,
        defaultLightness: { ...cleanSettings.defaultLightness },
        defaultContrast: { ...cleanSettings.defaultContrast },
      }
      colors.push(color)
    }
  }
  return colors
}

// Migrate from older versions to current
export function migrateState(persisted: { version: number; state: unknown }): AppState {
  // Basic shape validation -- if data is corrupt, return fresh defaults
  if (!persisted.state || typeof persisted.state !== 'object') {
    return createInitialAppState()
  }

  // v1: Old flat format { globalSettings, colors }
  // Convert to v3-v6 group format, then fall through to v6→v7
  if (persisted.version === 1) {
    const oldState = persisted.state as AppStateV1
    const backgroundColor = oldState.globalSettings.backgroundColor ?? "#ffffff"
    const { backgroundColor: _, ...groupSettings } = oldState.globalSettings as (OldGroupSettings & { backgroundColor?: string })
    const asV6: AppStateV3V6 = {
      globalConfig: { backgroundColor },
      groups: [{
        id: 'group-default',
        name: 'Colors',
        settings: groupSettings,
        colors: oldState.colors ?? []
      }],
      activeGroupId: 'group-default',
    }
    return {
      globalConfig: asV6.globalConfig,
      colors: flattenGroupsToColors(asV6.groups),
    }
  }

  // v2: Groups with per-group backgroundColor
  // Convert to v3-v6 format, then flatten
  if (persisted.version === 2) {
    const oldState = persisted.state as AppStateV2
    const backgroundColor = oldState.groups[0]?.settings?.backgroundColor ?? "#ffffff"
    const groups = oldState.groups.map(g => {
      const { backgroundColor: _, ...groupSettings } = g.settings as (OldGroupSettings & { backgroundColor?: string })
      return { ...g, settings: groupSettings }
    })
    return {
      globalConfig: { backgroundColor },
      colors: flattenGroupsToColors(groups),
    }
  }

  // v3: Migrate "vivid" hue shift → "dramatic", then flatten
  if (persisted.version === 3) {
    const oldState = persisted.state as AppStateV3V6
    const groups = oldState.groups.map(group => ({
      ...group,
      colors: group.colors.map(color => {
        if ((color.hueShiftCurve?.preset as string) === "vivid") {
          return { ...color, hueShiftCurve: { ...color.hueShiftCurve, preset: "dramatic" as HueShiftCurvePreset } }
        }
        return color
      })
    }))
    return {
      globalConfig: oldState.globalConfig,
      colors: flattenGroupsToColors(groups),
    }
  }

  // v4: Same as v3-v6 format, just flatten
  if (persisted.version === 4) {
    const oldState = persisted.state as AppStateV3V6
    return {
      globalConfig: oldState.globalConfig,
      colors: flattenGroupsToColors(oldState.groups),
    }
  }

  // v5: Strip curve-based stop value fields, then flatten
  if (persisted.version === 5) {
    const oldState = persisted.state as AppStateV3V6
    return {
      globalConfig: oldState.globalConfig,
      colors: flattenGroupsToColors(oldState.groups),
    }
  }

  // v6: Groups-based format — flatten to per-color model
  if (persisted.version === 6) {
    const oldState = persisted.state as AppStateV3V6
    if (!Array.isArray(oldState.groups) || !oldState.globalConfig) {
      return createInitialAppState()
    }
    return {
      globalConfig: oldState.globalConfig,
      colors: flattenGroupsToColors(oldState.groups),
    }
  }

  // v7 or newer - validate basic shape before casting
  const candidate = persisted.state as Record<string, unknown>
  if (!Array.isArray(candidate.colors) || !candidate.globalConfig) {
    return createInitialAppState()
  }
  return persisted.state as AppState
}

// ============================================
// EXPORT TYPES
// ============================================

// CSS color format options for export
export type CSSColorFormat = "hex" | "rgb" | "oklch" | "hsl"

// Export format options
export type ExportFormat = "css" | "json" | "oklch-raw" | "figma"

// Structured color data for export (includes all formats needed)
export type ExportableStop = {
  colorLabel: string
  stopNumber: number
  hex: string
  oklch: { l: number; c: number; h: number }
}
