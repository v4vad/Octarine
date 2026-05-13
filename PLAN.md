# Octarine Roadmap & Specification

**Status:** Core functionality complete. Plugin is fully functional.

**Historical Reference:** See [docs/COMPLETED.md](docs/COMPLETED.md) for completed phases and refactoring details.

---

## Active Roadmap

### Performance Improvements

**Tier 1 — High-impact, user-visible** ✅ Complete (PRs #11–#15)
- [x] Cache OKLCH gradient picker output; redraw only when hue changes (avoids ~40k culori conversions per drag tick) — `components/color-picker/GradientPicker.tsx`
- [x] Restore gamut lookup table — replaces ~25 culori binary searches per stop with O(1) lookup — `lib/gamut-utils.ts`, new `lib/gamut-table.ts`
- [x] `React.memo` heavy panels and stabilize callbacks via `useReducer` so a slider tick doesn't re-render the whole tree — `App.tsx`, `components/`
- [x] Wrap palette regeneration in `useTransition` so slider drags stay at 60fps — `App.tsx`, `components/colors/ColorRow.tsx`
- [x] Minify build output and audit culori tree-shaking; replace blocked Google Fonts `@import` with embedded `@font-face` — `build.js`
- [x] Batch Figma variable export (hoist `getLocalVariablesAsync` out of per-stop loop) — `platform/figma/figma-utils.ts`

**Tier 2 — Medium-impact**
- [x] Faster duplicate detection (Set-based lookup instead of array scanning) — PR #16
- [x] Cache parsed `bgOklch` across one palette gen (`hexToOklch` memoization) — `lib/color-conversions.ts` — PR #16
- [x] Memoize `getMaxLightnessForMinChroma` (pure function of `hue`, `minChroma`) — `lib/gamut-utils.ts` — PR #16
- [x] Throttle `Slider.tsx` `onChange` to `requestAnimationFrame` — `components/primitives/Slider.tsx` — PR #16
- [x] Skip unnecessary color conversions (direct OKLCH contrast calculation in binary search loops) — `lib/contrast-utils.ts` — PR #17
- [x] Stabilize `GradientPicker` mousemove handler (callback ref pattern) — `components/color-picker/GradientPicker.tsx` — PR #18
- ~~Hoist hue-only invariants (HK `hueFactor`, BB `maxShift`) out of per-stop loop~~ — dropped: premise breaks when hue shift curve is active (hue varies per stop); savings ≤ 1 µs/stop anyway

**Tier 3 — Polish & scale**
- [ ] Delta-based undo history (replace 50 full-state snapshots with action/inverse pairs) — `lib/useHistory.ts`
- [ ] Diff state on `saveState` (partial snapshots after first save) — `platform/figma/adapter.ts`, `App.tsx`
- ~~Hydrate before first paint~~ — dropped: `figma.root.getPluginData` must run before `figma.showUI` to embed state, but that call blocks the plugin window from appearing (~2s delay); user never observed a flash in practice
- [ ] Web stub: idle-time `localStorage` writes or IndexedDB migration — `platform/web/adapter.ts`

> Tier classification and file references derive from a 2026-04-26 audit. See the brainstorm at `~/.claude/plans/we-wrote-down-a-sunny-sonnet.md` for evidence and per-item implementation sketches.

### Polish & Quality
- [ ] Import/export JSON
- [x] Error handling improvements (toast notifications, input validation feedback, helpful Figma error messages)
- [x] Web app visible notifications (DOM toast replaces console.log)

### UI Improvements
- [x] Smart default palette on fresh open (Primary, Secondary, Neutral, Error, Warning, Success)
- [x] Framework presets: load Tailwind v3, Radix UI, or Material 3 in one click
- [x] Responsive full-width web app layout (no longer constrained to Figma panel width)

### Export Features
- [x] CSS custom properties export (hex, rgb, oklch, hsl — with alpha support)
- [x] Tailwind config export (web app only — `theme.extend.colors`)
- [x] SCSS variables export (web app only — `$color-stop: #hex`)
- [x] Raw OKLCH values export (CSV with A column for alpha)
- [ ] Generate documentation in Figma (frame with color swatches, hex values, contrast ratios)
- [ ] Generate documentation webpage (HTML export for sharing/reference)

### Figma Variable modes
- [ ] Figma Variable modes support (Light/Dark/Themes/ with different values per mode)

### Advanced Features
- [x] Preset color palettes / templates (Tailwind, Radix, Material 3 via left panel buttons)
- [x] Per-color alpha / transparency (A: input in color picker, flows through all exports and Figma variables)
- [ ] Color blindness preview (deuteranopia, protanopia, tritanopia simulation)
- [ ] Bulk operations (duplicate row, drag-and-drop reorder, multi-delete)
- [ ] P3/Wide gamut support (output P3 colors for modern displays)
- [ ] Custom collection naming (let users name the Figma variable collection)
- [ ] Hue rotation direction (short path vs long path around color wheel)
- [ ] Multi-anchor palettes (define 2-4 anchor colors, interpolate between them)
- [ ] Dark stop protection toggle (like `preserveColorIdentity` but for dark stops - automatically lift lightness when chroma would drop below perceptible threshold)

---

## Deferred Features

### Import Figma Variables

**Status:** Deferred - needs design work before implementation.

**The Challenge:** Octarine's model (seed color → algorithmic generation) differs from Figma's model (independent color values). Bridging these requires careful design.

**Unresolved Edge Cases:**
- Standalone colors with similar hues (e.g., `ButtonBlue`, `LinkBlue`) - should they be merged into one Octarine color, or kept as separate colors?
- Standalone colors with different hues - how to set a meaningful base color from a single stop?
- Palettes split across Figma organizational groups - need to identify which belong to the same logical palette
- Hue similarity threshold - how similar is "similar enough" to treat as one palette?
- Stop number assignment for colors without a numeric suffix

**Future Considerations:**
- Start with simpler scope (only support clean `Label/StopNumber` format)
- Let user manually assign imported colors to palette slots and stops
- Preview before import with user adjustment — each imported palette becomes one Octarine color in the flat list
- Consider implementing after Figma Variable modes support