# Octarine Roadmap & Specification

**Status:** Core functionality complete. Plugin is fully functional.

---

## Active Roadmap

### Performance Improvements
- [ ] Faster duplicate detection (Set-based lookup instead of array scanning)
- [ ] Smarter contrast refinement (adaptive step sizing, early exit)
- [ ] Skip unnecessary color conversions (direct OKLCH contrast calculation)

### Polish & Quality
- [ ] Import/export JSON
- [ ] Error handling improvements

### UI Improvements
- [ ] Better onboarding & empty state (welcome message, quick-start presets)

### Export Features
- [ ] CSS custom properties export
- [ ] Tailwind config export
- [ ] Raw OKLCH values export

### Advanced Features
- [ ] Preset color palettes / templates (neutral gray, warm gray, Material style)
- [ ] Color blindness preview (deuteranopia, protanopia, tritanopia simulation)
- [ ] Bulk operations (duplicate row, drag-and-drop reorder, multi-delete)
- [ ] P3/Wide gamut support (output P3 colors for modern displays)
- [ ] Custom collection naming (let users name the Figma variable collection)
- [ ] Easing curves for value distribution (linear, ease-in, ease-out)
- [ ] Hue rotation direction (short path vs long path around color wheel)
- [ ] Multi-anchor palettes (define 2-4 anchor colors, interpolate between them)

---

## color-utils.ts Refactoring Plan

**Status:** ✅ Complete (January 2026)

**Goal:** Split the 1,351-line `lib/color-utils.ts` into focused modules while maintaining backward compatibility.

**Original Structure (before refactoring):**

| Module | Lines | Purpose | Dependencies |
|--------|-------|---------|--------------|
| Color Conversions | ~100 | hex↔oklch↔rgb↔hsb | External (culori) only |
| Smart Min Chroma | ~60 | Preserve color identity | gamut-table |
| Contrast Utils | ~80 | WCAG calculations | Conversions, culori |
| Contrast Refinement | ~60 | Fix contrast after transforms | Conversions, Contrast, gamut |
| Legacy generateColor | ~80 | Old API (likely unused) | Everything |
| Perceptual Corrections | ~200 | HK & BB effects | None (pure math) |
| Artistic Curves | ~210 | Hue shift & chroma | Types only |
| Palette Generation | ~500 | Main algorithm + dedup | Everything |

### Culori API Integration

**Investigation:** Compared culori (current), @texel/color, and Color.js libraries.

**Decision:** Stay with culori but use more of its built-in APIs to reduce custom code.

| Area | Decision | Rationale |
|------|----------|-----------|
| Gamut mapping | Switch to culori's `clampChroma()` | Simpler, accurate, removes ~170 lines |
| WCAG contrast | Switch to culori's `wcagContrast()` | Built-in, removes ~25 lines |
| Delta-E | **Keep custom formula** | More perceptually accurate (see below) |
| Lookup table | Archive to `docs/archived/` | Keep for future reference |

**Why Keep Custom Delta-E:**

The custom `calculateDeltaE()` weights hue by chroma level:
- Low chroma (grayish) colors → hue differences matter less
- High chroma (vivid) colors → hue differences matter more

This is more perceptually accurate than culori's standard `differenceEuclidean('oklch')` which weights all channels equally. For example, gray-ish blue vs gray-ish red look almost identical to humans, but standard Euclidean would report a large difference.

### Phase 1: Extract Color Conversions (Low Risk) ✅
- [x] Create `lib/color-conversions.ts`
- [x] Move: `hexToOklch`, `oklchToHex`, `oklchToCss`, `parseOklch`
- [x] Move: `hexToRgb`, `rgbToHex`, `rgbToOklch`, `oklchToRgb`
- [x] Move: `rgbToHsb`, `hsbToRgb`, `OKLCH` interface
- [x] Re-export from color-utils.ts for backward compatibility
- [x] Consumer imports unchanged (backward compatible)

**Why safe:** No internal dependencies - only uses external `culori` library.

### Phase 2: Extract Perceptual Corrections (Low Risk) ✅
- [x] Create `lib/perceptual-corrections.ts`
- [x] Move: `getHKCompensation`, `applyHKCompensation`
- [x] Move: `getMaxBBShiftForHue`, `getBBShiftCorrection`, `applyBBCorrection`
- [x] Move: `applyPerceptualCorrections`, `PerceptualCorrectionOptions` interface

**Why safe:** Pure math functions with no dependencies on other color-utils functions.

### Phase 3: Extract Artistic Curves (Low Risk) ✅
- [x] Create `lib/artistic-curves.ts`
- [x] Move: `getYellowEquivalentShifts`, `getHueShiftValues`, `applyHueShift`
- [x] Move: `smoothStep`, `interpolateChromaCurve`, `applyChromaCurve`

**Why safe:** Only depends on `types.ts` for preset constants.

