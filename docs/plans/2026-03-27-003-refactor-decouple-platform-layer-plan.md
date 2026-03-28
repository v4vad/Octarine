---
title: "refactor: Decouple platform layer for cross-platform reuse"
type: refactor
status: completed
date: 2026-03-27
origin: docs/brainstorms/2026-03-27-decouple-platform-layer-requirements.md
---

# refactor: Decouple Platform Layer for Cross-Platform Reuse

## Overview

Introduce a platform adapter abstraction so the React app doesn't know whether it's running inside Figma or a standalone browser. The color engine (`lib/`) is already fully standalone — this refactor targets the thin glue layer between the UI and Figma's iframe messaging/storage APIs.

## Problem Statement / Motivation

The React UI (`ui.tsx`) and two components (`ColorPickerPopup.tsx`, `ResizeHandle.tsx`) call `parent.postMessage()` directly to talk to Figma's sandbox. This means the app can't run outside Figma without rewriting these communication points. Restructuring now — while the codebase is small — makes it trivial to build a web app, CLI tool, or other integration later.

(see origin: `docs/brainstorms/2026-03-27-decouple-platform-layer-requirements.md`)

## Design Decisions

These resolve the outstanding questions from the requirements doc and SpecFlow analysis:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| R6 override | Allow minimal changes to `ColorPickerPopup.tsx`, `ResizeHandle.tsx`, and `ExportModal.tsx` | **Overrides requirements R6** which said "no component changes." These 3 components have direct Figma coupling (`parent.postMessage`) or Figma-specific UI (Variables tab) that must be abstracted. Changes are limited to swapping postMessage calls for adapter methods and adding capability checks — no visual or behavioral changes. The requirements doc should be updated to reflect this. |
| Adapter delivery | React Context (`PlatformContext` + `usePlatform()` hook) | Avoids prop-drilling through components that don't use the adapter. Clean access from deeply nested components like `ColorPickerPopup`. |
| Async pattern | Promise-based methods | `pickColor(): Promise<string \| null>`, `exportVariables(): Promise<result>`. Clean, typed, works with async/await. The Figma adapter wraps postMessage request/response pairs in promises. |
| Capabilities | Adapter exposes `capabilities` object | `{ canExportVariables, canPickColor, canResize }`. ExportModal hides "Figma Variables" tab when `canExportVariables` is false. Eyedropper button hidden when `canPickColor` is false. |
| Web stub | Runnable, not just compilable | A compilable-only stub doesn't validate the abstraction. Minimal `index.html` + second build entry point proves it works. |
| Notifications | Adapter method + web fallback | `notify(message)` — Figma adapter uses `figma.notify()`, web adapter uses a simple DOM toast or `alert()`. |

## Proposed Solution

### Folder Structure

```
platform/
  types.ts          # PlatformAdapter interface + capabilities type
  context.tsx        # PlatformContext + usePlatform() hook
  figma/
    adapter.ts       # FigmaAdapter implements PlatformAdapter
    figma-utils.ts   # Moved from lib/ (Figma variable creation)
    code.ts          # Moved from root (Figma sandbox entry point)
  web/
    adapter.ts       # WebAdapter implements PlatformAdapter (localStorage, no-ops)
    index.html       # Minimal HTML shell to run the React app in a browser
    entry.tsx        # Web entry point (bootstraps React with WebAdapter)
```

**What moves:**
- `code.ts` → `platform/figma/code.ts` (Figma sandbox entry). **Important:** `build.js` must update the entry point from `code.ts` to `platform/figma/code.ts` while keeping `outfile: 'code.js'` at root — `manifest.json` expects `code.js` at the plugin root.
- `lib/figma-utils.ts` → `platform/figma/figma-utils.ts`

**What gets extracted:**
- `App` component extracted from `ui.tsx` into `App.tsx` — currently `App` is a non-exported function inside `ui.tsx`. Both the Figma entry (`ui.tsx`) and web entry (`platform/web/entry.tsx`) need to import it, so it must be a separate, exported module.

