---
date: 2026-03-27
topic: ui-improvements
---

# UI Improvements: Stop Deletion, Color Duplication, Smart Naming

## Problem Frame
Three usability gaps in the current interface:
- Users cannot remove unwanted color stops — once a stop exists, it's permanent
- No visible way to duplicate a color, even though the logic exists. Key use case: set up lightness/contrast values for one color, duplicate it, change the base color to reuse all settings
- New colors get generic names ("Color 1", "Color 2") that don't describe the actual color

## Requirements

- R1. **Delete any color stop**: Users can delete any stop from a color. A small delete button (X) appears on hover next to the stop number in the defaults table (left panel). Minimum 2 stops must remain per color — hide/disable the delete button when only 2 stops are left.

- R2. **Duplicate color button**: Add a duplicate icon on each color row in the left panel, visible on hover. The duplicate logic already exists in `ui.tsx` — this just needs a UI trigger. The icon appears when hovering over the color row header area.

- R3. **Meaningful default color names**: When a new color is added, derive its name from the closest CSS named color (e.g., "DodgerBlue", "Coral", "ForestGreen") instead of "Color 1". Use the 148 standard CSS named colors as the lookup table. Match by finding the nearest color in OKLCH space. If the name is already taken by another color in the list, append a number (e.g., "DodgerBlue 2").

- R3a. **Auto-rename on base color change**: If the user hasn't manually edited the color name (i.e., it's still an auto-generated CSS color name), auto-update the name when the base color changes. If the user has customized the name, leave it alone. This means: track whether a name is "auto-generated" or "user-edited" per color.

- R4. **Move Delete color button**: Move the "Delete" button for deleting an entire color from the top of the right settings panel to the bottom.

## Success Criteria
- Users can remove stops they don't need via hover interaction in the defaults table
- Users can duplicate a color with one click and see the duplicate appear
- New colors get recognizable names that describe the color
- All changes work with undo/redo (existing state management handles this)

## Scope Boundaries
- No changes to the color algorithm or stop generation logic
- No changes to export functionality
- Color names auto-update when the base color changes (unless the user has manually edited the name)
- The CSS color name lookup is a static table, not a runtime dependency

## Key Decisions
- **CSS named colors over Pantone**: CSS names are standardized, free, well-known, and require zero maintenance. Pantone names would add licensing complexity.
- **Minimum 2 stops**: A color needs at least 2 stops to be meaningful in a color system.
- **Delete on hover in defaults table**: Keeps the UI clean — delete buttons only appear when needed.

## Next Steps
→ `/ce:plan` for structured implementation planning
