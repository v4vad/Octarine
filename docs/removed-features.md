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
