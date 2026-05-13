# Accessibility — Labels + Keyboard Navigation

**Date:** 2026-05-13  
**Branch:** feat/alpha-mode (or new branch from main)  
**WCAG target:** 2.1 AA (with one acknowledged gap: gradient canvas drag)

## Context

Octarine's UI was built without accessibility in mind. Icon-only buttons have no labels, form inputs have no associated labels, toggle buttons communicate state only via CSS class, and most interactive elements are `<div>` elements unreachable by keyboard. A user relying on a screen reader or keyboard navigation cannot use the tool. This spec covers the changes needed to reach WCAG 2.1 AA compliance for all interactions except the gradient canvas drag (which has a keyboard-accessible fallback via the L/C/H text inputs).

---

## Section 1: ARIA Labels and States

### Icon-only buttons → aria-label

All buttons that show only an SVG icon must have `aria-label`. The `title` attribute is unreliable with screen readers and must be replaced.

| File | Button | aria-label value |
|------|--------|-----------------|
| `components/panels/TopBar.tsx` | Undo | `"Undo"` |
| `components/panels/TopBar.tsx` | Redo | `"Redo"` |
| `components/panels/TopBar.tsx` | Theme toggle | `"Switch to light mode"` / `"Switch to dark mode"` (dynamic) |
| `components/panels/DefaultsTable.tsx` | Delete stop | `"Delete stop {num}"` (includes stop number) |
| `components/color-settings/ColorPickerPopup.tsx` | Eyedropper | `"Pick color from selection"` |
| `components/color-settings/ColorPickerPopup.tsx` | Reset color | `"Reset to auto"` |

### Preset select → aria-label

`TopBar.tsx` preset `<select>` gets `aria-label="Load framework preset"`.

### SVG icons → aria-hidden

Every `<svg>` inside a button or decorative context gets `aria-hidden="true"` so screen readers skip it and read the button's `aria-label` instead.

### Toggle button groups → role + aria-pressed

All button pairs that represent a mutually exclusive choice:

| File | Group | aria-label on container |
|------|-------|------------------------|
| `components/panels/DefaultsTable.tsx` | Direct / Radix | `"Alpha method"` |
| `components/primitives/MethodToggle.tsx` | Lightness / Contrast | `"Lightness method"` |

Each button in the group gets `aria-pressed={isActive}` so screen readers announce which option is selected.

### Form inputs → aria-label

All inputs currently lacking labels:

| File | Input | aria-label value |
|------|-------|-----------------|
| `components/color-settings/ColorPickerPopup.tsx` | L value | `"Lightness"` |
| `components/color-settings/ColorPickerPopup.tsx` | C value | `"Chroma"` |
| `components/color-settings/ColorPickerPopup.tsx` | H value | `"Hue"` |
| `components/color-settings/ColorPickerPopup.tsx` | Hex (OKLCH mode) | `"Hex color"` |
| `components/color-settings/ColorPickerPopup.tsx` | Alpha % (OKLCH mode) | `"Alpha percentage"` |
| `components/color-settings/ColorPickerPopup.tsx` | H value (HSB) | `"Hue"` |
| `components/color-settings/ColorPickerPopup.tsx` | S value (HSB) | `"Saturation"` |
| `components/color-settings/ColorPickerPopup.tsx` | B value (HSB) | `"Brightness"` |
| `components/color-settings/ColorPickerPopup.tsx` | Hex (HSB mode) | `"Hex color"` |
| `components/color-settings/ColorPickerPopup.tsx` | Alpha % (HSB mode) | `"Alpha percentage"` |
| `components/primitives/SwatchHexInput.tsx` | Hex input | `"Hex color"` |
| `components/panels/DefaultsTable.tsx` | Add Stop number input | `"New stop number"` |

---

## Section 2: Keyboard Navigation

### Color accordion rows (LeftPanel)

`LeftPanel.tsx` — the color row div (currently `onClick` only) needs:
- `tabIndex={0}`
- `onKeyDown` handler: fire the same `onClick` action on `Enter` or `Space`
- `role="button"` to signal interactivity to screen readers

