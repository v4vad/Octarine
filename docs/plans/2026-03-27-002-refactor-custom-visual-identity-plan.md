---
title: "refactor: Custom Visual Identity for Octarine"
type: refactor
status: active
date: 2026-03-27
origin: docs/brainstorms/2026-03-27-custom-visual-identity-requirements.md
---

# refactor: Custom Visual Identity for Octarine

## Overview

Strip the `react-figma-plugin-ds` CSS dependency and replace all 329 `--figma-color-*` variable references with a custom design token system. Create a warm, refined, editorial visual identity with a signature warm-violet accent, dual light/dark mode support, and two-font typography. No layout or feature changes — purely a reskin.

## Problem Statement

Octarine looks like every other Figma plugin. The `react-figma-plugin-ds` package provides generic styling that doesn't reflect Octarine's identity as a premium color tool. The Figma dependency also locks the project to the Figma ecosystem. (see origin: docs/brainstorms/2026-03-27-custom-visual-identity-requirements.md)

## Proposed Solution

### Token Architecture

Replace `--figma-color-*` variables with a semantic `--oct-*` token system. Define raw color values as primitives, then map them to semantic roles:

```css
/* styles.css — Primitive palette */
:root {
  /* Warm neutrals */
  --oct-gray-50: #faf9f7;    /* warm off-white */
  --oct-gray-100: #f3f1ed;
  --oct-gray-200: #e8e4de;
  --oct-gray-300: #d4cfc6;
  --oct-gray-400: #a8a29e;
  --oct-gray-500: #78716c;
  --oct-gray-600: #57534e;
  --oct-gray-700: #44403c;
  --oct-gray-800: #292524;
  --oct-gray-900: #1c1917;
  --oct-gray-950: #0f0e0d;

  /* Signature accent — warm violet */
  --oct-violet-400: #b07cc7;
  --oct-violet-500: #9b5fb5;  /* primary accent */
  --oct-violet-600: #8347a3;

  /* Semantic status colors */
  --oct-danger: #e54d4d;
  --oct-warning: #e5a94d;
  --oct-success: #4dba6d;
}

/* Light mode (default) */
:root, [data-theme="light"] {
  --oct-bg: var(--oct-gray-50);
  --oct-bg-secondary: var(--oct-gray-100);
  --oct-bg-hover: var(--oct-gray-200);
  --oct-bg-active: var(--oct-gray-300);
  --oct-text: var(--oct-gray-900);
  --oct-text-secondary: var(--oct-gray-500);
  --oct-text-tertiary: var(--oct-gray-400);
  --oct-border: var(--oct-gray-200);
  --oct-border-strong: var(--oct-gray-300);
  --oct-accent: var(--oct-violet-500);
  --oct-accent-hover: var(--oct-violet-600);
  --oct-accent-subtle: rgba(155, 95, 181, 0.1);
  --oct-shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --oct-shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --oct-shadow-popup: 0 4px 16px rgba(0,0,0,0.12);
}

/* Dark mode */
[data-theme="dark"] {
  --oct-bg: var(--oct-gray-950);
  --oct-bg-secondary: var(--oct-gray-900);
  --oct-bg-hover: var(--oct-gray-800);
  --oct-bg-active: var(--oct-gray-700);
  --oct-text: var(--oct-gray-100);
  --oct-text-secondary: var(--oct-gray-400);
  --oct-text-tertiary: var(--oct-gray-600);
  --oct-border: var(--oct-gray-800);
  --oct-border-strong: var(--oct-gray-700);
  --oct-accent: var(--oct-violet-400);
  --oct-accent-hover: var(--oct-violet-500);
  --oct-accent-subtle: rgba(176, 124, 199, 0.12);
  --oct-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --oct-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --oct-shadow-popup: 0 4px 16px rgba(0,0,0,0.5);
}
```

### Mode Switching

Use `data-theme` attribute on the root `<div>`. This works both:
- **Inside Figma**: Detect Figma's theme via the `figma-plugin-ds` CSS variables at load time, or default to dark
- **Standalone**: Toggle via a UI control or `prefers-color-scheme` media query

