# lib/ - Color Algorithm Modules

Core color generation logic for Octarine. Uses OKLCH color space via the `culori` library.

## Module Overview

| Module | Purpose |
|--------|---------|
| `types.ts` | TypeScript interfaces, presets, constants |
| `color-utils.ts` | Main entry point - re-exports everything, contains `generateColorPalette()` |
| `color-conversions.ts` | Hex/RGB/OKLCH conversions |
| `gamut-utils.ts` | sRGB boundary checking via culori |
| `contrast-utils.ts` | WCAG contrast ratio calculations |
| `perceptual-corrections.ts` | HK effect (saturated = brighter) and BB shift (hue shifts with lightness) |
| `artistic-curves.ts` | Hue shift and chroma curves for professional-looking palettes |
| `color-distinctness.ts` | Delta-E calculation, duplicate detection |
| `export-utils.ts` | CSS/JSON/Tailwind export formats |

## Dependencies

```
types.ts (no deps)
    ↓
color-conversions.ts
    ↓
┌───┴───┬────────────┬──────────────┐
↓       ↓            ↓              ↓
gamut   contrast     perceptual     artistic
-utils  -utils       -corrections   -curves
    ↓       ↓            ↓              ↓
    └───────┴────────────┴──────────────┘
                    ↓
            color-distinctness.ts
                    ↓
              color-utils.ts (main entry)
                    ↓
              export-utils.ts
```

## Gotchas

**Custom Delta-E implementation** - `color-distinctness.ts:calculateDeltaE()` uses a custom formula that weights hue by chroma. Do NOT replace with culori's `differenceEuclidean()`. See the function's docstring for why.

**Perceptual vs Artistic** - Two different concepts:
- `perceptual-corrections.ts` = compensates for human vision quirks (science)
- `artistic-curves.ts` = intentional design variations (aesthetics)
