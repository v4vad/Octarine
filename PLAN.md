# Octarine Roadmap & Specification

**Status:** Core functionality complete. Plugin is fully functional.

---

## Active Roadmap

### Performance Improvements
- [ ] Faster duplicate detection (Set-based lookup instead of array scanning)
- [ ] Smarter contrast refinement (adaptive step sizing, early exit)
- [ ] Skip unnecessary color conversions (direct OKLCH contrast calculation)
- [ ] Lazy-load gamut table (generate on first use, not module load)

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
- Split color-utils.ts (Phase 5): The file has tightly coupled functions with many interdependencies. Splitting would require extensive refactoring and risk breaking the algorithm.
- Add tests (Phase 6): Requires Vitest setup and configuration. Deferred to future work.

**Remaining in ui.tsx:** App component only (~200 lines) - serves as the main entry point

</details>

---

**Historical context:** See `figma-plugin-plan.md` for the original development plan.