### Typography

Two-font approach with fallback plan (see origin):

```css
:root {
  /* Display font — for headings, panel titles, color names */
  --oct-font-display: 'Fraunces', system-ui, sans-serif;
  /* Body font — for values, labels, controls */
  --oct-font-body: 'Plus Jakarta Sans', system-ui, sans-serif;
  /* Mono — unchanged */
  --oct-font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}
```

**Font choices rationale:**
- **Fraunces** — warm soft-serif display font with variable axes for weight, optical size, softness (SOFT), and wonkiness (WONK). Inspired by early 20th-century warm faces. Feels artistic and crafted without being decorative. Use at 14px+ for headings, panel titles, color names.
- **Plus Jakarta Sans** — geometric sans-serif with elevated x-height for readability at small sizes (10-14px). Open counters and balanced spacing. Good for values, labels, inputs, small UI text.
- Both are free on Google Fonts (OFL license). This combination is genuinely rare in the wild.
- **Fallback plan**: If two fonts feel heavy, collapse to Plus Jakarta Sans-only with weight variation for hierarchy.

### Variable Mapping Reference

Every `--figma-color-*` variable maps to a `--oct-*` equivalent:

| Figma Variable | Octarine Token |
|---|---|
| `--figma-color-bg` | `--oct-bg` |
| `--figma-color-bg-secondary` | `--oct-bg-secondary` |
| `--figma-color-bg-hover` | `--oct-bg-hover` |
| `--figma-color-bg-brand` | `--oct-accent` |
| `--figma-color-bg-brand-tertiary` | `--oct-accent-subtle` |
| `--figma-color-text` | `--oct-text` |
| `--figma-color-text-secondary` | `--oct-text-secondary` |
| `--figma-color-text-tertiary` | `--oct-text-tertiary` |
| `--figma-color-text-brand` | `--oct-accent` |
| `--figma-color-text-danger` | `--oct-danger` |
| `--figma-color-text-warning` | `--oct-warning` |
| `--figma-color-border` | `--oct-border` |
| `--figma-color-border-brand` | `--oct-accent` |
| `--figma-color-bg-warning` | `var(--oct-warning) / 0.15` |
| `--figma-color-border-warning` | `--oct-warning` |

## Implementation Phases

### Phase 1: Token Foundation

**Goal:** Create the design token system and replace the Figma CSS import without changing any visual appearance yet.

**Tasks:**
1. Define all `--oct-*` primitive and semantic tokens in `styles.css` `:root` and `[data-theme="dark"]`
2. Find-and-replace all 329 `--figma-color-*` references in `styles.css` with `--oct-*` equivalents
3. Remove `import 'react-figma-plugin-ds/figma-plugin-ds.css'` from `ui.tsx`
4. Remove `react-figma-plugin-ds` from `package.json` and run `npm install`
5. Add any base resets that Figma DS was providing (box-sizing, font smoothing, etc.)
6. Add `data-theme="dark"` attribute to the app container in `ui.tsx` (default to dark for now)

**Verification:** Plugin builds and renders correctly with no visual regressions (it will look different from Figma native, but all elements must be visible and functional).

**Files:**
- `styles.css` (token definitions + variable replacement)
- `ui.tsx` (remove import, add data-theme)
- `package.json` (remove dependency)

### Phase 2: Visual Refinement

**Goal:** Apply the warm, refined, editorial aesthetic.

**Tasks:**
1. Tune the warm neutral palette — adjust gray tones to feel warm, not cold
2. Apply the warm violet accent to interactive elements (buttons, focus rings, active states, toggles)
3. Add subtle depth with refined shadows and border treatments
4. Adjust border-radius values if needed (slightly larger for warmth)
5. Add subtle background gradients or texture if it enhances the premium feel
6. Style the export modal to match the new aesthetic
7. Ensure generated color swatches remain the visual focus — UI chrome should not compete

**Verification:** Side-by-side comparison of light and dark modes. Both should feel intentionally designed, not just inverted.

