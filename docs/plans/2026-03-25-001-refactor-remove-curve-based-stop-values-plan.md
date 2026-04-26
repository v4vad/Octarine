---
title: "refactor: Remove curve-based stop values"
type: refactor
status: active
date: 2026-03-25
origin: docs/brainstorms/2026-03-25-remove-curve-stops-requirements.md
---

# Remove Curve-Based Stop Values

## Overview

Replace the curve-based stop value system (CurveSelector, CurvePopover, CurveGraph, presets, overrides) with a simple directly-editable table. The curve system added too many overlapping controls with a confusing mental model (see origin: `docs/brainstorms/2026-03-25-remove-curve-stops-requirements.md`).

## Problem Statement

The Defaults Table currently has three overlapping ways to set stop values: preset curves, slider controls in a popover, and direct table editing with override tracking. Users find this clunky and confusing. The feature should be simplified to: type a value, it sticks.

## Proposed Solution

Remove all curve-related types, components, and state. The `defaultLightness` / `defaultContrast` fields on `GroupSettings` become the sole source of truth (they were previously marked "DEPRECATED" in favor of curves — now they're promoted back). New stops get values via linear interpolation from neighbors.

## Technical Approach

### Phase 1: Rescue `smoothStep` and delete curve module

`lib/artistic-curves.ts` imports `smoothStep` from `stop-value-curves.ts`. Before deleting the curve module, move `smoothStep` into `artistic-curves.ts` as a local function.

**Files:**

| File | Action |
|------|--------|
| `lib/artistic-curves.ts` | Add `smoothStep` as a local function, remove import from `stop-value-curves` |
| `lib/stop-value-curves.ts` | **Delete entirely** |

### Phase 2: Clean up types and state

Remove all curve-related types and update `GroupSettings`.

**File: `lib/types.ts`**

- Remove `StopValueCurvePreset` type (~line 61)
- Remove `STOP_VALUE_PRESET_LABELS` (~lines 64-70)
- Remove `StopValueCurve` type (~lines 74-82)
- Remove `LIGHTNESS_CURVE_PRESETS` (~lines 85-90)
- Remove `CONTRAST_CURVE_PRESETS` (~lines 93-98)
- Remove `lightnessCurve?` and `contrastCurve?` from `GroupSettings` (~lines 215-216)
- Remove `lightnessCurve`/`contrastCurve` initialization from `createDefaultGroupSettings()` (~lines 302-303)
- Remove "DEPRECATED" comments from `defaultLightness`/`defaultContrast` fields — these are now the primary representation
- Remove `isDefaultLightnessValues()` and `isDefaultContrastValues()` helpers (~lines 487-516)
- Bump `STORAGE_VERSION` from `5` to `6`
- Add v5-to-v6 migration in `migrateState()`: strip `lightnessCurve` and `contrastCurve` from each group's settings
- Rewrite v4 migration branch to skip curve creation (migrate directly to flat tables)

### Phase 3: Simplify color generation

**File: `lib/color-utils.ts`**

- Remove import of `getLightnessFromCurve`, `getContrastFromCurve` (~line 83)
- Remove public re-exports of curve utilities (~lines 66-74)
- Simplify `getLightnessValue()` (~lines 296-307) to direct lookup: `return settings.defaultLightness[stopNum]`
- Simplify `getContrastValue()` (~lines 313-324) to direct lookup: `return settings.defaultContrast[stopNum]`

### Phase 4: Delete curve UI components

**Files to delete:**

- `components/groups/CurveSelector.tsx`
- `components/groups/CurvePopover.tsx`
- `components/groups/CurveGraph.tsx`

**File: `components/groups/index.ts`**

- Remove exports for `CurveSelector`, `CurvePopover`, `CurveGraph` (lines 3-5)

### Phase 5: Rewrite DefaultsTable

**File: `components/groups/DefaultsTable.tsx`**

Remove all curve imports and logic. The component becomes much simpler:

- Remove imports: `StopValueCurve`, `StopValueCurvePreset`, `CurveSelector`, `getLightnessFromCurve`, `getContrastFromCurve`
- Remove: `activeCurve` computation, `displayedValues` useMemo (curves), `hasOverride()`, `handleCurveChange()`, `handleResetOverride()`, `computeLegacyValues()`
- Rewrite `handleValueEdit()` to write directly to `settings.defaultLightness` or `settings.defaultContrast`
- Rewrite `handleAddStop()` with linear interpolation logic:
  - Find the two nearest neighbors (stops immediately above and below the new number)
  - Interpolate: `value = low + (high - low) * (newStop - lowStop) / (highStop - lowStop)`
  - Edge cases:
    - New stop below all existing: use lowest neighbor's value
    - New stop above all existing: use highest neighbor's value
    - Only one stop exists: use method default (0.5 for lightness, 4.5 for contrast)
- Fix duplicate stop check to verify both tables: `settings.defaultLightness[num] !== undefined`
- Remove `<CurveSelector>` from JSX
- Remove `has-override` class and `stop-override-reset` button from table rows

### Phase 6: Clean up CSS

**File: `styles.css`**

Remove the entire "CURVE SELECTOR & POPOVER (Stop Value Curves)" section (~lines 2795-3017):

- All `.curve-selector-*` classes
- All `.curve-popover-*` classes
- All `.curve-graph*` classes
- All `.curve-control-sliders` and `.curve-slider-*` classes
- `.defaults-table tr.has-override` styles
- `.stop-override-reset` and `.stop-override-reset:hover` styles

**Do NOT remove:** `.stop-override-controls` (~line 1250) or `.stop-strip-swatch.has-override` (~line 1411) — those belong to the per-color stop popup, not the Defaults Table.

### Phase 7: Update documentation

Per project conventions (`CLAUDE.md`: "When adding/removing features: update `docs/FEATURES.md`"):

**File: `docs/FEATURES.md`**

- Rewrite the "Curve-Based Stop Values" subsection under "The Defaults Table" — describe simple direct editing instead
- Remove references to presets (Linear, Lifted Darks, etc.), the curve selector, and overrides
- Keep the "Adding Custom Stops" subsection but update to mention interpolation

**File: `docs/removed-features.md`**

- Add entry for curve-based stop values with rationale (too many overlapping controls, confusing mental model)

### Phase 8: Validate

- [x] Run `npm run typecheck` — no TypeScript errors
- [x] Run `npm run build` — builds successfully
- [x] Verify no remaining references to removed types/components: search for `StopValueCurve`, `CurveSelector`, `CurvePopover`, `CurveGraph`, `lightnessCurve`, `contrastCurve`, `stop-value-curves`
- [x] Verify `artistic-curves.ts` still works (imports `smoothStep` locally)

## Acceptance Criteria

- [x] Defaults Table shows only: method toggle, stop/value table, and Add Stop input
- [x] Editing a value writes directly — no mode switching, no override indicators
- [x] Adding a custom stop produces a linearly interpolated value
- [x] No curve-related UI, types, or state remain in the codebase
- [x] Artistic curves (hue shift, chroma) in the right panel work unchanged
- [x] Plugin loads correctly with saved v5 state (migration strips curve fields)
- [x] `npm run validate` passes clean

## Dependencies & Risks

- **`smoothStep` rescue** (Phase 1) must happen before deleting `stop-value-curves.ts` — otherwise artistic curves break
- **State migration** (Phase 2) must handle both v4 and v5 saved states — users may have documents from either version
- **No risk to artistic curves** — hue shift and chroma curves use `artistic-curves.ts`, which is architecturally separate

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-25-remove-curve-stops-requirements.md](docs/brainstorms/2026-03-25-remove-curve-stops-requirements.md) — Key decisions: remove entire curve system, simple editable table, linear interpolation for new stops
- **Institutional learning:** [docs/solutions/code-quality/multi-agent-code-review-findings.md](docs/solutions/code-quality/multi-agent-code-review-findings.md) — flagged dual storage as "biggest ongoing maintenance risk"; this plan resolves that by removing the curve layer entirely