**What stays:**
- `ui.tsx` stays at root (Figma-specific entry point: creates `FigmaAdapter`, wraps `<App>` in `<PlatformProvider>`, mounts to DOM)
- `lib/` untouched (color algorithms)
- `components/` mostly untouched (only `ColorPickerPopup.tsx` and `ResizeHandle.tsx` swap `postMessage` for `usePlatform()`)

### Platform Adapter Interface

```typescript
// platform/types.ts

interface PlatformCapabilities {
  canExportVariables: boolean;
  canPickColor: boolean;
  canResize: boolean;
}

interface ExportResult {
  created: number;
  updated: number;
}

interface PlatformAdapter {
  capabilities: PlatformCapabilities;

  // State persistence
  loadState(): Promise<{ version: number; state: unknown } | null>;
  saveState(state: AppState): void;

  // Platform actions
  notify(message: string): void;
  resize(width: number, height: number): void;

  // Figma-specific (guarded by capabilities)
  pickColor(): Promise<string | null>;
  exportVariables(
    colors: Color[],
    globalConfig: GlobalConfig,
    collectionName: string
  ): Promise<ExportResult>;

  // Lifecycle
  onReady(callback: () => void): void;
  destroy(): void;
}
```

### How the Figma Adapter Works

The Figma adapter wraps the existing `parent.postMessage` / `window.addEventListener('message')` pattern. Each request/response pair becomes a promise with a timeout to prevent hangs:

```typescript
// platform/figma/adapter.ts (conceptual)

class FigmaAdapter implements PlatformAdapter {
  capabilities = { canExportVariables: true, canPickColor: true, canResize: true };

  // Helper: wrap a postMessage request/response pair in a promise with timeout
  private requestFromPlugin<T>(
    sendType: string,
    responseType: string,
    payload?: Record<string, unknown>,
    timeoutMs = 5000
  ): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null); // Timeout — return null so app can start fresh
      }, timeoutMs);

      const handler = (event: MessageEvent) => {
        if (event.data.pluginMessage?.type === responseType) {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve(event.data.pluginMessage);
        }
      };
      window.addEventListener('message', handler);
      parent.postMessage({ pluginMessage: { type: sendType, ...payload } }, '*');
    });
  }

  async loadState() {
    return this.requestFromPlugin('request-state', 'load-state');
  }

  // Note: saveState is fire-and-forget. Debouncing is the caller's responsibility
  // (stays in the App component's useEffect, same as today).
  saveState(state) {
    parent.postMessage({ pluginMessage: { type: 'save-state', state } }, '*');
  }

  async pickColor() {
    const result = await this.requestFromPlugin<{ color: string }>(
      'get-selection-color', 'selection-color'
    );
    return result?.color ?? null;
  }

  async exportVariables(colors, globalConfig, collectionName) {
    // Sends 'create-variables', resolves when 'variables-created' response arrives.
    // Note: ExportModal must await this before closing so errors can be shown in UI.
    const result = await this.requestFromPlugin<ExportResult>(
      'create-variables', 'variables-created',
      { colors, globalConfig, collectionName },
      30000 // longer timeout for potentially slow variable creation
    );
    if (!result) throw new Error('Export timed out');
    return result;
  }

  onReady(callback) {
    // Listens for 'plugin-ready' message from code.ts (sent on sandbox startup)
    const handler = (event: MessageEvent) => {
      if (event.data.pluginMessage?.type === 'plugin-ready') {
        window.removeEventListener('message', handler);
        callback();
      }
    };
    window.addEventListener('message', handler);
  }

  // ... etc
}
```

### How the Web Adapter Works

