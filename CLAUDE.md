# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Octarine is a Figma plugin for generating color systems/palettes with OKLCH color space support. It allows designers to create accessible color palettes directly within Figma.

## Build Commands

```bash
npm run build       # Build plugin (code.js + ui.html)
npm run watch       # Watch mode for development
npm run typecheck   # TypeScript type checking
npm run validate    # Full validation (typecheck + build)
```

## Development Workflow

1. Figma Desktop App is required for testing plugins
2. Import plugin: Figma menu → Plugins → Development → Import plugin from manifest
3. Use Figma's developer console for debugging (right-click → Plugins → Development → Open Console)

## Architecture

Figma plugins have two separate execution contexts that communicate via messages:

- **Plugin Code** (`code.ts` → `code.js`): Runs in Figma's sandbox, has access to the Figma API to read/modify the document and create variables
- **UI Code** (`ui.tsx` → bundled into `ui.html`): Runs in an iframe, displays the React-based user interface

Communication between UI and plugin code uses `figma.ui.postMessage()` and `parent.postMessage()`.

## Project Structure

```
Octarine/
├── manifest.json      # Figma plugin manifest
├── package.json       # Dependencies and scripts
├── build.js           # Build script (esbuild)
├── code.ts            # Figma API code
├── ui.tsx             # React UI
├── styles.css         # Custom styles
├── ui.css             # Figma design system CSS
├── lib/
│   ├── types.ts       # Data model
│   ├── color-utils.ts # OKLCH color generation
│   ├── figma-utils.ts # Figma variable creation
│   └── useHistory.ts  # Undo/redo state management
└── docs/
    ├── FEATURES.md        # User guide (update when features change)
    └── removed-features.md # Archive of removed features
```

## Key Dependencies

- `culori` - OKLCH color space calculations
- `react` / `react-dom` - UI framework
- `react-figma-plugin-ds` - Figma design system components
- `@figma/plugin-typings` - TypeScript types for Figma API

## Color Generation System

**Problem:** When contrast values are close (like 1.05 and 1.15), hex colors can be identical because OKLCH lightness differences are too small for hex's 8-bit precision.

**Solution:** Smart auto-nudging that detects duplicate hex colors and fixes them using a 3-phase approach:
1. **Hue nudge first** - Minimal contrast impact (±1° to ±5°)
2. **Chroma nudge second** - Small contrast impact
3. **Lightness nudge last** - Contrast-aware (knows which direction preserves target)

### Key Functions

- `generateColorPalette()` - Main palette generation with uniqueness guarantee
- `ensureUniqueHexColors()` - Detects and fixes duplicate hex colors

## Guidelines

- Do not mention Claude in GitHub comments, commit messages, or PR descriptions
- When adding or removing user-facing features, update `docs/FEATURES.md`
- When removing features, document them in `docs/removed-features.md` (explains what was removed and why, useful if concepts need to be revisited)
- See `figma-plugin-plan.md` for roadmap and product specification
