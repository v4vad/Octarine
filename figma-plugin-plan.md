# Octarine - Figma Color System Plugin

**Last Updated:** 2026-01-21

---

## Current Work: Smart Gamut Handling (Lookup Table)

**Branch:** `feature/gamut-lookup-table`

### Problem
The current chroma reduction uses fixed thresholds (90% and 15% lightness) that treat all hues the same. But different hues have different gamut limits:
- **Blues** can stay saturated when dark, but desaturate quickly when light
- **Yellows** desaturate quickly when dark, but can stay vivid when light
- **Reds/Oranges** have medium range in both directions

The current approach is too conservative for some colors and wastes their vibrancy potential.

### Solution
Replace threshold-based formulas with a **lookup table** containing actual maximum chroma values for every hue/lightness combination.

### Implementation Steps

1. **Create feature branch** (safety net to return to main)
   ```bash
   git checkout -b feature/gamut-lookup-table
   ```

2. **Generate lookup table data**
   - New file: `lib/gamut-table.ts`
   - 2D array: `maxChroma[lightness][hue]` (101 × 360 values)
   - Pre-calculated using binary search to find actual gamut boundaries

3. **Create lookup function**
   - Add `getMaxChroma(lightness: number, hue: number): number` to `lib/color-utils.ts`
   - Uses interpolation between grid points for smooth results

4. **Replace threshold logic** in `lib/color-utils.ts`:
   - `generateColor()` (lines 272-278)
   - `generateColorPalette()` (lines 917-923)
   - `refineContrastToTarget()` (lines 194-202)

   **Before:**
   ```typescript
   if (targetL > 0.9) {
     targetC *= 0.3 + (0.7 * (1 - targetL) / 0.1)
   } else if (targetL < 0.15) {
     targetC *= 0.3 + (0.7 * targetL / 0.15)
   }
   ```

   **After:**
   ```typescript
   const maxC = getMaxChroma(targetL, baseOklch.h)
   targetC = Math.min(targetC, maxC)
   ```

5. **Build & test** in Figma with various colors

### Expected Results
- Blue palettes: Darker stops retain more saturation
- Yellow palettes: Lighter stops retain more saturation
- All colors: More accurate to actual display capabilities

### Rollback
```bash
git checkout main
```

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