**Files:**
- `styles.css` (tuning token values + adding refinement styles)

### Phase 3: Typography

**Goal:** Add the two-font system.

**Tasks:**
1. Add font loading for Fraunces and Inter (via `@font-face` or Google Fonts link in `build.js`)
2. Apply `--oct-font-display` to headings, panel titles, color names, button text
3. Apply `--oct-font-body` to values, labels, small text, inputs
4. Adjust font sizes and weights for the new fonts (Fraunces may need different sizing than the current stack)
5. Test both fonts at all sizes used in the UI
6. Evaluate: does the two-font approach work? If not, collapse to Inter-only

**Verification:** Typography feels editorial and readable at all sizes. No clipping, overflow, or awkward spacing.

**Files:**
- `styles.css` (font-face declarations + font-family assignments)
- `build.js` (may need to inline font files or add link tags)

### Phase 4: Theme Toggle + Figma Detection

**Goal:** Wire up theme switching.

**Tasks:**
1. Add a theme toggle control to the TopBar (simple light/dark switch)
2. Persist theme preference (localStorage or Figma clientStorage)
3. When running inside Figma: detect Figma's theme at startup and match it as default
4. When running standalone: respect `prefers-color-scheme` as default
5. Both dark and light modes should be complete and polished

**Verification:** Toggle works, preference persists across sessions, Figma theme detection works.

**Files:**
- `ui.tsx` (theme state + toggle logic)
- `components/panels/TopBar.tsx` (toggle UI)
- `styles.css` (toggle button styling)

## Acceptance Criteria

- [ ] `react-figma-plugin-ds` fully removed (package.json, import, no `--figma-color-*` references)
- [ ] All 329 Figma variable references replaced with `--oct-*` tokens
- [ ] Light mode: warm off-white backgrounds, readable text, violet accents
- [ ] Dark mode: warm charcoal backgrounds, not blue-gray, violet accents
- [ ] Warm violet accent used for interactive elements, focus states, active states
- [ ] Two-font typography applied (Fraunces display + Inter body), or fallback to single font with documented reason
- [ ] Theme toggle in TopBar, persists preference
- [ ] Generated color swatches remain the visual hero — UI chrome doesn't compete
- [ ] Plugin doesn't look like Tailwind, Material Design, or generic Figma
- [ ] `npm run validate` passes
- [ ] No layout or feature changes — same three-panel structure, same functionality

## Scope Boundaries (from origin)

- No layout changes
- No feature changes
- No component restructuring
- No new build tools or CSS preprocessors
- Stays plain CSS

## Key Decisions (from origin)

- **Remove Figma DS entirely** rather than gradually — cleaner break
- **Both modes from day one** — prevents rework
- **Warm violet accent** — brand-consistent "colour of magic"
- **Two fonts with fallback** — try Fraunces + Inter, revert if it doesn't work
- **No Tailwind** — explicitly rejected
- **`data-theme` attribute** for mode switching — works in both Figma and standalone contexts
- **`--oct-*` prefix** for all custom tokens — clear namespace, good DX

## Dependencies & Risks

- **Font loading in Figma plugins**: Figma plugins run in an iframe. Google Fonts links work, but bundling font files inline may be more reliable. Research during Phase 3.
- **Figma theme detection**: The `react-figma-plugin-ds` CSS previously handled this. After removal, we need to detect Figma's theme ourselves (via `figma.ui.theme` message or checking computed styles). May require a small code.ts change.
- **Risk: two fonts feel heavy**: Mitigated by the explicit fallback plan — collapse to Inter-only if needed.

## Sources

- **Origin document:** [docs/brainstorms/2026-03-27-custom-visual-identity-requirements.md](docs/brainstorms/2026-03-27-custom-visual-identity-requirements.md) — key decisions: warm violet accent, dual mode, two-font typography, remove Figma DS entirely
- Current token system: `styles.css:1-70`
- Figma DS import: `ui.tsx:3`
- Current Figma variable usage: 329 references in `styles.css`
