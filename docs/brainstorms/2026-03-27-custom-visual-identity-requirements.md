---
date: 2026-03-27
topic: custom-visual-identity
---

# Custom Visual Identity for Octarine

## Problem Frame
Octarine currently uses `react-figma-plugin-ds` for base styling and 329 `--figma-color-*` CSS variable references. This creates three problems:
1. The plugin looks generic — indistinguishable from any Figma plugin
2. The Figma dependency locks Octarine to the Figma ecosystem
3. The styling doesn't reflect Octarine's identity as a premium color tool

## Requirements

- R1. **Remove `react-figma-plugin-ds` dependency**: Strip the Figma DS package and its CSS import. Replace all 329 `--figma-color-*` variable references with a custom token system.

- R2. **Custom design token system**: Create a semantic token layer (e.g., `--oct-bg`, `--oct-text`, `--oct-border`, `--oct-accent`) that maps to raw values. Tokens must support both light and dark modes via a mode class or attribute on the root element.

- R3. **Visual mood — warm, refined, editorial**: The overall feel should be like Linear, Raycast, or Stripe. Clean but warm, subtle depth through shadows and layering, premium without being flashy. Not cold/clinical (no blue-gray). Not playful/rounded (no Notion vibes). Not utility-first (no Tailwind look).

- R4. **Signature accent — warm violet/purple**: The primary accent color should be a warm violet inspired by "octarine" (the colour of magic from Discworld). Used for interactive elements, focus states, active states, and brand moments. Must work well in both light and dark modes.

- R5. **Dual-mode support (light + dark)**: Both modes designed together from the start. Dark mode uses warm charcoal/gray tones (not blue-gray). Light mode uses warm off-white/cream backgrounds (not stark white). The mode toggle mechanism is deferred to planning.

- R6. **Two-font typography**: A distinctive display/heading font paired with a clean body font. Specific font choices deferred to planning (research needed). Fallback plan: revert to single font or system stack if two fonts feel heavy or clash.

- R7. **Preserve layout and functionality**: The three-panel layout, all interactive behaviors, and component structure remain unchanged. This is a reskin, not a redesign. No layout changes, no feature changes.

## Success Criteria
- Plugin looks and feels like a distinct, premium product — not a generic Figma plugin
- Both light and dark modes look intentional and polished
- No visual dependency on `react-figma-plugin-ds` remains
- Generated color swatches remain the visual focus — UI chrome doesn't compete
- Typography feels editorial without being heavy-handed
- The warm violet accent is recognizable as "Octarine's color"

## Scope Boundaries
- No layout changes (three-panel structure stays)
- No feature changes or new functionality
- No component restructuring
- No new build tools or CSS preprocessors (keep plain CSS)
- Font loading strategy is a planning concern, not a brainstorm decision
- Figma dark/light mode detection (if still running inside Figma) deferred to planning

## Key Decisions
- **Remove Figma DS entirely** rather than gradually: cleaner break, avoids mixed visual language
- **Both modes from day one**: designing tokens for dual mode prevents rework
- **Warm violet accent**: brand-consistent, distinctive, not the typical blue/purple that every tool uses
- **Two fonts with fallback plan**: try display + body pairing, revert to one if it doesn't work
- **No Tailwind**: utility-first approach is explicitly rejected for this project

## Outstanding Questions

### Deferred to Planning
- [Affects R2][Needs research] What specific CSS custom property naming convention gives us the best DX? (e.g., `--oct-*`, `--o-*`, category-based)
- [Affects R5][Technical] How should mode switching work? CSS class on `:root`? `data-theme` attribute? `prefers-color-scheme` media query?
- [Affects R5][Technical] When running inside Figma, can we detect Figma's current theme and match it?
- [Affects R6][Needs research] Which specific font pairing fits the "warm, refined, editorial" mood? Research options during planning.
- [Affects R1][Technical] Which `react-figma-plugin-ds` React components (buttons, inputs, selects) are currently used, and what's the replacement strategy — custom components or restyled native elements?

## Next Steps
→ `/ce:plan` for structured implementation planning
