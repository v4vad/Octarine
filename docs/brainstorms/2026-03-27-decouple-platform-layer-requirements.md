---
date: 2026-03-27
topic: decouple-platform-layer
---

# Decouple Platform Layer for Cross-Platform Reuse

## Problem Frame
Octarine's color engine (`lib/`) is already fully standalone, but the React app (`ui.tsx`) is wired directly to Figma's iframe messaging pattern (`parent.postMessage`). This means the UI can't run outside Figma without rewriting the communication and state persistence layer. Restructuring now makes it easy to build a web app, CLI tool, or other integration later without a painful untangling.

## Requirements

- R1. **Platform adapter interface** — Create a typed interface that abstracts all platform-specific operations: state persistence (save/load), notifications, window resize, eyedropper/color picking, and variable export. The React app calls this interface instead of `parent.postMessage()` directly.

- R2. **Figma adapter** — Implement the platform interface using Figma's existing postMessage pattern and `figma.variables.*` APIs. The Figma plugin must work identically after this refactor.

- R3. **Move `figma-utils.ts` out of `lib/`** — This file uses Figma APIs and doesn't belong in the standalone library folder. Move it to the Figma adapter or a dedicated `platform/figma/` location.

- R4. **Stub web adapter** — Create a minimal web adapter that uses `localStorage` for state persistence and no-ops for Figma-specific features (variable export, window resize). This validates the abstraction works but doesn't need to be a full web app.

- R5. **No changes to `lib/` color algorithms** — The color engine, types, conversions, and export formatters stay exactly as they are.

- R6. **Minimal changes to `components/` React UI** — Component structure, styling, and behavior stay the same. Three components (`ColorPickerPopup.tsx`, `ResizeHandle.tsx`, `ExportModal.tsx`) require minimal changes to swap `parent.postMessage` calls for adapter methods and add capability checks. No visual or behavioral changes.

## Success Criteria
- Figma plugin works identically before and after the refactor
- `ui.tsx` has zero direct references to `parent.postMessage` or Figma-specific APIs
- A future developer could wire up the web adapter and run the React app in a browser with minimal additional work
- `lib/` contains zero Figma API imports

## Scope Boundaries
- NOT building a working web app — just the adapter abstraction and a stub
- NOT publishing `lib/` as an npm package — just ensuring it stays clean
- NOT changing the build system (esbuild stays as-is, may need a second entry point for the web stub)
- NOT changing UI layout, features, or visual design
- Minor improvements (better error handling, cleaner state management) are acceptable if they fall out naturally

## Key Decisions
- **Platform adapter pattern over dependency injection**: A simple interface + implementations keeps complexity low and is easy to understand. No framework needed.
- **Stub web adapter over no adapter**: Having a concrete second implementation validates the abstraction actually works, preventing "interface that only fits one implementation" syndrome.
- **Move figma-utils.ts rather than duplicate**: Keeps `lib/` clean as the reusable core.

## Dependencies / Assumptions
- The current visual identity refactor (`refactor/custom-visual-identity` branch) should be completed or merged first to avoid conflicts
- The React components don't import from `figma-utils.ts` directly (confirmed — only `code.ts` imports it)

## Outstanding Questions

### Resolve Before Planning
(None — scope is clear enough to proceed)

### Deferred to Planning
- [Affects R1][Technical] What's the best folder structure? Options include `platform/figma/`, `platform/web/` or `adapters/figma.ts`, `adapters/web.ts`
- [Affects R1][Needs research] Should the adapter be provided via React Context, a module-level singleton, or passed as props to the App component?
- [Affects R4][Technical] Should the web stub include a simple HTML page that loads the React app, or just the adapter file?
- [Affects R2][Technical] How to handle the async request/response pattern (e.g., eyedropper returns a value asynchronously via postMessage) in the adapter interface — callbacks, promises, or observables?

## Next Steps
→ `/ce:plan` for structured implementation planning
