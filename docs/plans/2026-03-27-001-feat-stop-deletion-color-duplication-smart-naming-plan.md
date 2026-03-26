---
title: "feat: Stop Deletion, Color Duplication, Smart Naming"
type: feat
status: active
date: 2026-03-27
origin: docs/brainstorms/2026-03-27-ui-improvements-requirements.md
---

# feat: Stop Deletion, Color Duplication, Smart Naming

## Overview

Four usability improvements to the Octarine UI: (1) delete individual color stops, (2) expose the existing duplicate-color logic via a hover icon, (3) auto-name colors using the closest CSS named color, and (4) move the Delete color button to the bottom of the right panel.

## Proposed Solution

### R1. Delete Color Stops

**What:** Add an X button on hover next to each stop number in the DefaultsTable. Clicking it removes the stop from the color.

**Where to change:**
- `components/groups/DefaultsTable.tsx` — add delete button per row
- `styles.css` — hover-reveal styling for the X button

**How it works:**
1. In the `<tbody>` loop over `stopNumbers`, add a delete button (`x`) in a new column, visible only on hover via CSS
2. When clicked, remove the stop number from `defaultLightness`, `defaultContrast`, and the `stops[]` array
3. Hide/disable the delete button when `stopNumbers.length <= 2` (minimum 2 stops per color — see origin)
4. The `onUpdate` callback already accepts `Partial<Color>`, so pass all three updated fields at once

**Implementation sketch for `DefaultsTable.tsx`:**

```tsx
// components/groups/DefaultsTable.tsx — new handler
const handleDeleteStop = (stopNum: number) => {
  if (stopNumbers.length <= 2) return;
  const { [stopNum]: _l, ...newLightness } = color.defaultLightness;
  const { [stopNum]: _c, ...newContrast } = color.defaultContrast;
  const newStops = color.stops.filter(s => s.number !== stopNum);
  onUpdate({ defaultLightness: newLightness, defaultContrast: newContrast, stops: newStops });
};
```

```tsx
{/* In each <tr>, add delete cell */}
<tr key={num} className="defaults-row">
  <td className="stop-col">
    {num}
    {stopNumbers.length > 2 && (
      <button
        className="stop-delete-btn"
        onClick={() => handleDeleteStop(num)}
        title="Remove stop"
      >×</button>
    )}
  </td>
  <td className="value-col">...</td>
</tr>
```

```css
/* styles.css */
.stop-delete-btn {
  opacity: 0;
  /* minimal styling — small, inline */
}
.defaults-row:hover .stop-delete-btn {
  opacity: 1;
}
```

### R2. Duplicate Color Button (Hover Icon in Left Panel)

**What:** Add a duplicate icon on each color row header in the LeftPanel, visible on hover.

**Where to change:**
- `components/panels/LeftPanel.tsx` — add duplicate icon + accept `onDuplicateColor` prop
- `ui.tsx` — pass `onDuplicateColor` prop to LeftPanel
- `styles.css` — hover-reveal styling

**How it works:**
1. Add `onDuplicateColor: (colorId: string) => void` to `LeftPanelProps`
2. In `ui.tsx`, pass `onDuplicateColor={duplicateColor}` (function already exists at `ui.tsx:158`)
3. Inside the `.color-header-row` div, add a small duplicate icon button
4. Show on hover via CSS (`.group-strip-container:hover .duplicate-btn { opacity: 1 }`)
5. `e.stopPropagation()` to prevent the click from also selecting/expanding the color

**Implementation sketch for `LeftPanel.tsx`:**

```tsx
// In the color-header-row (both expanded and collapsed variants)
<button
  className="duplicate-btn"
  onClick={(e) => { e.stopPropagation(); onDuplicateColor(color.id); }}
  title="Duplicate color"
>⧉</button>
```

### R3. Meaningful Default Color Names (CSS Named Colors)

**What:** When a new color is created, name it after the closest CSS named color instead of "Color 1". Auto-rename when the base color changes, unless the user has manually edited the name.

**Where to change:**
- `lib/css-color-names.ts` — **new file**, static lookup table of 148 CSS named colors with their hex values
- `lib/color-utils.ts` — new `findClosestCSSColorName()` function
- `lib/types.ts` — add `autoLabel?: boolean` field to `Color` type
- `ui.tsx` — update `addColor`, `duplicateColor`, and `updateColor` functions

**How it works:**

**Step 1: CSS color name table** (`lib/css-color-names.ts`)

```tsx
// Static map: name → hex (all 148 CSS named colors)
export const CSS_NAMED_COLORS: Record<string, string> = {
  AliceBlue: '#F0F8FF',
  AntiqueWhite: '#FAEBD7',
  Aqua: '#00FFFF',
  // ... all 148
  YellowGreen: '#9ACD32',
};
```

**Step 2: Closest color finder** (`lib/color-utils.ts`)

```tsx
import { CSS_NAMED_COLORS } from './css-color-names';

export function findClosestCSSColorName(hex: string): string {
  const target = hexToOklch(hex);
  let bestName = 'Blue';
  let bestDistance = Infinity;
  for (const [name, cssHex] of Object.entries(CSS_NAMED_COLORS)) {
    const candidate = hexToOklch(cssHex);
    const dist = calculateDeltaE(target, candidate); // existing function
    if (dist < bestDistance) {
      bestDistance = dist;
      bestName = name;
    }
  }
  return bestName;
}
```