### Phase 4: Extract Contrast Utilities + Use Culori APIs (Medium Risk) ✅
- [x] Create `lib/contrast-utils.ts`
- [x] Replace `getRelativeLuminance` with culori's `wcagLuminance()`
- [x] Replace `getContrastRatio` with culori's `wcagContrast()`
- [x] Keep custom: `findLightnessForContrast`, `refineContrastToTarget`, `shouldUseLightText`
- [x] Updated `culori.d.ts` with WCAG function types

**Culori integration:**
```typescript
import { wcagContrast, wcagLuminance } from "culori"
export const getContrastRatio = wcagContrast
export const getRelativeLuminance = wcagLuminance
```

**Risk:** Depends on color conversions from Phase 1. Test contrast calculations thoroughly.

### Phase 5: Replace Gamut Table + Archive (Medium Risk) ✅
- [x] Create `lib/gamut-utils.ts`
- [x] Replace gamut table lookups with culori's `clampChroma()` and `displayable()`
- [x] Archive `lib/gamut-table.ts` → `docs/archived/gamut-table.ts`
- [x] Move `getMinChromaForHue`, `getMaxLightnessForMinChroma`, `validateAndClampToGamut`
- [x] Updated `culori.d.ts` with `displayable()` type definition

**Culori integration:**
```typescript
import { clampChroma, displayable } from "culori"

export function clampChromaToGamut(c: number, l: number, h: number): number {
  const color = { mode: 'oklch' as const, l, c, h }
  const clamped = clampChroma(color, 'oklch')
  return clamped.c
}

export function isInGamut(l: number, c: number, h: number): boolean {
  return displayable({ mode: 'oklch', l, c, h })
}
```

**Risk:** Gamut clamping affects color output. Test extensively with edge cases (vivid colors, near-black/white).

