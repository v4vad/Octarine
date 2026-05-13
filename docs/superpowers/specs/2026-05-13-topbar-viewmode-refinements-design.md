# TopBar View Mode Refinements

**Date:** 2026-05-13
**Status:** Approved

## Goal

Move the view mode toggle into the TopBar as a compact icon pair, relocate the background picker to the right side of the TopBar, and highlight the active color row in "All Colors" mode.

## Design

### 1. ViewModeToggle → TopBar icon pair

Remove the `ViewModeToggle` component from the middle panel. Replace with two adjacent icon-only buttons in `top-bar-left`, placed after the preset dropdown:

- **Grid icon** → "All Colors" mode
- **Single-row icon** → "Selected" mode

Both buttons reuse the `top-bar-icon-btn` CSS class. A new `top-bar-icon-btn--active` modifier class provides the active state: filled background (`var(--oct-bg-hover)`) + brand border color + primary text color.

`TopBar` receives two new props: `viewMode: 'all' | 'selected'` and `onViewModeChange: (mode: 'all' | 'selected') => void`. `App.tsx` passes its existing `viewMode` state down.

The `ViewModeToggle` component (`components/panels/ViewModeToggle.tsx`) is deleted and removed from `components/panels/index.ts`.

### 2. Background picker → right side

Move the `top-bar-bg-color` block from `top-bar-left` to `top-bar-right`, as the first item: `[bg picker] [theme toggle] [export]`.

### 3. Selected color highlight in "All Colors" mode

Add optional `isActive?: boolean` prop to `ColorRow`. When true, apply `color-row--active` CSS class to the `.color-row` div.

New CSS rule in `styles.css`:
```css
.color-row--active {
  border-left: 3px solid var(--oct-border-brand);
  background: var(--oct-bg-hover);
}
```

In `App.tsx`'s "all" mode map, pass `isActive={color.id === activeColorId}` to each `ColorRow`.

## Files Affected

| File | Change |
|------|--------|
| `components/panels/TopBar.tsx` | Add `viewMode`/`onViewModeChange` props; add icon buttons; move bg picker to right |
| `components/panels/ViewModeToggle.tsx` | Delete |
| `components/panels/index.ts` | Remove `ViewModeToggle` export |
| `App.tsx` | Pass `viewMode`/`onViewModeChange` to TopBar; remove `ViewModeToggle` from middle panel; add `isActive` to ColorRow in "all" mode |
| `components/colors/ColorRow.tsx` | Add `isActive?` prop; apply `color-row--active` class |
| `styles.css` | Add `.top-bar-icon-btn--active` and `.color-row--active` rules |

## Out of Scope

- Persisting view mode across sessions
- Tooltip labels on the new icon buttons (titles already provide hover tooltips)
