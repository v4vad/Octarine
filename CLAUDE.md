# CLAUDE.md

Octarine is a Figma plugin for generating accessible color systems using OKLCH color space.

## Quick Reference

```bash
npm run build       # Build plugin (code.js + ui.html)
npm run watch       # Watch mode for development
npm run typecheck   # TypeScript type checking
npm run validate    # Full validation (typecheck + build)
```

**Testing:** Requires Figma Desktop App. Import via Plugins → Development → Import plugin from manifest.

## Architecture

Figma plugins have **two execution contexts** that communicate via messages:

| Context | File | Role |
|---------|------|------|
| Plugin Code | `code.ts` → `code.js` | Figma API access (read/modify document, create variables) |
| UI Code | `ui.tsx` → `ui.html` | React interface (runs in iframe) |

**Key files:** `lib/` (color algorithms), `components/` (React UI) - each has its own CLAUDE.md

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│ TopBar: [undo][redo] Background color     [export]  │
├──────────────┬─────────────────┬────────────────────┤
│ LeftPanel    │ Middle Panel    │ RightSettingsPanel │
│ Group strips │ Color rows      │ Per-color settings │
│ Defaults tbl │ + Add Color     │ (when selected)    │
│ + Add Group  │                 │                    │
└──────────────┴─────────────────┴────────────────────┘
```

Key files: `ui.tsx` (layout), `components/panels/` (TopBar, LeftPanel), `components/color-settings/RightSettingsPanel.tsx`

## Guidelines

- Do not mention Claude in GitHub comments, commit messages, or PR descriptions
- When adding/removing features OR changing UI layout: update `docs/FEATURES.md`
- When changing component structure: update `components/CLAUDE.md`
- When removing features: document in `docs/removed-features.md`
- Keep `PLAN.md` updated when completing roadmap items

## Agent Delegation

Use subagents for cost-effective model selection:

| Task Type | Agent | Model | Examples |
|-----------|-------|-------|----------|
| Quick commands | `quick-executor` | Haiku | `git status`, `npm run build/watch/validate/typecheck` |
| Coding work | `coder` | Sonnet | Writing TypeScript/React, color algorithm work, component changes |
| Deep thinking | `architect` | Opus | Architecture decisions, complex color science, refactoring |

## Documentation

| Document | Purpose |
|----------|---------|
| `PLAN.md` | Roadmap, TODOs |
| `docs/FEATURES.md` | User-facing feature guide |
| `docs/COLOR-ALGORITHM.md` | Color science and algorithm explanations |
| `docs/removed-features.md` | Archive of removed features with rationale |
