# Octarine - Figma Color System Plugin

**Last Updated:** 2026-01-21

---


## Completed Phases

All core functionality has been implemented. The plugin is fully functional.

### Phase 1: Foundation ✓
- package.json, tsconfig.json, manifest.json
- code.ts, ui.html, ui.tsx, build.js
- Plugin loads in Figma

### Phase 2: Color Logic ✓
- lib/types.ts (data model)
- lib/color-utils.ts (OKLCH color generation from web app)

### Phase 3: Basic UI ✓
- ColorPickerPopup component (hex, oklch, hsb modes)
- Add/remove colors with labels
- Base color picker per color
- Stop preview (read-only)

### Phase 4: Stop Editing ✓
- Expand/collapse stops
- Add/remove stops (auto-sorted by number)
- Manual stop override with picker
- "Apply corrections" toggle

### Phase 5: Global Settings ✓
- Background color picker
- Method toggle (lightness/contrast)
- Default lightness/contrast inputs

### Phase 6: Color-Level Settings ✓
- Override method, HK/BB corrections per color
- Hue shift slider (0-100)
- Saturation shift slider (0-100)

### Phase 7: Stop-Level Settings ✓
- Override lightness/contrast per stop
- Override hue/saturation shift per stop

### Phase 8: Smart Duplicate Fix ✓
- `ensureUniqueHexColors()` with 3-phase nudging (hue → chroma → lightness)
- `generateColorPalette()` for palette-level generation
- Warning banner when duplicates were fixed

### Phase 9: Figma Integration ✓
- Create Variables button
- lib/figma-utils.ts
- Message handling between UI and plugin

### Phase 10: UI Restructure ✓
- Two-panel layout (left: settings, right: color palettes)
- DefaultsTable component (editable L/C values per stop)
- ColorRow component (horizontal stop swatches)
- StopPopup (click swatch → popup with overrides)
- ColorSettingsPopup (per-color settings button)

### Additional Completed Features ✓
- **Undo/Redo:** lib/useHistory.ts hook, Cmd+Z / Cmd+Shift+Z shortcuts, UI buttons
- **Full HK/BB names:** "Helmholtz-Kohlrausch" and "Bezold-Brücke" with tooltips
- **Delete confirmation:** Modal dialog prevents accidental deletions
- **Base color hex input:** Direct hex input field in color settings

---

## Roadmap

### Color Algorithm Improvements

**Performance (planned for future):**
- [ ] Faster duplicate detection (Set-based lookup instead of array scanning)
- [ ] Smarter contrast refinement (adaptive step sizing, early exit)
- [ ] Skip unnecessary color conversions (direct OKLCH contrast calculation)
- [ ] Lazy-load gamut table (generate on first use, not module load)

**Quality (implemented):**
- [x] HK correction lightness-aware (scale compensation based on lightness level)
- [x] Tighter contrast tolerance (0.005 instead of 0.02 for WCAG compliance)
- [x] Improved BB shift amounts (research-based values, varying by hue region)
- [x] Skip corrections for gray colors (chroma < 0.01)
- [x] Validate final colors are in-gamut after all transformations
- [x] Better gamut boundary at near-black/white extremes
- [x] Color distinctness warning (Delta-E between consecutive stops)

### Polish & Quality
- [ ] Import/export JSON
- [ ] Error handling improvements

### UI Improvements
- [ ] Better onboarding & empty state (welcome message, quick-start presets)

### Functionality Improvements
- [ ] Export formats: CSS custom properties, Tailwind config, OKLCH values
- [ ] Preset color palettes / templates (neutral gray, warm gray, Material style)
- [ ] Color blindness preview (deuteranopia, protanopia, tritanopia simulation)
- [ ] Bulk operations (duplicate row, drag-and-drop reorder, multi-delete)
- [ ] P3/Wide gamut support (output P3 colors for modern displays)
- [ ] Custom collection naming (let users name the Figma variable collection)

### Advanced Features (Future)
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
