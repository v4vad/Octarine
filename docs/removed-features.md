# Removed Features

This document archives features that have been removed from Octarine, explaining what they did and why they were removed. This serves as a reference if these concepts need to be revisited.

---

## Lightness Expansion

**Removed:** January 2026

### What It Did

Lightness Expansion was a feature that spread colors away from mid-lightness (0.5) to help prevent duplicate hex colors in a palette.

**Formula:**
```
expandedL = 0.5 + (originalL - 0.5) × factor
```

**Behavior:**
- `factor = 1.0`: No change
- `factor > 1.0`: Light colors become lighter, dark colors become darker
- `factor < 1.0`: All colors compress toward middle gray

**Example:** With factor 1.5, a color at lightness 0.6 would become:
```
0.5 + (0.6 - 0.5) × 1.5 = 0.5 + 0.15 = 0.65
```

### Why It Was Removed

The feature became redundant after implementing smart auto-nudging (`ensureUniqueHexColors()`).

**Auto-nudging is better because:**
1. **Targeted** - Only adjusts colors that are actually duplicates, not the entire palette
2. **Smart priority** - Tries hue shifts first (no contrast impact), then chroma, then lightness
3. **Contrast-aware** - When lightness nudging is needed, it knows which direction preserves target contrast ratios
4. **Automatic** - No user configuration needed

**Lightness expansion drawbacks:**
- Applied blindly to ALL colors, even those that didn't need it
- Could push colors further from intended contrast targets
- Added UI complexity (global slider + per-color override)

### Original Code

The function lived in `lib/color-utils.ts`:

```typescript
export function applyLightnessExpansion(lightness: number, factor: number): number {
  if (factor === 1.0) return lightness

  // Expand around the midpoint (0.5)
  const expandedL = 0.5 + (lightness - 0.5) * factor

  // Clamp to valid range
  return Math.max(0, Math.min(1, expandedL))
}
```

### Related Types (Removed)

```typescript
// In GlobalSettings
lightnessExpansion: number  // default: 1.0

// In Color
lightnessExpansionOverride?: number
```

### If Revisiting

If you need similar functionality in the future:
- Consider if auto-nudging already handles your use case
- If you want **artistic spread** (not duplicate prevention), that's a different feature - perhaps "Palette Spread" or "Contrast Emphasis" that explicitly doesn't claim to fix duplicates

---

## Global HK/BB Corrections

**Removed:** January 2026

### What It Did

Global toggles for Helmholtz-Kohlrausch (HK) and Bezold-Brücke (BB) corrections that applied to all colors by default. Individual colors could override these global settings.

**UI location:** Left panel under "Global settings"

**Behavior:**
- When global HK was enabled, all colors would receive HK compensation unless they had an explicit override
- When global BB was enabled, all colors would receive BB correction unless they had an explicit override
- Per-color settings showed "(Global)" or "(Override)" to indicate the source

### Why It Was Removed

HK and BB corrections are fundamentally **per-color effects** that depend on each color's specific properties:

**HK Correction (Helmholtz-Kohlrausch):**
- Compensates for saturated colors appearing brighter
- Effect varies dramatically by hue: blues need ~5x more correction than yellows
- Effect scales with saturation: neutral grays need zero correction

**BB Correction (Bezold-Brücke):**
- Compensates for hue shifts at different lightness levels
- Different hues shift toward different attractors (yellow/blue at high lightness, red/green at low lightness)
- Effect depends on both hue and lightness

**The problem with global toggles:**
- Implied uniform behavior when the actual effect varies per color
- A "global on" setting for HK made little sense: a neutral gray doesn't need it, while a saturated blue does
- Added UI complexity without meaningful benefit
- Per-color control is more intuitive and accurate

### Current Behavior

HK and BB corrections are now per-color settings only:
- Found in each color's settings popup (click the "settings" button on a color row)
- Default is OFF for new colors
- No global setting to inherit from

### Related Types (Removed)

```typescript
// Removed from GlobalSettings
hkCorrection: boolean
bbCorrection: boolean

// Renamed in Color type
hkCorrectionOverride?: boolean  // Now: hkCorrection?: boolean
bbCorrectionOverride?: boolean  // Now: bbCorrection?: boolean
```

### If Revisiting

If you want to apply corrections to multiple colors at once:
- Consider a "batch edit" feature that lets you select multiple colors and toggle settings
- Or a "preset" system that applies a bundle of settings to new colors
