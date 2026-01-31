/**
 * Color Output Comparison Script
 *
 * This script generates color palettes for a variety of test cases and outputs
 * them as JSON. By running this on both the main branch (original code) and
 * dev branch (refactored code), we can verify that the refactoring produces
 * identical outputs.
 *
 * Usage:
 *   npx tsx scripts/compare-color-outputs.ts > outputs.json
 */

import { generateColorPalette } from "../lib/color-utils"
import type { Color, EffectiveSettings, HueShiftCurve, ChromaCurve } from "../lib/types"
import { DEFAULT_STOPS, DEFAULT_LIGHTNESS, DEFAULT_CONTRAST } from "../lib/types"

// Create default stops array for test colors
function createStops() {
  return DEFAULT_STOPS.map(num => ({ number: num }))
}

// Create a test color configuration
function createTestColor(
  baseColor: string,
  options?: {
    hkCorrection?: boolean
    bbCorrection?: boolean
    hueShiftCurve?: HueShiftCurve
    chromaCurve?: ChromaCurve
    preserveColorIdentity?: boolean
  }
): Color {
  return {
    id: "test-color",
    label: "Test",
    baseColor,
    hkCorrection: options?.hkCorrection,
    bbCorrection: options?.bbCorrection,
    hueShiftCurve: options?.hueShiftCurve,
    chromaCurve: options?.chromaCurve,
    preserveColorIdentity: options?.preserveColorIdentity,
    stops: createStops()
  }
}

// Create effective settings for testing
function createSettings(method: "lightness" | "contrast" = "lightness"): EffectiveSettings {
  return {
    method,
    defaultLightness: { ...DEFAULT_LIGHTNESS },
    defaultContrast: { ...DEFAULT_CONTRAST },
    backgroundColor: "#ffffff"
  }
}

// Define all test cases
interface TestCase {
  label: string
  color: Color
  settings: EffectiveSettings
}

