---
date: 2026-03-26
topic: remove-groups
---

# Remove Groups — One Color Per Stop Configuration

## Problem Frame
The current groups model forces colors to share lightness/contrast default values, based on the assumption that shared lightness creates visual harmony across hues. This assumption is flawed: different hues have vastly different gamut shapes in OKLCH, so the same lightness value produces very different chroma levels (e.g., yellow at L=0.93 is vivid and saturated; blue at L=0.93 is nearly grey because its gamut is tiny at high lightness). The `preserveColorIdentity` feature (which caps lightness to maintain visible color at extremes) further breaks shared-lightness consistency by capping differently per hue. The groups model adds UI complexity (accordions, group management, group strips) without delivering its promised value.

## Requirements

### Core: Remove Groups
- R1. Remove the `ColorGroup` concept entirely — no group management, no group accordion, no group strips in the left panel
- R2. Each `Color` owns its full configuration: base color, method (`lightness` or `contrast`), default lightness values, default contrast values, stops, corrections (HK/BB), and artistic curves (hue shift, chroma)
- R3. New `Color` type absorbs fields from `GroupSettings`: `method`, `defaultLightness`, `defaultContrast`. The `GroupSettings` and `ColorGroup` types are removed. `EffectiveSettings` and `generateColorPalette` signatures update to take the new Color type's settings directly.

### UI Layout
- R4. The left panel contains (top to bottom): flat color list, base color picker for the selected color, method toggle, defaults table (stop/value), and Add Stop input
- R5. The middle panel shows the stops/swatches for the **selected color only** (not all colors stacked)
- R6. The right panel shows only advanced/artistic settings: HK/BB corrections, hue shift curves, chroma curves
- R7. Clicking a color in the left panel list selects it: highlights it, shows its swatches in the middle panel, shows its settings (base color, defaults table) in the left panel, and shows its advanced settings in the right panel

### Actions
- R8. "Add Color" button at the bottom of the color list in the left panel. New colors start with hardcoded `DEFAULT_LIGHTNESS` / `DEFAULT_CONTRAST` constants
- R9. "Duplicate Color" action on the color row that copies the entire configuration (base color, stops, defaults, method, corrections, curves) as a new color
- R10. "Delete Color" remains on the color row (with confirmation dialog as today)

### State & Migration
- R11. New `AppState` shape: `{ globalConfig: GlobalConfig, colors: Color[], activeColorId: string | null }`. Remove `groups`, `activeGroupId`, `expandedGroupId`
- R12. Bump `STORAGE_VERSION` to 7. Add v6 migration handler that flattens groups into a colors array. Each color inherits its former group's `method`, `defaultLightness`, and `defaultContrast`. If a color had `methodOverride` set, that becomes its `method`; otherwise the group's method is used. After migration, remove the `methodOverride` field entirely.
- R13. All prior migrations (v1-v5) must still produce v6-shaped state that the new v6 handler can consume
- R14. App starts with one default color (matching current behavior of one default group with one color)

### Export
- R15. Export behavior unchanged (export all colors). Export function signatures update from `ColorGroup[]` to `Color[]`. The `create-variables` message type in `code.ts` sends `colors: Color[]` instead of `groups: ColorGroup[]`

## Success Criteria
- No group-related UI or state remains in the codebase
- Each color independently configurable without affecting others
- Existing users' data migrates cleanly (no data loss)
- The UI has three clear zones: color list + core settings (left), swatches (middle), advanced settings (right)
- Middle panel shows one color at a time; switching is instant via left panel list

## Scope Boundaries
- NOT changing the color generation algorithm
- NOT changing artistic curves (hue shift, chroma) — they're already per-color
- NOT changing export behavior (still exports all colors) — but export code signatures change to match new types
- NOT adding batch editing, multi-select, or linked copies — this is a simplification
- NOT adding color reordering (drag-to-sort) — can be a future enhancement

## Key Decisions
- Remove groups over keeping groups with per-color overrides: the shared-lightness premise doesn't hold across hues with different gamut shapes, and per-color control is the core value of the tool
- Duplicate-and-edit over linked copies: simpler model, users manage consistency manually when they want it
- Flat color list over any hierarchy: one level of organization is sufficient
- One color visible at a time over stacked view: simpler, focused editing workflow
- Base color picker in left panel (not right): keeps core settings together, right panel is only for advanced/artistic controls
- New colors use hardcoded defaults: the `DEFAULT_LIGHTNESS`/`DEFAULT_CONTRAST` constants are good starting points; duplicate handles reuse

## Dependencies / Assumptions
- Assumes users don't rely on group-level batch editing (changing one default to update all colors simultaneously). This is the explicit tradeoff for simplicity.
- Undo/redo history stores AppState snapshots — migration invalidates pre-migration undo history (acceptable since it happens on load)

## Outstanding Questions

### Deferred to Planning
- [Affects R9][Technical] Where to place the Duplicate button — on the color row next to Delete, in a context menu, or both
- [Affects R1][Needs research] Audit all group-related components and state management to map the full removal scope
- [Affects R4][Technical] When "Add Stop" adds a stop number, it should add to both `Color.stops[]` and `Color.defaultLightness`/`defaultContrast`. Confirm whether removing a stop from the table also removes it from the stops array.
- [Affects R15][Technical] Update `PLAN.md` to remove group references from the Import Figma Variables section
- [Affects R15][Technical] Update `FEATURES.md` and other docs that reference groups

## Next Steps
-> /ce:plan for structured implementation planning
