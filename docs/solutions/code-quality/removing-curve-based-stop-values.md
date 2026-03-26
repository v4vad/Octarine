---
title: "Removing curve-based stop values: simplifying overlapping UI controls"
category: code-quality
date: 2026-03-25
tags:
  - refactor
  - simplification
  - ui-cleanup
  - state-migration
  - feature-removal
module:
  - lib/types.ts
  - lib/color-utils.ts
  - lib/artistic-curves.ts
  - components/groups/DefaultsTable.tsx
severity: medium
problem_type: simplification
---

# Removing Curve-Based Stop Values

## Problem

The curve-based stop value system created three overlapping ways to set the same value:

1. **Preset curves** (Linear, Lifted Darks, etc.) via a CurveSelector dropdown
2. **Slider controls** in a CurvePopover with a visual graph and 3 control points
3. **Direct table editing** that switched to "Custom" mode and tracked per-stop overrides with reset buttons

Users found this clunky and confusing. The mental model of "curve generates values, but you can override individual ones" was hard to follow.

Additionally, the data model had a **dual storage risk**: `defaultLightness`/`defaultContrast` (flat lookup tables) had to be manually kept in sync with `lightnessCurve`/`contrastCurve` (curve objects). This was flagged as "the biggest ongoing maintenance risk" in the [multi-agent code review](../code-quality/multi-agent-code-review-findings.md).

## Root Cause

The curve system was over-engineered for the actual user need. Most users just want to type a value and have it stick. The presets, sliders, graph, and override tracking added complexity without proportional value.

## Solution

Replace the entire curve system with a simple directly-editable table. Type a value, it updates. No modes, no overrides, no presets.

### What was deleted (4 files, ~760 lines)

- `lib/stop-value-curves.ts` — interpolation engine
- `components/groups/CurveGraph.tsx` — SVG curve editor with draggable points
- `components/groups/CurvePopover.tsx` — popup with presets, graph, and sliders
- `components/groups/CurveSelector.tsx` — preset dropdown button
- ~225 lines of curve-related CSS

### What was simplified

**GroupSettings** went from dual storage to single source of truth:

```typescript
// Before: dual storage with sync requirement
export type GroupSettings = {
  method: ColorMethod
  defaultLightness: Record<number, number>   // "DEPRECATED"
  defaultContrast: Record<number, number>    // "DEPRECATED"
  lightnessCurve?: StopValueCurve            // new, had to stay in sync
  contrastCurve?: StopValueCurve             // new, had to stay in sync
}

// After: simple and direct
export type GroupSettings = {
  method: ColorMethod
  defaultLightness: Record<number, number>
  defaultContrast: Record<number, number>
}
```

**Color generation** went from curve-based lookup to direct table lookup:

```typescript
// Before: helper function checked curve, then fell back to table
if (settings.lightnessCurve) {
  return getLightnessFromCurve(stopNum, allStops, settings.lightnessCurve)
}
return settings.defaultLightness[stopNum] ?? 0.5

// After: direct lookup
targetL = stop.lightnessOverride ??
  globalSettings.defaultLightness[stopNum] ?? 0.5
```

### Key pattern: linear interpolation for new stops

When users add a custom stop (e.g., 150), the value is interpolated from neighbors:

```typescript
function interpolateValue(
  newStop: number,
  existing: Record<number, number>,
  fallback: number
): number {
  const sorted = Object.keys(existing).map(Number).sort((a, b) => a - b);
  let lower: number | undefined;
  let upper: number | undefined;
  for (const s of sorted) {
    if (s < newStop) lower = s;
    if (s > newStop && upper === undefined) upper = s;
  }
  if (lower !== undefined && upper !== undefined) {
    const t = (newStop - lower) / (upper - lower);
    return existing[lower] + (existing[upper] - existing[lower]) * t;
  }
  if (lower !== undefined) return existing[lower];
  if (upper !== undefined) return existing[upper];
  return fallback;
}
```

### Key pattern: state migration with destructuring

The v5-to-v6 migration strips curve fields using rest destructuring:

```typescript
if (persisted.version === 5) {
  const oldState = persisted.state as AppState
  const migratedGroups = oldState.groups.map(group => {
    const { lightnessCurve, contrastCurve, ...cleanSettings } = group.settings as GroupSettings & {
      lightnessCurve?: unknown
      contrastCurve?: unknown
    }
    return { ...group, settings: cleanSettings as GroupSettings }
  })
  // ...
}
```

This pattern avoids importing deleted types — widening to `unknown` lets TypeScript destructure fields that no longer exist in the current type definition.

### Critical dependency: rescuing smoothStep

`lib/artistic-curves.ts` imported `smoothStep` from the deleted `stop-value-curves.ts`. This had to be inlined as a local function **before** deleting the module, or the hue shift and chroma curves would break.

## Prevention

1. **Avoid dual storage** — if two data structures represent the same information, one will inevitably fall out of sync. Pick one source of truth.
2. **Count the control surfaces** — if users have 3+ ways to set the same value, the UI is over-designed. Simplify to one clear path.
3. **Check for shared utilities before deleting modules** — grep for all imports from a module before removing it. `smoothStep` was a shared math function that happened to live in a domain-specific module.
4. **If presets are wanted later** — implement them as "fill table with these values" buttons, not as a persistent curve system. Same convenience, no ongoing complexity.

## Related

- [Multi-agent code review findings](../code-quality/multi-agent-code-review-findings.md) — flagged dual storage as the biggest maintenance risk
- [Removed features archive](../../removed-features.md#curve-based-stop-values) — full rationale and "if revisiting" guidance
- [Requirements document](../../brainstorms/2026-03-25-remove-curve-stops-requirements.md) — brainstorm decisions
- [Implementation plan](../../plans/2026-03-25-001-refactor-remove-curve-based-stop-values-plan.md) — 8-phase execution plan
