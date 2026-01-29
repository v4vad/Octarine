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

**Key files:** `lib/color-utils.ts` (OKLCH generation), `lib/types.ts` (data model), `lib/figma-utils.ts` (Figma variables)

## Guidelines

- Do not mention Claude in GitHub comments, commit messages, or PR descriptions
- When adding/removing features: update `docs/FEATURES.md`
- When removing features: document in `docs/removed-features.md`
- Keep `PLAN.md` updated when completing roadmap items

## Documentation

| Document | Purpose |
|----------|---------|
| `PLAN.md` | Roadmap, TODOs, product specification |
| `docs/FEATURES.md` | User-facing feature guide |
| `docs/COLOR-ALGORITHM.md` | Color science and algorithm explanations |
| `docs/removed-features.md` | Archive of removed features with rationale |
