# Color Algorithm Documentation

This document explains the color science and algorithms behind Octarine's color system generation.

## Overview

Octarine uses **OKLCH color space** for all color operations. OKLCH stands for:
- **O** = OK (the name of the improved color model)
- **L** = Lightness (0 = black, 1 = white)
- **C** = Chroma (0 = gray, higher = more colorful)
- **H** = Hue (0-360 degrees, like a color wheel)

OKLCH is preferred over RGB or HSL because it's **perceptually uniform** - a 10-unit change in lightness looks like the same amount of change whether you start from dark or light colors.

---

## Core Concepts

### 1. Contrast Calculation (WCAG)

We calculate contrast ratios for accessibility using the **WCAG 2.1 formula**:

1. Convert each color to relative luminance (how bright it appears)
2. Contrast ratio = (lighter + 0.05) / (darker + 0.05)

A ratio of 4.5:1 meets WCAG AA for normal text. A ratio of 7:1 meets AAA.

**Why this matters:** When generating color stops, we can target specific contrast ratios against a background color to ensure accessibility.

### 2. Gamut Handling

Not all OKLCH colors can be displayed on screens (sRGB gamut). When a color is "out of gamut":

- **Chroma clamping:** We reduce saturation until the color is displayable
- **Gamut lookup table:** Pre-computed maximum chroma values for each hue/lightness combination for fast lookups

The gamut lookup table lives in `lib/gamut-table.ts` and provides two key functions:
- `getMaxChroma(L, hue)` - Maximum displayable chroma at a given lightness and hue
- `clampChromaToGamut(chroma, L, hue)` - Clamp chroma to fit in sRGB

### 3. Smart Minimum Chroma

**Problem:** At very high lightness (like stop 50), colors lose their identity and appear gray.

**Solution:** For each hue, we calculate the maximum lightness that still allows enough chroma to appear colored:

| Hue Region | Minimum Chroma | Notes |
|------------|---------------|-------|
| Blues (200-280°) | 0.025 | Tightest gamut at high L |
| Cyans/Magentas | 0.020 | Medium constraint |
| Reds/Greens | 0.015 | More forgiving |
| Yellows (40-80°) | 0.012 | Most generous gamut |

When generating light stops, we cap lightness at the point where minimum chroma can still be achieved.

---

## Perceptual Corrections

### Helmholtz-Kohlrausch (HK) Effect

**What it is:** Saturated colors appear brighter than their measured luminance suggests. A vivid blue at L=0.5 looks brighter than a gray at L=0.5.

**How we compensate:** We slightly reduce lightness for saturated colors to make their perceived brightness match their target.

The effect varies by hue:
- **Strongest:** Blue (~270°)
- **Weakest:** Yellow (~90°)

It's also lightness-aware - the effect peaks at mid-lightness (L=0.5) where human perception is most sensitive.

### Bezold-Brucke (BB) Shift

**What it is:** Perceived hue shifts as lightness changes. Most hues appear to shift toward yellow at high lightness and toward blue at low lightness.

**How we correct:** We counter-rotate the hue as lightness deviates from the midpoint:
- At high lightness: shift hue away from yellow/blue attractors
- At low lightness: shift hue away from red/green attractors

The correction magnitude varies by hue region (blues shift most, reds/greens are more stable).

---

## Artistic Controls

### Hue Shift Curves

Intentional hue variation across lightness levels (different from BB correction):

- **Light stops:** Can shift toward warm or cool
- **Dark stops:** Can shift toward different hues

**Yellow handling:** Yellows get special treatment because shifting toward green (higher hue) makes them look olive/muddy. Instead, yellows shift toward orange across all lightness levels.

Presets available:
- **Vivid:** Warm lights (+12°), cooler darks (-15°)
- **Warm:** Warmer darks (-18°), neutral lights
- **Cool:** Cooler lights (+12°), neutral darks
- **Custom:** User-defined shift values

### Chroma Curves

Controls saturation distribution across the palette:

- **Flat:** Same saturation at all lightness levels
- **Bell:** Maximum saturation at mid-lightness, reduced at extremes
- **Natural:** Gentle reduction at extremes (most professional-looking)
- **Muted lights:** Reduced saturation for light stops only
- **Vibrant darks:** Boosted saturation for dark stops

---

## Duplicate Detection & Nudging

**Problem:** Different OKLCH values can produce identical hex codes (especially adjacent light stops).

**Solution:** A 3-phase nudge algorithm that prioritizes minimal contrast impact:

1. **Hue nudge first** (±1-5°) - Minimal contrast impact
2. **Chroma nudge second** (±0.002-0.008) - Small contrast impact
3. **Lightness nudge last** (±0.004 per step) - Most contrast impact

When using lightness nudges in contrast mode, we nudge **toward** the target contrast, not away from it.

---

## Color Distinctness (Delta-E)

**Delta-E** measures perceptual distance between colors. We use a simplified OKLCH-based formula:

- Lightness difference (weighted heavily)
- Chroma difference
- Hue difference (weighted by chroma - hue matters less for desaturated colors)

**Threshold:** Colors with Delta-E < 5 may appear identical to human eyes and are flagged as "too similar."

---

## Generation Pipeline

The full pipeline for generating a color stop:

1. **Start with base color** in OKLCH
2. **Calculate target lightness** (from target contrast or direct lightness value)
3. **Clamp chroma to gamut** using lookup table
4. **Apply hue shift** (if enabled)
5. **Apply chroma curve** (if not flat)
6. **Apply perceptual corrections** (HK and/or BB if enabled)
7. **Refine lightness for contrast** (in contrast mode)
8. **Apply smart minimum chroma cap** (if would exceed tolerance)
9. **Final gamut validation**
10. **Ensure unique hex codes** (3-phase nudge)

---

## References

- [OKLCH Color Space](https://oklch.com/) - Interactive explorer
- [WCAG 2.1 Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) - Accessibility guidelines
- [Helmholtz-Kohlrausch Effect](https://en.wikipedia.org/wiki/Helmholtz%E2%80%93Kohlrausch_effect) - Brightness perception
- [Bezold-Brucke Shift](https://en.wikipedia.org/wiki/Bezold%E2%80%93Br%C3%BCcke_shift) - Hue perception changes
