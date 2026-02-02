# components/ - React UI Components

UI components for Octarine's Figma plugin interface. Uses `react-figma-plugin-ds` for Figma-native styling.

## Folder Structure

| Folder | Purpose |
|--------|---------|
| `primitives/` | Reusable building blocks (Slider, Toggle, ConfirmModal) |
| `panels/` | Layout containers (LeftPanel, TopBar, ResizeHandle) |
| `groups/` | Color group management (GroupAccordionItem, DefaultsTable) |
| `colors/` | Color row display |
| `color-settings/` | Per-color configuration UI (curves, corrections, quality) |
| `color-picker/` | Gradient picker and hue slider |
| `popups/` | Modal dialogs (StopPopup) |
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

## Key Components

- `LeftPanel` - Group accordion, manages color groups
- `RightSettingsPanel` - Per-color settings when a color is selected
- `ColorSettingsContent` - The actual settings UI (shared between panel and popup)
- `TopBar` - Global actions (undo/redo, export, generate)
