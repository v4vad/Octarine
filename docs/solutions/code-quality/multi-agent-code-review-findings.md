---
title: "Multi-Agent Code Review: Curve-Based Stops Feature"
category: code-quality
date: 2026-03-25
tags:
  - code-review
  - type-safety
  - performance
  - security
  - deduplication
  - figma-plugin
modules:
  - lib/types.ts
  - lib/stop-value-curves.ts
  - lib/artistic-curves.ts
  - lib/export-utils.ts
  - lib/figma-utils.ts
  - code.ts
  - components/groups/CurveGraph.tsx
  - components/groups/CurvePopover.tsx
  - components/groups/CurveSelector.tsx
  - components/export/ExportModal.tsx
severity: mixed
---

# Multi-Agent Code Review: Curve-Based Stops Feature

## Problem

After implementing the curve-based stop value generation feature (`feature/curve-based-stops` branch), the codebase accumulated several issues across type safety, security, performance, code duplication, and dead code. A comprehensive multi-agent review was needed before merging.

## Review Approach

Five specialized review agents ran in parallel:

1. **Architecture Strategist** -- module organization, data model, state management
2. **Security Sentinel** -- message passing, persistence, export injection
3. **Performance Oracle** -- render efficiency, computation overhead, memoization
4. **TypeScript Quality Reviewer** -- type safety, modern patterns, React typing
5. **Code Simplicity Reviewer** -- duplication, dead code, YAGNI violations

A post-fix review used two additional agents (correctness + simplicity) to catch issues introduced by the fixes themselves.

## Key Findings and Fixes

### P1: Unsafe Type Assertions in Plugin Message Handling

**Root cause:** `code.ts` typed messages as `{ type: string; [key: string]: unknown }` and used bare `as` casts (`msg.groups as ColorGroup[]`) that could crash on malformed messages.

**Fix:** Defined a `PluginMessage` discriminated union. TypeScript now narrows types in each `case` branch automatically, eliminating all `as` casts.

```typescript
type PluginMessage =
  | { type: 'close' }
  | { type: 'resize'; width: number; height: number }
  | { type: 'notify'; message: string }
  | { type: 'create-variables'; groups: ColorGroup[]; globalConfig?: GlobalConfig; collectionName?: string }
  | { type: 'save-state'; state: AppState }
  | { type: 'request-state' }
  | { type: 'get-selection-color' }
```

**Bonus catch (post-fix review):** The `collectionName` field from ExportModal was being silently dropped because it wasn't in the union type and `createFigmaVariables` hardcoded `'Octarine'`. The discriminated union made this structurally visible. Fixed by threading `collectionName` through.

### P1: No Validation on Persisted State

**Root cause:** `migrateState()` blindly cast `unknown` data to state types. Corrupt saved data would crash deep inside rendering.

**Fix:** Added shape validation at entry and exit of `migrateState`:
- Entry: reject non-object/null state, return `createInitialAppState()`
- v5+ path: validate `groups` is an array and `globalConfig` exists before casting

### P2: CSV Formula Injection in Export

**Root cause:** `generateOKLCH()` inserted user-provided color labels directly into CSV output. Labels starting with `=`, `+`, `-`, `@` could be interpreted as formulas in Excel/Sheets.

**Fix:** Added `escapeCSVField()` that prefixes dangerous fields with a single quote inside double quotes (OWASP-recommended approach).

### P2: Unthrottled Drag Handler in CurveGraph

**Root cause:** Every mouse movement during curve control point drag triggered a full state update and app re-render.

**Fix:** Added `requestAnimationFrame` throttling -- only one update per animation frame. Also added `useEffect` cleanup to cancel pending RAF on unmount (caught by post-fix review).

### Code Duplication Fixes

| Duplication | Resolution |
|-------------|------------|
| `smoothStep` in two files | Exported from `stop-value-curves.ts`, imported in `artistic-curves.ts` |
| `PRESET_LABELS` in CurveSelector + CurvePopover (with inconsistent values) | Consolidated as `STOP_VALUE_PRESET_LABELS` in `types.ts` |
| `getControlPointValues` in CurvePopover duplicating `getCurveControlPoints` | Replaced with existing lib function |
| `generateFullContent()` in ExportModal duplicating `previewContent` memo | Removed, used memo directly |

### Dead Code Removal

- Deleted `StopPopup` component (~140 lines) -- never imported anywhere
- Updated `components/CLAUDE.md` to remove reference to deleted `popups/` folder

### Performance Fix: CurveGraph useMemo

**Root cause:** `padding` object was recreated every render (inline object literal), breaking the `useMemo` dependency comparison for path generation.

**Fix:** Hoisted `padding` to a module-level constant `PADDING`. Removed from dependency array since module constants don't change.

## Prevention Strategies

1. **Use discriminated unions for message protocols.** Any two-context system (Figma plugin/UI, worker/main thread, server/client) should define message types as a discriminated union, not `{ type: string; [key: string]: unknown }`.

2. **Validate persisted data at load boundaries.** Never cast `unknown` data from storage without at least a shape check. The migration system should gracefully fall back to defaults.

3. **Escape user-provided text in export formats.** CSV fields need formula injection protection. CSS variable names were already sanitized -- extend the same rigor to all export paths.

4. **Throttle drag/mouse-move handlers.** Any handler that triggers state updates should use `requestAnimationFrame` or debouncing. Always add cleanup for pending frames on unmount.

5. **Hoist constant objects outside components.** Inline object literals in React components break memoization. If a value never changes, define it at module scope.

6. **Run post-fix reviews.** The post-fix review caught the `collectionName` bug (silently dropped by the new union type) and the RAF cleanup issue. Always review your own fixes.

## Architectural Observations (Not Fixed, Noted for Future)

- **Dual storage (legacy + curves)** in `GroupSettings` is the biggest ongoing maintenance risk. `defaultLightness`/`defaultContrast` are synced manually with `lightnessCurve`/`contrastCurve`. Plan to remove legacy tables.
- **`useCallback` dependencies in `ui.tsx`** capture the full `state` object, defeating memoization. A `useReducer` pattern or functional updater would fix this.
- **Background color is converted 20+ times per color** in the generation pipeline. Converting once and passing the OKLCH result would cut significant computation.
