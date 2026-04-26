# components/ - React UI Components

UI components for Octarine. Platform-agnostic — components access platform features via `usePlatform()` hook from `platform/context.tsx`, not `parent.postMessage` directly.

## Folder Structure

| Folder | Purpose |
|--------|---------|
| `primitives/` | Reusable building blocks (Slider, Toggle, ConfirmModal, SwatchHexInput) |
| `panels/` | Layout containers (LeftPanel, TopBar, ResizeHandle, DefaultsTable) |
| `colors/` | Color row display |
| `color-settings/` | Per-color configuration UI (curves, corrections, quality) |
| `color-picker/` | Gradient picker and hue slider |
| `export/` | Export modal and format options |


## Patterns

**Barrel exports** - Each folder has an `index.ts` that re-exports components:
```tsx
import { Toggle, Slider } from '../primitives';  // Not '../primitives/Toggle'
```

**Props interfaces** - Defined inline above each component, not in types.ts:
```tsx
interface SliderProps {
  label: string;
  value: number;
  // ...
}
export function Slider({ label, value }: SliderProps) { ... }
```

**CSS classes** - Defined in `/styles.css`, not CSS modules. Class names use kebab-case (e.g., `chroma-slider-row`, `right-settings-panel`).

## Layout Structure

The app uses a 3-panel layout defined in `App.tsx`:

| Component | Location | Contents |
|-----------|----------|----------|
| `TopBar` | Top | Undo/redo, background color picker, export button |
| `LeftPanel` | Left column | Flat color list, base color picker, Lightness/Contrast method toggle, DefaultsTable for selected color, Add Color button |
| Middle (inline) | Center column | Swatches for the selected color only |
| `RightSettingsPanel` | Right column | Advanced per-color settings (HK/BB corrections, hue shift curve, chroma curve) |

## Key Components

- `LeftPanel` - Flat color list, base color picker, method toggle, DefaultsTable
- `RightSettingsPanel` - Advanced per-color settings when a color is selected
- `ColorSettingsContent` - The actual settings UI rendered inside RightSettingsPanel
- `TopBar` - Global actions (undo/redo, export, generate)
