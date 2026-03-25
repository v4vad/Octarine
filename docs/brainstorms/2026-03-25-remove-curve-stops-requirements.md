---
date: 2026-03-25
topic: remove-curve-stops
---

# Remove Curve-Based Stop Values

## Problem Frame
The curve-based stop value system (CurveSelector, CurvePopover, CurveGraph, presets, overrides) adds too much complexity to the Defaults Table. Users face overlapping controls (presets, graph, sliders, per-stop overrides) with a confusing mental model. The feature should be replaced with a simple editable table.

## Requirements
- R1. Remove the CurveSelector button, CurvePopover, and CurveGraph from the Defaults Table UI
- R2. Remove curve presets (Linear, Lifted Darks, Compressed Range, Expanded Ends) and the "Custom" mode concept
- R3. Stop values in the Defaults Table should be directly editable — type a value, it sticks. No override tracking or "custom mode" switching
- R4. Remove the `StopValueCurve` type, `stop-value-curves.ts` module, and related curve state from `GroupSettings`
- R5. When adding a new stop, auto-calculate its initial value by linear interpolation between its two nearest neighbors
- R6. Keep the existing default stop values (50-900) as hardcoded defaults for new groups
- R7. The artistic curves (hue shift, chroma) in the right panel are NOT affected — those stay as-is

## Success Criteria
- The Defaults Table shows only: method toggle, stop/value table, and Add Stop input
- Editing a value is a single action with no side effects (no mode switching, no override indicators)
- Adding a custom stop produces a sensible interpolated value immediately
- No curve-related UI or state remains in the codebase

## Scope Boundaries
- NOT removing artistic curves (hue shift, chroma) — those are separate and working fine
- NOT changing the generation methods (Lightness/Contrast toggle)
- NOT changing how stop values are consumed by the color generation algorithm

## Key Decisions
- Simple editable table over curve-based generation: curves added complexity without proportional value
- Linear interpolation for new stops: predictable and requires no UI explanation
- Hardcoded defaults for standard stops: the current preset values are good starting points

## Next Steps
-> /ce:plan for structured implementation planning
