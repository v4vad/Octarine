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
- [ ] Error handling improvements

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