No structural change — just three props added to the existing div.

### Color picker tabs (ColorPickerPopup)

The HSB / OKLCH tab divs (`className="tab"`) need to become `<button>` elements. Native buttons are keyboard-focusable by default, receive Enter/Space, and communicate "clickable" correctly to screen readers. The active tab should have `aria-pressed={isActive}` or use `aria-selected` with `role="tab"` on a `role="tablist"` container.

Use `role="tablist"` + `role="tab"` + `aria-selected` — this is the standard ARIA tabs pattern and is better than aria-pressed for tab-strip UI.

### Toggle primitive (Toggle.tsx)

The outer wrapper div acts as a toggle switch. Change:
- Add `role="switch"` to the div
- Add `tabIndex={0}`
- Add `aria-checked={checked}`
- Add `onKeyDown` handler: toggle on `Space` keypress

This follows the ARIA `switch` role pattern, which is the correct semantic for on/off toggles.

### Escape to close (ConfirmModal + LeftPanel color picker popup)

Both popup/modal scenarios should close on Escape:
- `components/primitives/ConfirmModal.tsx` — add `useEffect` with `keydown` listener that calls `onCancel` on Escape
- `components/panels/LeftPanel.tsx` — the color picker popup backdrop already has `onClick={() => setPickerColorId(null)}`; add a `useEffect` keydown listener to the same effect

---

## Section 3: Hue Slider Keyboard Access

`components/primitives/HueSlider.tsx` — replace the custom div-based drag mechanism with an `<input type="range">`:

- `min={0}`, `max={360}`, `step={1}`
- `value={hue}`, `onChange` calls the existing `onHueChange` prop
- CSS: style the `<input type="range">` to match the current visual (gradient track + circular handle) using `::-webkit-slider-thumb` and `::-webkit-slider-runnable-track` pseudo-elements
- The gradient background on the track is set via `style={{ background: hueGradient }}` — same as current

This gives keyboard users arrow key control over hue while looking identical to the current design.

**Acknowledged limitation:** The gradient canvas (GradientPicker.tsx) remains mouse/touch only. Users can set L/C/H values precisely using the text inputs already present in the color picker popup.

---

## Files to Modify

| File | Changes |
|------|---------|
| `components/panels/TopBar.tsx` | aria-label on 3 buttons, aria-label on select, aria-hidden on SVGs |
| `components/panels/LeftPanel.tsx` | tabIndex + onKeyDown on accordion div, Escape listener for popup |
| `components/panels/DefaultsTable.tsx` | aria-pressed on toggle group, aria-label on delete button, aria-label on add-stop input |
| `components/primitives/Toggle.tsx` | role="switch", tabIndex, aria-checked, onKeyDown Space handler |
| `components/primitives/MethodToggle.tsx` | role="group", aria-label on container, aria-pressed on buttons |
| `components/primitives/SwatchHexInput.tsx` | aria-label on hex input |
| `components/primitives/HueSlider.tsx` | Replace div drag with input[type=range], CSS restyling |
| `components/primitives/ConfirmModal.tsx` | Escape key listener, role="dialog", aria-modal |
| `components/color-settings/ColorPickerPopup.tsx` | aria-label on all inputs, tabs → role="tablist"/role="tab"/aria-selected, aria-label on icon buttons, aria-hidden on SVGs |

---

## Verification

1. **Screen reader test:** Tab through the UI with VoiceOver (macOS) — every focused element should announce its name and role
2. **Keyboard-only test:** Unplug mouse, navigate entire UI with Tab + Enter + Space + arrow keys + Escape
3. **Toggle state test:** Tab to Direct/Radix buttons, check that VoiceOver announces "Direct, selected" vs "Radix, not selected"
4. **Hue slider test:** Tab to hue slider, press left/right arrow keys, confirm hue value changes and color preview updates
5. **TypeScript check:** `npm run typecheck` after all changes