**Step 3: Track auto vs manual names** (`lib/types.ts`)

Add `autoLabel?: boolean` to the `Color` type. When `true`, the name was auto-generated and can be auto-updated. When `false` or `undefined` (for backward compatibility with existing colors), the name is user-edited and won't change.

```tsx
export type Color = {
  // ... existing fields
  autoLabel?: boolean  // true = name was auto-generated, can auto-update
}
```

Update `createDefaultColor()` to set `autoLabel: true`.

**Step 4: Wire up in `ui.tsx`**

- `addColor()`: Use `findClosestCSSColorName('#0066CC')` instead of `Color ${colors.length + 1}`. Handle duplicate names by appending a number (e.g., "DodgerBlue 2"). Set `autoLabel: true`.
- `duplicateColor()`: Set `autoLabel: true` on the copy with the auto-generated name.
- `updateColor()`: When `baseColor` changes and `autoLabel === true`, recalculate the name. When the `label` changes (user typed a new name), set `autoLabel: false`.

**Deduplication helper:**

```tsx
function uniqueColorName(baseName: string, existingColors: Color[], excludeId?: string): string {
  const otherNames = existingColors
    .filter(c => c.id !== excludeId)
    .map(c => c.label);
  if (!otherNames.includes(baseName)) return baseName;
  let i = 2;
  while (otherNames.includes(`${baseName} ${i}`)) i++;
  return `${baseName} ${i}`;
}
```

**Step 5: Migration** — bump `STORAGE_VERSION` to 8. Existing colors keep their current labels with `autoLabel: undefined` (treated as user-edited). No data loss.

### R4. Move Delete Button to Bottom of Right Panel

**What:** Move the Delete button from the header to the bottom of `RightSettingsPanel`.

**Where to change:**
- `components/color-settings/RightSettingsPanel.tsx` — move button markup

**How it works:**
Move the Delete button from inside `.right-settings-header` to after `<ColorSettingsContent>`, at the bottom of `.right-settings-panel`. Keep the `ConfirmModal` behavior unchanged.

```tsx
// RightSettingsPanel.tsx
<div className="right-settings-panel">
  <div className="right-settings-header">
    <span className="right-settings-title">{color.label} Settings</span>
    {/* Delete button removed from here */}
  </div>

  <ColorSettingsContent color={color} onUpdate={onUpdate} />

  {/* Delete at bottom */}
  <div className="right-settings-footer">
    <button
      className="right-settings-delete"
      onClick={() => setShowDeleteConfirm(true)}
      title="Delete this color"
    >
      Delete
    </button>
  </div>

  {showDeleteConfirm && <ConfirmModal ... />}
</div>
```

## Acceptance Criteria

- [ ] **R1**: Hovering a stop row in DefaultsTable shows an X button; clicking it removes the stop from all three data structures (`defaultLightness`, `defaultContrast`, `stops[]`)
- [ ] **R1**: X button is hidden/disabled when only 2 stops remain
- [ ] **R2**: Hovering a color row in the left panel shows a duplicate icon; clicking it duplicates the color with all settings preserved
- [ ] **R2**: Duplicate icon click does not also select/expand the color row
- [ ] **R3**: New colors get a name matching the closest CSS color (e.g., "DodgerBlue" not "Color 1")
- [ ] **R3**: Duplicate names are handled with a number suffix ("DodgerBlue 2")
- [ ] **R3a**: Changing the base color auto-updates the name if the user hasn't manually edited it
- [ ] **R3a**: Manually editing the name prevents future auto-updates
- [ ] **R4**: Delete color button appears at the bottom of the right settings panel, not in the header
- [ ] All changes work with undo/redo
- [ ] `npm run validate` passes (typecheck + build)
- [ ] Storage version bumped to 8 with backward-compatible migration
- [ ] `docs/FEATURES.md` updated with new capabilities

## Key Decisions (from origin)

- **CSS named colors over Pantone** — standardized, free, zero maintenance (see origin: docs/brainstorms/2026-03-27-ui-improvements-requirements.md)
- **Minimum 2 stops** — a color needs at least 2 stops to be meaningful
- **Delete on hover** — keeps UI clean, buttons appear only when needed
- **Auto-rename tracks via `autoLabel` flag** — simple boolean on the Color type

## Implementation Order

1. **R4** (Move Delete button) — simplest change, good warmup
2. **R1** (Delete color stops) — self-contained in DefaultsTable
3. **R2** (Duplicate button) — needs LeftPanel prop addition + ui.tsx wiring
4. **R3/R3a** (Smart naming) — most complex, new file + type change + migration

## Sources

- **Origin document:** [docs/brainstorms/2026-03-27-ui-improvements-requirements.md](docs/brainstorms/2026-03-27-ui-improvements-requirements.md) — key decisions: CSS color names, min 2 stops, hover-reveal UI, auto-rename tracking
- DefaultsTable: `components/groups/DefaultsTable.tsx`
- LeftPanel: `components/panels/LeftPanel.tsx`
- RightSettingsPanel: `components/color-settings/RightSettingsPanel.tsx`
- Color type: `lib/types.ts:130`
- addColor/duplicateColor: `ui.tsx:131-173`
- Institutional learning: hover handlers should use requestAnimationFrame throttling (from `docs/solutions/code-quality/multi-agent-code-review-findings.md`) — though these are click handlers so not applicable here