```typescript
// platform/web/adapter.ts (conceptual)

class WebAdapter implements PlatformAdapter {
  capabilities = { canExportVariables: false, canPickColor: false, canResize: false };

  async loadState() {
    const raw = localStorage.getItem('octarine-state');
    if (!raw) return null;
    try {
      // Validate shape before returning (institutional learning: validate at persistence boundaries)
      return JSON.parse(raw);
    } catch {
      return null; // Corrupted data — start fresh
    }
  }

  saveState(state) {
    localStorage.setItem('octarine-state', JSON.stringify({ version: CURRENT_VERSION, state }));
  }

  notify(message) {
    // Simple DOM toast or console.log
  }

  resize() { /* no-op */ }
  async pickColor() { return null; }
  async exportVariables() { throw new Error('Not supported on web'); } // Defensive failsafe — UI should hide the button via capabilities, this throw catches bugs

  onReady(callback) { callback(); } // Immediately ready
  destroy() {}
}
```

## Technical Considerations

### Discriminated Union Pattern
The codebase already uses discriminated unions for plugin messages (institutional learning from `docs/solutions/code-quality/multi-agent-code-review-findings.md`). The adapter interface should use the same pattern for any message types. Since we're wrapping messages in promise-based methods, the union stays internal to the Figma adapter.

### State Validation at Persistence Boundaries
Validation ownership: `adapter.loadState()` returns raw data (or null on failure). The `App` component's `migrateState()` function validates and transforms it. Adapters handle transport errors (JSON parse failures, timeouts) by returning null. The app layer handles schema validation and migration. No validation logic is duplicated between layers.

### Debounce Ownership
The 500ms save debounce stays in the App component (the caller), not inside the adapter. Rationale: the WebAdapter's `localStorage.setItem` is synchronous and doesn't need debouncing for correctness, only performance. Keeping debounce in the App means both adapters get the same throttling behavior without duplicating logic.

### Figma Types Scope
Currently `@figma/plugin-typings` is globally available via `tsconfig.json` typeRoots. Ideally, Figma types should only be available to files in `platform/figma/`. **Compensating control:** Add an ESLint rule or a grep-based check in the validate script that fails if any file outside `platform/figma/` references `figma.*` globals. Defer full tsconfig splitting to a follow-up if build complexity warrants it, but the lint check should ship with this refactor.

### CSS Variables
`ResizeHandle.tsx` uses `var(--figma-color-bg)` and `var(--figma-color-border)` with fallback values. These fallbacks already work in a browser context. The ongoing visual identity refactor (replacing all `--figma-color-*` with `--oct-*` tokens) will eliminate this coupling naturally. **No action needed here.**

### Build System
The build needs two changes (note: requirements doc says "NOT changing the build system" but acknowledged "may need a second entry point for the web stub" — this is that entry point):

```javascript
// Change 1: Update code.ts entry point path (file moved)
// Before: entryPoints: ['code.ts'] → outfile: 'code.js'
// After:  entryPoints: ['platform/figma/code.ts'] → outfile: 'code.js' (output stays at root for manifest.json)

// Change 2: Add web build step
// New: platform/web/entry.tsx → web/index.js
// New: Copy platform/web/index.html → web/index.html (with inlined CSS from styles.css, same pattern as Figma build)
```

The web build must also inline `styles.css` into `web/index.html` (same approach the Figma build uses for `ui.html`).

## System-Wide Impact

- **Interaction graph**: `ui.tsx` currently calls `parent.postMessage` → `code.ts` handles → calls `figma.*` APIs. After: `ui.tsx` calls `adapter.method()` → Figma adapter internally does `parent.postMessage` → `code.ts` handles same as before. The chain is identical, with one added indirection.
- **Error propagation**: Currently errors in `code.ts` are shown via `figma.notify()` and never reach the UI. After: `adapter.exportVariables()` can reject its promise, letting `ui.tsx` handle errors in the UI layer. This is a minor improvement.
- **State lifecycle risks**: None. The state shape (`AppState`) doesn't change. The migration system stays in `ui.tsx`. Only the transport changes (postMessage vs localStorage).
- **API surface parity**: The adapter interface becomes the new contract. Both adapters must implement the same interface — TypeScript enforces this.

