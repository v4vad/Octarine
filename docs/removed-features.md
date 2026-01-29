# Removed Features

This document archives features that have been removed from Octarine, explaining what they did and why they were removed. This serves as a reference if these concepts need to be revisited.

---

## Smart Auto Hue Shift (Saturation Recovery)

**Removed:** January 2026

### What It Did

Smart Auto Hue Shift was a per-color toggle that automatically shifted the hue slightly at extreme lightness levels to preserve more saturation (chroma) when colors would otherwise be clipped by the sRGB gamut.

**UI location:** Color settings popup under "Saturation Recovery"

**Behavior:**
- When enabled, the algorithm searched nearby hues (up to ±30°) for one with more gamut room
- Only triggered when saturation loss exceeded 25%
- Required at least 10% improvement to actually apply the shift
- Prioritized smaller hue shifts over larger ones

**Example:** Orange (#F32C01) at lightness 0.85 would lose ~65% of its saturation due to sRGB gamut limits. Shifting the hue ~25° toward yellow could theoretically recover some of that saturation.

### Why It Was Removed

The feature didn't solve the problem well due to fundamental physics of the sRGB color space:

1. **At mild lightness (L=0.85, stop 200):** The saturation loss was often below the 25% threshold, so the feature didn't trigger even though colors looked slightly washed out

2. **At moderate lightness (L=0.75, stop 300):** When it did trigger, the required hue shift was so large (20-30°) that the resulting color looked noticeably different from the base color—an orange looked yellow-ish

3. **The underlying problem is unsolvable with hue rotation alone:** The sRGB gamut is simply smaller at high and low lightness levels. There's no "trick" that can make a fully saturated orange exist at L=0.85 in sRGB—it's physically impossible in that color space.

**The core insight:** This was attempting to work around a hardware limitation (sRGB monitors) with a software hack. The solution created a new problem (color identity loss) while only partially addressing the original (saturation loss).

### The sRGB Gamut Limitation (Important Context)

This feature was built on the gamut lookup table (`lib/gamut-table.ts`) which maps the maximum chroma achievable at each lightness/hue combination in sRGB. Key observations:

**Gamut shape varies by hue:**
- Yellow (~90°) has excellent gamut at high lightness—you CAN have bright, saturated yellows
- Blue (~270°) has excellent gamut at low lightness—you CAN have dark, saturated blues
- Orange (~45°) and other intermediate hues have more limited gamut at extremes

**What this means for palette design:**
- Some colors will inevitably lose saturation at light/dark stops
- This is physics, not a bug—sRGB simply can't represent those colors
- Wider gamut displays (P3, Rec.2020) can show more saturated colors, but most design targets sRGB for compatibility

**Practical guidance:**
- Accept that light stops (50-200) will be less saturated for most hues
- Accept that dark stops (800-900) will be less saturated for most hues
- If saturation preservation is critical, choose base colors that have favorable gamut at your target lightness levels (e.g., yellow for light palettes, blue for dark palettes)

### Original Code

The main function lived in `lib/color-utils.ts`:

```typescript
export function findBetterHueForGamut(
  baseChroma: number,
  baseHue: number,
  lightness: number,
  maxShift: number = 30,
  lossThreshold: number = 0.25
): { hue: number; shifted: boolean; originalLoss: number; newLoss: number } {
  const maxChromaAtCurrentHue = getMaxChroma(lightness, baseHue)

  const currentLoss = baseChroma > 0
    ? Math.max(0, (baseChroma - maxChromaAtCurrentHue) / baseChroma)
    : 0

  if (currentLoss < lossThreshold) {
    return { hue: baseHue, shifted: false, originalLoss: currentLoss, newLoss: currentLoss }
  }

  let bestHue = baseHue
  let bestLoss = currentLoss

  for (let offset = 1; offset <= maxShift; offset++) {
    const huePos = (baseHue + offset) % 360
    const maxChromaPos = getMaxChroma(lightness, huePos)
    const lossPos = baseChroma > 0
      ? Math.max(0, (baseChroma - maxChromaPos) / baseChroma)
      : 0
    if (lossPos < bestLoss) {
      bestLoss = lossPos
      bestHue = huePos
    }
    // ... also tries negative direction
  }

  const improvement = currentLoss - bestLoss
  if (improvement >= 0.1) {
    return { hue: bestHue, shifted: true, originalLoss: currentLoss, newLoss: bestLoss }
  }
  return { hue: baseHue, shifted: false, originalLoss: currentLoss, newLoss: currentLoss }
}
```

### Related Types (Removed)

```typescript
// In Color type
smartAutoHueShift?: boolean
```

### If Revisiting

If you want to address saturation loss in the future, consider:

1. **Display P3 / wide gamut support** - Export colors in a wider gamut color space for devices that support it (would require Figma API changes)

2. **Visual indicator only** - Show users which stops are losing saturation (a warning icon or percentage) without trying to "fix" it automatically

3. **Guided base color selection** - Help users pick base colors that work well across their target lightness range, rather than trying to rescue bad combinations after the fact

4. **Per-stop hue adjustment (manual)** - Let users intentionally shift hue at specific stops if they want warmer lights / cooler darks as an artistic choice (this already exists via the Hue Shift feature, which is different from automatic gamut recovery)

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

---

## Vivid Hue Shift Preset

**Removed:** January 2026

### What It Did

"Vivid" was a hue shift preset that had the same shift values as "Dramatic" (+12° light, -15° dark) but with special handling for yellow hues.

**Behavior:**
- For non-yellow colors: identical to "Dramatic"
- For yellows (hue 70-110°): shifted toward golden/amber instead of applying the standard shift that would push yellows toward green

**The problem it solved:** Standard hue shifts toward cyan in light stops caused yellows to look olive/muddy instead of golden.

### Why It Was Removed

The yellow-aware logic was merged into ALL presets, making "Vivid" redundant.

**Before:**
- "Dramatic" = +12°/-15° shifts, yellows turn greenish
- "Vivid" = +12°/-15° shifts, yellows stay golden

**After:**
- "Dramatic" = +12°/-15° shifts, yellows automatically stay golden
- All other presets (Subtle, Natural) also have automatic yellow handling
- Only "Custom" mode bypasses the yellow-aware logic (for users who want full control)

**Benefits:**
- Simpler dropdown with one less option
- No confusion about two presets with identical numbers
- Better default behavior for all presets

### Migration

Saved palettes using "Vivid" are automatically migrated to "Dramatic" when loaded. Since the yellow-aware logic is now applied to all presets, the visual result is identical.

### If Revisiting

If you need to differentiate presets with the same shift values:
- Consider whether the difference is meaningful enough to warrant a separate preset
- Automatic intelligent handling (like yellow-awareness) is usually better than manual mode selection
