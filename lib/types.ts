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

  // Override global settings for this color
  methodOverride?: ColorMethod

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
// GROUP SETTINGS (Per-group settings)
// ============================================
export type GroupSettings = {
  method: ColorMethod      // "lightness" or "contrast"

  // Default lightness/contrast values per stop number
  defaultLightness: Record<number, number>
  defaultContrast: Record<number, number>
}

// Alias for backward compatibility
export type GlobalSettings = GroupSettings

// ============================================
// GLOBAL CONFIG (App-wide settings)
// ============================================
export type GlobalConfig = {
  backgroundColor: string  // For contrast calculations, default "#ffffff"
}

// ============================================
// EFFECTIVE SETTINGS (Combined for color generation)
// ============================================
// This type combines GroupSettings with backgroundColor for use in
// color generation functions that need both
export type EffectiveSettings = GroupSettings & {
  backgroundColor: string
}

// ============================================
// COLOR GROUP
// ============================================
export type ColorGroup = {
  id: string
  name: string              // e.g., "Brand", "Semantic", "Neutrals"
  settings: GroupSettings   // Per-group settings (bg color, method, defaults)
  colors: Color[]           // Colors in this group
}

// ============================================
// APP STATE
// ============================================
export type AppState = {
  globalConfig: GlobalConfig
  groups: ColorGroup[]
  activeGroupId: string | null  // Which group is currently selected/expanded
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

// Helper to create a new color with default stops
export function createDefaultColor(id: string, label: string, baseColor: string): Color {
  return {
    id,
    label,
    baseColor,
    stops: DEFAULT_STOPS.map(num => ({ number: num }))
  }
}

// Helper to create default group settings
export function createDefaultGroupSettings(): GroupSettings {
  return {
    method: "lightness",
    defaultLightness: { ...DEFAULT_LIGHTNESS },
    defaultContrast: { ...DEFAULT_CONTRAST },
  }
}

// Alias for backward compatibility
export const createDefaultGlobalSettings = createDefaultGroupSettings

// Helper to create default global config
export function createDefaultGlobalConfig(): GlobalConfig {
  return {
    backgroundColor: "#ffffff",
  }
}

// Helper to create a new color group
export function createDefaultGroup(id: string, name: string): ColorGroup {
  return {
    id,
    name,
    settings: createDefaultGroupSettings(),
    colors: []
  }
}

// Helper to create initial app state
export function createInitialAppState(): AppState {
  const defaultGroup = createDefaultGroup('group-1', '')
  return {
    globalConfig: createDefaultGlobalConfig(),
    groups: [defaultGroup],
    activeGroupId: defaultGroup.id
  }
}

// ============================================
// STATE PERSISTENCE & MIGRATION
// ============================================
export const STORAGE_KEY = 'octarine-state'
export const STORAGE_VERSION = 4  // Bumped for vivid -> dramatic migration

export type PersistedState = {
  version: number
  state: AppState
}

// Type for old v1 state format (for migration)
type AppStateV1 = {
  globalSettings: GlobalSettings & { backgroundColor?: string }
  colors: Color[]
}

// Type for old v2 state format (for migration)
type AppStateV2 = {
  groups: Array<{
    id: string
    name: string
    settings: GroupSettings & { backgroundColor?: string }
    colors: Color[]
  }>
  activeGroupId: string | null
}

// Migrate from older versions to current
export function migrateState(persisted: { version: number; state: unknown }): AppState {
  if (persisted.version === 1) {
    // Old format: { globalSettings, colors }
    const oldState = persisted.state as AppStateV1
    // Extract backgroundColor from old globalSettings for the new globalConfig
    const backgroundColor = oldState.globalSettings.backgroundColor ?? "#ffffff"
    // Remove backgroundColor from settings for the group
    const { backgroundColor: _, ...groupSettings } = oldState.globalSettings as (GroupSettings & { backgroundColor?: string })
    const defaultGroup: ColorGroup = {
      id: 'group-default',
      name: 'Colors',
      settings: groupSettings,
      colors: oldState.colors ?? []
    }
    return {
      globalConfig: { backgroundColor },
      groups: [defaultGroup],
      activeGroupId: defaultGroup.id
    }
  }

  if (persisted.version === 2) {
    // v2 format: groups with per-group backgroundColor
    const oldState = persisted.state as AppStateV2
    // Extract backgroundColor from first group (or default to white)
    const backgroundColor = oldState.groups[0]?.settings?.backgroundColor ?? "#ffffff"
    // Migrate all groups, removing backgroundColor from their settings
    const migratedGroups: ColorGroup[] = oldState.groups.map(g => {
      const { backgroundColor: _, ...groupSettings } = g.settings as (GroupSettings & { backgroundColor?: string })
      return {
        ...g,
        settings: groupSettings
      }
    })
    return {
      globalConfig: { backgroundColor },
      groups: migratedGroups,
      activeGroupId: oldState.activeGroupId
    }
  }

  // v3: Need to migrate "vivid" hue shift preset to "dramatic"
  if (persisted.version === 3) {
    const oldState = persisted.state as AppState
    const migratedGroups = oldState.groups.map(group => ({
      ...group,
      colors: group.colors.map(color => {
        // If color has vivid hue shift, change to dramatic
        // Cast to string since "vivid" is no longer in the type
        if ((color.hueShiftCurve?.preset as string) === "vivid") {
          return {
            ...color,
            hueShiftCurve: { ...color.hueShiftCurve, preset: "dramatic" as HueShiftCurvePreset }
          }
        }
        return color
      })
    }))
    return {
      ...oldState,
      groups: migratedGroups
    }
  }

  // Already v4 or newer
  return persisted.state as AppState
}
