# View Mode Toggle for Middle Panel

**Date:** 2026-05-13
**Status:** Approved

## Goal

Add a segmented control to the middle panel so users can switch between viewing all colors at once and viewing only the currently selected color.

## Design

### State

Add `viewMode: 'all' | 'selected'` to `App.tsx` local state. This is not part of the undo history (same as `activeColorId`). Default: `'selected'`.

### Segmented Control

A `ViewModeToggle` component placed at the top of `.middle-panel`. Reuses existing `method-toggle` / `method-toggle-btn` CSS classes — no new styles required.

Labels: `All Colors` | `Selected`

### Middle Panel Render Logic

**`'selected'` mode (default):**
Current behavior unchanged — renders one `ColorRow` for `deferredActiveColor`.

**`'all'` mode:**
Maps over `colors[]` and renders a `ColorRow` for each color. Each row receives:
- Its own `color` object and computed `ColorSettings`
- `onUpdate={(updated) => updateColor(color.id, updated)}`
- `onActivate={() => setActiveColorId(color.id)}` — fires when a stop is clicked, so clicking any stop in any row auto-selects that color in the left panel and right settings panel

### `ColorRow` Change

Add optional `onActivate?: () => void` prop to `ColorRowProps`. Call `onActivate?.()` inside `handleStopClick` before opening the stop picker.

## Files Affected

| File | Change |
|------|--------|
| `App.tsx` | Add `viewMode` state; update middle panel JSX |
| `components/colors/ColorRow.tsx` | Add `onActivate?` prop; call it in `handleStopClick` |
| `components/panels/` (new) | `ViewModeToggle.tsx` + export from `index.ts` |
| `components/panels/index.ts` | Export `ViewModeToggle` |

## Out of Scope

- Persisting `viewMode` across sessions
- `deferredValue` optimization for "all" mode rows (acceptable perf for typical color counts)
- Collapsing/expanding individual rows in "all" mode
