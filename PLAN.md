# Octarine Roadmap & Specification

**Status:** Core functionality complete. Plugin is fully functional.

**Historical Reference:** See [docs/COMPLETED.md](docs/COMPLETED.md) for completed phases and refactoring details.

---

## Active Roadmap

### Performance Improvements
- [ ] Faster duplicate detection (Set-based lookup instead of array scanning)
- [ ] Smarter contrast refinement (adaptive step sizing, early exit)
- [ ] Skip unnecessary color conversions (direct OKLCH contrast calculation)

### Polish & Quality
- [ ] Import/export JSON
- [x] Error handling improvements (toast notifications, input validation feedback, helpful Figma error messages)

### UI Improvements
- [ ] Better onboarding & empty state (welcome message, quick-start presets)

### Export Features
- [ ] CSS custom properties export
- [ ] Tailwind config export
- [ ] Raw OKLCH values export
- [ ] Generate documentation in Figma (frame with color swatches, hex values, contrast ratios)
- [ ] Generate documentation webpage (HTML export for sharing/reference)

### Figma Variable modes
- [ ] Figma Variable modes support (Light/Dark/Themes/ with different values per mode)

### Advanced Features
- [ ] Preset color palettes / templates (neutral gray, warm gray, Material style)
- [ ] Color blindness preview (deuteranopia, protanopia, tritanopia simulation)
- [ ] Bulk operations (duplicate row, drag-and-drop reorder, multi-delete)
- [ ] P3/Wide gamut support (output P3 colors for modern displays)
- [ ] Custom collection naming (let users name the Figma variable collection)
- [ ] Hue rotation direction (short path vs long path around color wheel)
- [ ] Multi-anchor palettes (define 2-4 anchor colors, interpolate between them)
- [ ] Dark stop protection toggle (like `preserveColorIdentity` but for dark stops - automatically lift lightness when chroma would drop below perceptible threshold)
- [ ] Lightness curve presets (linear, lifted darks, compressed range, custom)

---

## Deferred Features

### Import Figma Variables

**Status:** Deferred - needs design work before implementation.

**The Challenge:** Octarine's model (seed color → algorithmic generation) differs from Figma's model (independent color values). Bridging these requires careful design.

**Unresolved Edge Cases:**
- Standalone colors with similar hues (e.g., `ButtonBlue`, `LinkBlue`) - should they be grouped?
- Standalone colors with different hues - how to set meaningful base color with one stop?
- Split palettes across Figma groups - need to merge across organizational structure
- Hue grouping threshold - how similar is "similar enough"?
- Stop number assignment for ungrouped colors

**Future Considerations:**
- Start with simpler scope (only support clean `Label/StopNumber` format)
- Let user manually assign imported colors to groups/stops
- Preview before import with user adjustment
- Consider implementing after Figma Variable modes support