const testCases: TestCase[] = [
  // ==========================================
  // BASIC COLORS - Lightness Mode
  // ==========================================
  {
    label: "red-basic",
    color: createTestColor("#ff0000"),
    settings: createSettings("lightness")
  },
  {
    label: "green-basic",
    color: createTestColor("#00ff00"),
    settings: createSettings("lightness")
  },
  {
    label: "blue-basic",
    color: createTestColor("#0000ff"),
    settings: createSettings("lightness")
  },
  {
    label: "yellow-basic",
    color: createTestColor("#ffff00"),
    settings: createSettings("lightness")
  },
  {
    label: "orange-basic",
    color: createTestColor("#ff8000"),
    settings: createSettings("lightness")
  },
  {
    label: "gray-basic",
    color: createTestColor("#808080"),
    settings: createSettings("lightness")
  },
  {
    label: "cyan-basic",
    color: createTestColor("#00ffff"),
    settings: createSettings("lightness")
  },
  {
    label: "magenta-basic",
    color: createTestColor("#ff00ff"),
    settings: createSettings("lightness")
  },

  // ==========================================
  // BASIC COLORS - Contrast Mode
  // ==========================================
  {
    label: "red-contrast",
    color: createTestColor("#ff0000"),
    settings: createSettings("contrast")
  },
  {
    label: "blue-contrast",
    color: createTestColor("#0000ff"),
    settings: createSettings("contrast")
  },
  {
    label: "yellow-contrast",
    color: createTestColor("#ffff00"),
    settings: createSettings("contrast")
  },

  // ==========================================
  // WITH HK CORRECTION
  // ==========================================
  {
    label: "red-hk",
    color: createTestColor("#ff0000", { hkCorrection: true }),
    settings: createSettings("lightness")
  },
  {
    label: "green-hk",
    color: createTestColor("#00ff00", { hkCorrection: true }),
    settings: createSettings("lightness")
  },
  {
    label: "blue-hk",
    color: createTestColor("#0000ff", { hkCorrection: true }),
    settings: createSettings("lightness")
  },
  {
    label: "magenta-hk",
    color: createTestColor("#ff00ff", { hkCorrection: true }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // WITH BB CORRECTION
  // ==========================================
  {
    label: "red-bb",
    color: createTestColor("#ff0000", { bbCorrection: true }),
    settings: createSettings("lightness")
  },
  {
    label: "blue-bb",
    color: createTestColor("#0000ff", { bbCorrection: true }),
    settings: createSettings("lightness")
  },
  {
    label: "yellow-bb",
    color: createTestColor("#ffff00", { bbCorrection: true }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // WITH BOTH HK AND BB
  // ==========================================
  {
    label: "red-hk-bb",
    color: createTestColor("#ff0000", { hkCorrection: true, bbCorrection: true }),
    settings: createSettings("lightness")
  },
  {
    label: "blue-hk-bb",
    color: createTestColor("#0000ff", { hkCorrection: true, bbCorrection: true }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // HUE SHIFT CURVES - PRESETS
  // ==========================================
  {
    label: "red-hue-subtle",
    color: createTestColor("#ff0000", {
      hueShiftCurve: { preset: "subtle" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "red-hue-natural",
    color: createTestColor("#ff0000", {
      hueShiftCurve: { preset: "natural" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "red-hue-dramatic",
    color: createTestColor("#ff0000", {
      hueShiftCurve: { preset: "dramatic" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "blue-hue-natural",
    color: createTestColor("#0000ff", {
      hueShiftCurve: { preset: "natural" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "yellow-hue-natural",
    color: createTestColor("#ffff00", {
      hueShiftCurve: { preset: "natural" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "orange-hue-dramatic",
    color: createTestColor("#ff8000", {
      hueShiftCurve: { preset: "dramatic" }
    }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // HUE SHIFT CURVES - CUSTOM
  // ==========================================
  {
    label: "red-hue-custom-warm",
    color: createTestColor("#ff0000", {
      hueShiftCurve: { preset: "custom", lightShift: 10, darkShift: -15 }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "blue-hue-custom-cool",
    color: createTestColor("#0000ff", {
      hueShiftCurve: { preset: "custom", lightShift: -5, darkShift: 10 }
    }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // CHROMA CURVES - PRESETS
  // ==========================================
  {
    label: "red-chroma-bell",
    color: createTestColor("#ff0000", {
      chromaCurve: { preset: "bell" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "red-chroma-pastel",
    color: createTestColor("#ff0000", {
      chromaCurve: { preset: "pastel" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "red-chroma-jewel",
    color: createTestColor("#ff0000", {
      chromaCurve: { preset: "jewel" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "red-chroma-linear-fade",
    color: createTestColor("#ff0000", {
      chromaCurve: { preset: "linear-fade" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "blue-chroma-bell",
    color: createTestColor("#0000ff", {
      chromaCurve: { preset: "bell" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "yellow-chroma-jewel",
    color: createTestColor("#ffff00", {
      chromaCurve: { preset: "jewel" }
    }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // CHROMA CURVES - CUSTOM
  // ==========================================
  {
    label: "red-chroma-custom",
    color: createTestColor("#ff0000", {
      chromaCurve: { preset: "custom", lightChroma: 30, midChroma: 100, darkChroma: 70 }
    }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // COMBINED HUE + CHROMA CURVES
  // ==========================================
  {
    label: "red-hue-natural-chroma-bell",
    color: createTestColor("#ff0000", {
      hueShiftCurve: { preset: "natural" },
      chromaCurve: { preset: "bell" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "blue-hue-dramatic-chroma-jewel",
    color: createTestColor("#0000ff", {
      hueShiftCurve: { preset: "dramatic" },
      chromaCurve: { preset: "jewel" }
    }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // COMBINED CORRECTIONS + CURVES
  // ==========================================
  {
    label: "red-hk-hue-natural",
    color: createTestColor("#ff0000", {
      hkCorrection: true,
      hueShiftCurve: { preset: "natural" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "blue-bb-chroma-bell",
    color: createTestColor("#0000ff", {
      bbCorrection: true,
      chromaCurve: { preset: "bell" }
    }),
    settings: createSettings("lightness")
  },
  {
    label: "red-full-stack",
    color: createTestColor("#ff0000", {
      hkCorrection: true,
      bbCorrection: true,
      hueShiftCurve: { preset: "natural" },
      chromaCurve: { preset: "bell" }
    }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // EDGE CASES - EXTREME LIGHTNESS
  // ==========================================
  {
    label: "very-light-gray",
    color: createTestColor("#f0f0f0"),
    settings: createSettings("lightness")
  },
  {
    label: "very-dark-gray",
    color: createTestColor("#101010"),
    settings: createSettings("lightness")
  },
  {
    label: "very-light-blue",
    color: createTestColor("#e0e8ff"),
    settings: createSettings("lightness")
  },
  {
    label: "very-dark-blue",
    color: createTestColor("#000030"),
    settings: createSettings("lightness")
  },

  // ==========================================
  // EDGE CASES - PRESERVE COLOR IDENTITY
  // ==========================================
  {
    label: "blue-preserve-identity-on",
    color: createTestColor("#0000ff", { preserveColorIdentity: true }),
    settings: createSettings("lightness")
  },
  {
    label: "blue-preserve-identity-off",
    color: createTestColor("#0000ff", { preserveColorIdentity: false }),
    settings: createSettings("lightness")
  },

  // ==========================================
  // CONTRAST MODE WITH CORRECTIONS
  // ==========================================
  {
    label: "red-contrast-hk",
    color: createTestColor("#ff0000", { hkCorrection: true }),
    settings: createSettings("contrast")
  },
  {
    label: "blue-contrast-hue-natural",
    color: createTestColor("#0000ff", {
      hueShiftCurve: { preset: "natural" }
    }),
    settings: createSettings("contrast")
  },

  // ==========================================
  // DARK BACKGROUND
  // ==========================================
  {
    label: "red-dark-bg",
    color: createTestColor("#ff0000"),
    settings: {
      ...createSettings("lightness"),
      backgroundColor: "#1a1a1a"
    }
  },
  {
    label: "blue-dark-bg-contrast",
    color: createTestColor("#0000ff"),
    settings: {
      ...createSettings("contrast"),
      backgroundColor: "#1a1a1a"
    }
  },
  {
    label: "yellow-dark-bg-hk",
    color: createTestColor("#ffff00", { hkCorrection: true }),
    settings: {
      ...createSettings("lightness"),
      backgroundColor: "#1a1a1a"
    }
  },

  // ==========================================
  // REAL-WORLD BRAND COLORS
  // ==========================================
  {
    label: "brand-blue",
    color: createTestColor("#0066cc"),
    settings: createSettings("lightness")
  },
  {
    label: "brand-purple",
    color: createTestColor("#6b21a8"),
    settings: createSettings("lightness")
  },
  {
    label: "brand-teal",
    color: createTestColor("#0d9488"),
    settings: createSettings("lightness")
  },
  {
    label: "brand-coral",
    color: createTestColor("#f97316"),
    settings: createSettings("lightness")
  },
]

// Generate all palettes
interface TestResult {
  label: string
  baseColor: string
  method: string
  backgroundColor: string
  options: {
    hkCorrection?: boolean
    bbCorrection?: boolean
    hueShiftCurve?: HueShiftCurve
    chromaCurve?: ChromaCurve
    preserveColorIdentity?: boolean
  }
  stops: Array<{
    number: number
    hex: string
    wasNudged: boolean
  }>
  hadDuplicates: boolean
}

const results: TestResult[] = testCases.map(tc => {
  const palette = generateColorPalette(tc.color, tc.settings)

  return {
    label: tc.label,
    baseColor: tc.color.baseColor,
    method: tc.settings.method,
    backgroundColor: tc.settings.backgroundColor,
    options: {
      hkCorrection: tc.color.hkCorrection,
      bbCorrection: tc.color.bbCorrection,
      hueShiftCurve: tc.color.hueShiftCurve,
      chromaCurve: tc.color.chromaCurve,
      preserveColorIdentity: tc.color.preserveColorIdentity,
    },
    stops: palette.stops.map(s => ({
      number: s.stopNumber,
      hex: s.hex,
      wasNudged: s.wasNudged
    })),
    hadDuplicates: palette.hadDuplicates
  }
})

// Output as JSON
console.log(JSON.stringify(results, null, 2))