### Phase 6: Extract Delta-E & Deduplication (Medium Risk)
- [ ] Create `lib/color-distinctness.ts`
- [ ] Move: `calculateDeltaE`, `DELTA_E_THRESHOLD`
- [ ] Move: `ensureUniqueHexColors` and nudge constants (`MIN_LIGHTNESS_NUDGE`, etc.)
- [ ] **Keep custom Delta-E** (do NOT replace with culori's `differenceEuclidean`)

**Why custom Delta-E:** See "Culori API Integration" section above. The custom formula weights hue differences by chroma level, which is more perceptually accurate for color palettes where many colors are desaturated.

**Add documentation in code:**
```typescript
/**
 * Calculate Delta-E (color difference) in OKLCH space
 *
 * CUSTOM IMPLEMENTATION - Do not replace with culori's differenceEuclidean()
 *
 * Why: This formula weights hue by chroma level. For desaturated colors,
 * hue differences matter less visually. Standard Euclidean distance would
 * incorrectly report gray-ish blue vs gray-ish red as "very different"
 * when they actually look almost identical to humans.
 */
```

**Risk:** Depends on contrast utilities and conversions.

### Phase 7: Final Cleanup (Low Risk)
- [ ] Keep `lib/color-utils.ts` as main entry point (~250 lines)
- [ ] Re-export everything from sub-modules for backward compatibility
- [ ] Keep only `generateColorPalette` in main file
- [ ] Remove deprecated `generateColor` function (verify unused first)

**Expected final structure:**
```
lib/
├── color-utils.ts          (~250 lines - orchestrator + re-exports)
├── color-conversions.ts    (~100 lines)
├── contrast-utils.ts       (~80 lines - uses culori)
├── perceptual-corrections.ts (~200 lines)
├── artistic-curves.ts      (~210 lines)
├── gamut-utils.ts          (~60 lines - uses culori)
├── color-distinctness.ts   (~180 lines - custom Delta-E)
└── types.ts                (unchanged)

docs/archived/
└── gamut-table.ts          (archived lookup table for reference)
```

**Result:** Main file reduced from 1,351 → 269 lines. Code split into 7 focused modules (1,502 total lines including documentation and module boilerplate).

### Progress Tracking

| Phase | Risk | Lines | Status |
|-------|------|-------|--------|
| 1. Conversions | Low | ~100 | ✅ Complete |
| 2. Perceptual | Low | ~200 | ✅ Complete |
| 3. Artistic | Low | ~210 | ✅ Complete |
| 4. Contrast + Culori | Medium | ~80 | ✅ Complete |
| 5. Gamut + Archive | Medium | ~60 | ✅ Complete |
| 6. Delta-E (custom) | Medium | ~180 | ✅ Complete |
| 7. Cleanup | Low | ~80 | ✅ Complete |

### Risk Mitigation
1. **Backward-compatible exports:** Each phase re-exports from color-utils.ts
2. **One phase at a time:** Complete and test each phase before starting next
3. **Manual Figma testing:** Verify palette generation after each phase
4. **Keep orchestrator last:** Extract dependencies before `generateColorPalette`
5. **Commit after each phase:** Create a git commit after each phase passes validation, enabling easy rollback if issues are discovered later

---

## Product Specification

### Data Model

**Global Settings:**
- Background color (default: #ffffff) - for contrast calculations
- Method: lightness or contrast
- Default lightness/contrast values per stop

**Color:**
- Label (e.g., "Primary")
- Base color (hex, editable via picker)
- Override settings: method, hue shift (0-100), saturation shift (0-100)
- HK/BB corrections (per-color, default: off)
- Stops array

**Stop:**
- Number (50, 100, 200... user can add/remove/reorder)
- Overrides: lightness, contrast, hue shift, saturation shift
- Manual color override (via picker) + apply corrections toggle

### Settings Hierarchy

```
Global → Color-level → Stop-level
(each level overrides the one above)
```

### Default Stops

`50, 100, 200, 300, 400, 500, 600, 700, 800, 900`

### Figma Output

Variables: `{label}/{stop}` (e.g., `primary/500`)

---

## Completed Features

<details>
<summary>Click to expand completed phases</summary>

### Phase 1: Foundation
- package.json, tsconfig.json, manifest.json
- code.ts, ui.html, ui.tsx, build.js
- Plugin loads in Figma

### Phase 2: Color Logic
- lib/types.ts (data model)
- lib/color-utils.ts (OKLCH color generation)

### Phase 3: Basic UI
- ColorPickerPopup component (hex, oklch, hsb modes)
- Add/remove colors with labels
- Base color picker per color
- Stop preview (read-only)

### Phase 4: Stop Editing
- Expand/collapse stops
- Add/remove stops (auto-sorted by number)
- Manual stop override with picker
- "Apply corrections" toggle

### Phase 5: Global Settings
- Background color picker
- Method toggle (lightness/contrast)
- Default lightness/contrast inputs

### Phase 6: Color-Level Settings
- Override method, HK/BB corrections per color
- Hue shift slider (0-100)
- Saturation shift slider (0-100)

### Phase 7: Stop-Level Settings
- Override lightness/contrast per stop
- Override hue/saturation shift per stop

### Phase 8: Smart Duplicate Fix
- `ensureUniqueHexColors()` with 3-phase nudging (hue → chroma → lightness)
- `generateColorPalette()` for palette-level generation
- Warning banner when duplicates were fixed

### Phase 9: Figma Integration
- Create Variables button
- lib/figma-utils.ts
- Message handling between UI and plugin

### Phase 10: UI Restructure
- Two-panel layout (left: settings, right: color palettes)
- DefaultsTable component (editable L/C values per stop)
- ColorRow component (horizontal stop swatches)
- StopPopup (click swatch → popup with overrides)
- ColorSettingsPopup (per-color settings button)

### Additional Features
- Undo/Redo: lib/useHistory.ts hook, Cmd+Z / Cmd+Shift+Z shortcuts
- Full HK/BB names: "Helmholtz-Kohlrausch" and "Bezold-Brucke" with tooltips
- Delete confirmation: Modal dialog prevents accidental deletions
- Base color hex input: Direct hex input field in color settings

### Quality Improvements (Implemented)
- HK correction lightness-aware (scale compensation based on lightness level)
- Tighter contrast tolerance (0.005 instead of 0.02 for WCAG compliance)
- Improved BB shift amounts (research-based values, varying by hue region)
- Skip corrections for gray colors (chroma < 0.01)
- Validate final colors are in-gamut after all transformations
- Better gamut boundary at near-black/white extremes
- Color distinctness warning (Delta-E between consecutive stops)

### Code Refactoring (January 2026)

**Goal:** Reduce ui.tsx from 2,558 lines to improve maintainability.

**Completed:**
- Extracted primitive components: Toggle, ConfirmModal, RefBasedNumericInput, MethodToggle, Slider → `components/primitives/`
- Created `useColorPicker` hook to consolidate ~160 lines of duplicated hex/OKLCH/HSB sync logic → `hooks/`
- Created `useClickOutside` hook for popup dismissal → `hooks/`
- Extracted color picker: GradientPicker, HueSlider, ColorPickerPopup → `components/color-picker/`
- Extracted group components: GroupAccordionItem, DefaultsTable → `components/groups/`
- Extracted popups: StopPopup → `components/popups/`
- Extracted panels: TopBar, LeftPanel, ResizeHandle → `components/panels/`
- Extracted color settings: BaseColorField, ColorQualitySection, CorrectionsSection, HueShiftCurveSection, ChromaCurveSection, ColorSettingsContent, ColorSettingsPopup, RightSettingsPanel → `components/color-settings/`
- Extracted color row: ColorRow → `components/colors/`

**Result:** ui.tsx reduced from 2,558 → 318 lines (88% reduction)

**Skipped:**
- React Context (Phase 3): Code review revealed prop drilling was only 2-3 levels deep, not the 4-5 levels originally estimated. Adding context would add complexity without meaningful benefit.
- Split color-utils.ts (Phase 5): Originally skipped due to tight coupling. Now planned with a multi-phase approach - see "color-utils.ts Refactoring Plan" section above.
- Add tests (Phase 6): Requires Vitest setup and configuration. Deferred to future work.

**Remaining in ui.tsx:** App component only (~200 lines) - serves as the main entry point

</details>

---

**Historical context:** See `figma-plugin-plan.md` for the original development plan.