## Acceptance Criteria

### Functional Requirements
- [ ] Figma plugin works identically before and after (manual test in Figma Desktop)
- [ ] `ui.tsx` has zero direct `parent.postMessage` calls
- [ ] `ColorPickerPopup.tsx` and `ResizeHandle.tsx` use `usePlatform()` instead of `parent.postMessage`
- [ ] `lib/` directory contains zero Figma API imports (including `figma-utils.ts` moved out)
- [ ] Web stub loads in a browser, renders the React app, and persists state to localStorage
- [ ] ExportModal hides "Figma Variables" tab when running on web adapter
- [ ] Eyedropper button is hidden when running on web adapter
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Build produces both Figma plugin output and web stub output

### Non-Functional Requirements
- [ ] No regression in Figma plugin performance
- [ ] Adapter interface is simple and documented with JSDoc comments
- [ ] Web stub renders correctly with full CSS (no unstyled content)
- [ ] Figma types boundary check passes (no `figma.*` references outside `platform/figma/`)

## Implementation Phases

### Phase 1: Create the Adapter Interface and Context

**Files to create:**
- `platform/types.ts` — `PlatformAdapter` interface, `PlatformCapabilities` type, `ExportResult` type
- `platform/context.tsx` — `PlatformContext`, `PlatformProvider` component, `usePlatform()` hook

**Verification:** TypeScript compiles. No runtime changes yet.

### Phase 2: Build the Figma Adapter and Move Files

**Blocked by:** Phase 1 (needs the interface definition)

**Files to create:**
- `platform/figma/adapter.ts` — `FigmaAdapter` class implementing `PlatformAdapter`
  - Uses `requestFromPlugin()` helper for all request/response pairs (returns promise with 5s timeout)
  - `exportVariables()` uses 30s timeout (variable creation can be slow)
  - `onReady()` listens for `plugin-ready` message from code.ts
  - Fire-and-forget calls (saveState, resize, notify) stay synchronous

**Files to move:**
- `lib/figma-utils.ts` → `platform/figma/figma-utils.ts`
  - Update imports in the moved file
  - Grep all imports from the old path and update them (`code.ts` is the only importer)
- `code.ts` → `platform/figma/code.ts`
  - Update `build.js` entry point: `entryPoints: ['platform/figma/code.ts']`, keep `outfile: 'code.js'` (root, for manifest.json)
  - Update import of `createFigmaVariables` to relative `./figma-utils`

**Verification:** TypeScript compiles. `npm run build` still produces `code.js` at root. No runtime changes yet — adapter exists but isn't wired in.

### Phase 3: Extract App Component and Wire the Figma Adapter

**Blocked by:** Phase 2 (needs adapter + moved files)

**Files to create:**
- `App.tsx` — Extract the `App` function component from `ui.tsx` into its own file. Export it as the default export. This is needed because both `ui.tsx` (Figma entry) and `platform/web/entry.tsx` (web entry) need to import it.

**Files to modify:**
- `ui.tsx` — Becomes the Figma-specific entry point:
  - Remove the `App` function (now in `App.tsx`)
  - Import `App` from `./App`
  - Import `FigmaAdapter` from `./platform/figma/adapter`
  - Import `PlatformProvider` from `./platform/context`
  - Create `FigmaAdapter` instance, wrap `<App>` in `<PlatformProvider adapter={figmaAdapter}>`
  - Remove all `parent.postMessage` calls and `window.addEventListener('message')` listeners
- `App.tsx` — Uses `usePlatform()` hook for all platform operations:
  - `adapter.loadState()` replaces request-state/load-state message pair
  - `adapter.saveState()` replaces save-state postMessage (debounce stays here)
  - `adapter.exportVariables()` replaces create-variables postMessage — **ExportModal must `await` the result before closing** so errors can surface in the UI
- `components/color-picker/ColorPickerPopup.tsx` — Replace `parent.postMessage` eyedropper call with `const adapter = usePlatform(); adapter.pickColor()`. Remove manual message listener. Hide eyedropper button when `!adapter.capabilities.canPickColor`.
- `components/panels/ResizeHandle.tsx` — Replace `parent.postMessage` resize call with `adapter.resize()`.
- `components/export/ExportModal.tsx` — Read `adapter.capabilities.canExportVariables` to conditionally show/hide the Figma Variables tab. Make export handler async to await `adapter.exportVariables()`.

**Verification:** `npm run validate` passes. Manual test in Figma Desktop — all features work identically (add color, generate palette, eyedropper, export to variables, resize, undo/redo, auto-save/load).

### Phase 4: Build the Web Stub Adapter

**Blocked by:** Phase 3 (needs `App.tsx` extracted and `PlatformProvider` wired)

**Files to create:**
- `platform/web/adapter.ts` — `WebAdapter` class implementing `PlatformAdapter`
  - `loadState()` reads from `localStorage`
  - `saveState()` writes to `localStorage`
  - `notify()` — simple console.log or DOM toast
  - `pickColor()` returns `null`
  - `exportVariables()` throws "not supported"
  - `resize()` no-op
  - Capabilities: `{ canExportVariables: false, canPickColor: false, canResize: false }`
- `platform/web/entry.tsx` — Creates `WebAdapter`, renders `<PlatformProvider adapter={webAdapter}><App /></PlatformProvider>`
- `platform/web/index.html` — Minimal HTML shell

**Files to modify:**
- `build.js` — Add a web build step: `platform/web/entry.tsx` → `web/index.js`. Generate `web/index.html` using the same inlining pattern as the Figma build (read `styles.css`, inline JS + CSS into HTML template). The web `index.html` template lives at `platform/web/index.html` as a source template.

**Verification:** Open `web/index.html` in a browser. The React app renders, colors can be added, palettes generate, CSS/JSON export works, state persists across page reloads. Figma-specific features (eyedropper, variable export, resize) are hidden or gracefully disabled.

### Phase 5: Cleanup and Documentation

- [ ] Update `CLAUDE.md` architecture section to reflect new `platform/` folder
- [ ] Update `components/CLAUDE.md` if component imports changed
- [ ] Update `lib/CLAUDE.md` to note `figma-utils.ts` moved to `platform/figma/`
- [ ] Run `npm run validate` one final time
- [ ] Manual test in Figma Desktop (full feature walkthrough)
- [ ] Manual test web stub in browser

## Dependencies & Prerequisites

- The visual identity refactor (`refactor/custom-visual-identity` branch) should be completed or merged first to avoid conflicts with `styles.css` and component changes (see origin: requirements doc Dependencies section)
- No new npm dependencies required — React Context, Promises, and localStorage are all built-in

## Success Metrics

- Zero `parent.postMessage` calls outside of `platform/figma/`
- Zero `figma.*` API calls outside of `platform/figma/` and `code.ts`
- Web stub renders and functions for non-Figma features
- Figma plugin behavior is unchanged (manual verification)

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-03-27-decouple-platform-layer-requirements.md](docs/brainstorms/2026-03-27-decouple-platform-layer-requirements.md) — Key decisions carried forward: platform adapter pattern over DI, stub web adapter to validate abstraction, move figma-utils.ts out of lib/

### Internal References

- Discriminated union pattern: `docs/solutions/code-quality/multi-agent-code-review-findings.md`
- State migration pattern: `docs/solutions/code-quality/removing-curve-based-stop-values.md`
- Current Figma coupling in `ui.tsx:82,130,221-231` (postMessage calls)
- Current Figma coupling in `components/color-picker/ColorPickerPopup.tsx:30-31,79`
- Current Figma coupling in `components/panels/ResizeHandle.tsx:15-16`
- Build configuration: `build.js`
- Plugin types: `lib/types.ts`
