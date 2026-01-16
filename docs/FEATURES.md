# Octarine Features Guide

Octarine is a Figma plugin for creating professional color palettes. This guide explains all the features available to help you build beautiful, accessible color systems.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Color Palettes](#creating-color-palettes)
3. [Color Picker](#color-picker)
4. [Generation Methods](#generation-methods)
5. [The Defaults Table](#the-defaults-table)
6. [Customizing Individual Stops](#customizing-individual-stops)
7. [Color-Level Settings](#color-level-settings)
8. [Global Settings](#global-settings)
9. [Artistic Controls](#artistic-controls)
10. [Advanced Features](#advanced-features)
11. [Exporting to Figma](#exporting-to-figma)

---

## Getting Started

### Plugin Layout

The plugin window has two main areas:

- **Left Panel** - Contains global settings, the defaults table, and the export button
- **Right Panel** - Shows your color palettes with all the color swatches

You can resize the plugin window by dragging the bottom-right corner.

---

## Creating Color Palettes

### Adding a New Color

Click the **"+ Add Color"** button to create a new color palette. Each palette starts with:
- A default name (Color 1, Color 2, etc.)
- A default blue base color (#0066CC)
- All the standard stops (50, 100, 200, 300, 400, 500, 600, 700, 800, 900)

### Naming Your Colors

Click on the color label (like "Color 1") and type a new name. Common names include:
- Primary, Secondary, Accent
- Blue, Red, Green, etc.
- Brand, Neutral, Error, Success

This name will be used when exporting to Figma (e.g., "Primary/500").

### Deleting a Color

Click the **"delete"** button on any color row. A confirmation dialog will appear to prevent accidental deletions.

---

## Color Picker

### Three Ways to Pick Colors

The color picker offers three modes:

1. **HSB Mode** (Hue-Saturation-Brightness)
   - Traditional color picker with a 2D gradient area
   - Slide the hue bar to change the basic color
   - Click in the gradient to adjust saturation and brightness

2. **OKLCH Mode** (Perceptually-Uniform Color Space)
   - More advanced color picker that maintains visual consistency
   - Colors appear equally spaced as you adjust them
   - Recommended for professional color work

3. **HEX Mode**
   - Type a hex code directly (like #FF5500)
   - Supports shorthand notation (#F50 becomes #FF5500)

### Eyedropper Tool

The **"Pick from selection"** button lets you grab colors from your Figma canvas:
1. Select a shape in Figma that has the color you want
2. Open the color picker in Octarine
3. Click "Pick from selection"
4. The color from your selected shape will be applied

---

## Generation Methods

Octarine can generate your palette using two different approaches:

### Lightness Method

Creates stops based on how light or dark each color should be.

- Uses values from 0 to 1 (0 = black, 1 = white)
- Stop 50 is typically very light (around 0.97)
- Stop 900 is typically very dark (around 0.20)

**Best for:** When you want precise control over how light or dark each stop appears.

### Contrast Method

Creates stops based on accessibility contrast ratios (WCAG standards).

- Uses contrast values from 1.0 to 21.0
- Higher numbers = more contrast against the background
- 4.5:1 is the minimum for readable body text
- 3:1 is the minimum for large text and UI elements

**Best for:** When you need to meet accessibility requirements and ensure readable text.

### Switching Between Methods

Click the **"L"** or **"C"** column header in the Defaults Table to switch between Lightness and Contrast methods.

---

## The Defaults Table

The Defaults Table (in the left panel) shows all your stop numbers and their default values.

### Understanding the Table

| Stop | L (Lightness) | C (Contrast) |
|------|---------------|--------------|
| 50   | 0.97          | 1.05         |
| 100  | 0.94          | 1.15         |
| ...  | ...           | ...          |
| 900  | 0.20          | 12.0         |

- The **active column** (L or C) determines how colors are generated
- The **inactive column** appears grayed out

### Editing Default Values

Click on any value in the table to edit it. Changes apply to all colors immediately.

### Adding Custom Stops

Click **"Add Stop"** to create a new stop number. The plugin automatically calculates appropriate default values based on surrounding stops.

---

## Customizing Individual Stops

Click on any color swatch to open the **Stop Popup** where you can customize that specific stop.

### What You'll See

- **Hex Code** - The generated color value
- **Contrast Ratio** - How much contrast this color has against your background (e.g., "4.5:1")

### Override Options

Each stop can have its own custom settings:

1. **Lightness/Contrast Override**
   - Set a different target value for just this stop
   - Click the reset icon to go back to the default

2. **Hue Shift Override**
   - Adjust how much the hue shifts for this stop (0-100)
   - Useful for creating warm highlights or cool shadows

3. **Saturation Shift Override**
   - Adjust how saturated this stop should be (0-100)
   - Create more vivid or muted variations

4. **Manual Color Override**
   - Pick a completely custom color for this stop
   - The color won't change when you modify the base color
   - Check "Apply perceptual corrections" to use the plugin's color adjustments

### Reset to Auto

Click **"Reset to Auto"** to clear all overrides and let the plugin generate the color automatically.

---

## Color-Level Settings

Click the **"settings"** button on any color row to open color-level options that affect the entire palette.

### Base Color

The starting color that all stops are generated from. You can edit it via:
- The hex input field
- Clicking the color swatch
- Using the full color picker

### Correction Toggles

**HK Correction** (Helmholtz-Kohlrausch Effect)

Our eyes perceive saturated colors as brighter than they actually are. A vivid red and a gray with the exact same measured lightness will look different to us—the red appears brighter.

When HK Correction is enabled:
- The plugin slightly darkens saturated colors to compensate
- This makes all your colors appear to have consistent brightness
- Most noticeable with vivid reds, greens, and blues
- Subtle colors (grays, pastels) are barely affected

**When to use it:** Enable HK correction when you want your palette stops to look evenly spaced in brightness, especially if you're working with highly saturated colors.

---

**BB Correction** (Bezold-Brücke Shift)

Our perception of color hue changes depending on how bright or dark the color is. For example, a yellow becomes more orange-looking as it gets darker, and more green-looking as it gets lighter—even though the actual hue number hasn't changed.

When BB Correction is enabled:
- The plugin adjusts the hue at different lightness levels to compensate
- Dark stops get their hue shifted one direction, light stops the opposite
- This keeps your colors looking like the "same color" across all stops
- Most noticeable with yellows, cyans, and magentas

**When to use it:** Enable BB correction when you want your dark blue to still look like "blue" (not purple) and your light yellow to still look like "yellow" (not green).

---

## Global Settings

These settings affect all colors in your palette.

### Background Color

The color used for contrast calculations. By default, this is white (#FFFFFF).

- Click the swatch to change it
- All contrast ratios will be recalculated
- Important for the Contrast Method

---

## Artistic Controls

These controls let you add visual interest and harmony to your palettes.

### Hue Shift

Creates a color temperature gradient across your palette.

- **Slider (0-100)** - How much hue shift to apply
- **Direction options:**
  - **Warm→Cool** - Light stops shift warm (yellow/orange), dark stops shift cool (blue)
  - **Cool→Warm** - Light stops shift cool, dark stops shift warm

**Example:** A blue palette with Warm→Cool hue shift will have slightly purple-ish light stops and slightly green-ish dark stops.

### Saturation Shift

Creates a saturation gradient across your palette.

- **Slider (0-100)** - How much saturation shift to apply
- **Direction options:**
  - **Vivid→Muted** - Light stops are more saturated, dark stops are more muted
  - **Muted→Vivid** - Light stops are more muted, dark stops are more saturated

**Example:** Using Vivid→Muted creates bright, punchy light colors that fade to sophisticated darker tones.

---

## Advanced Features

### Automatic Duplicate Detection

When multiple stops would generate the same hex color, Octarine automatically adjusts them to be unique:

1. First tries small hue adjustments
2. Then tries saturation adjustments
3. Finally adjusts lightness if needed

Adjusted colors are marked with a **~** symbol.

### Gamut Mapping

Very light or very dark colors may not be displayable with full saturation. Octarine automatically reduces saturation when needed to keep colors within the displayable range while preserving your intended lightness.

### Contrast Refinement

After applying all adjustments (hue shift, corrections, etc.), Octarine fine-tunes the lightness to hit your exact contrast target. This ensures accessibility requirements are truly met.

---

## Exporting to Figma

### Creating Figma Variables

Click the **"export"** button in the left panel to create Figma Variables from your palette.

**What happens:**
1. A variable collection called "Octarine Colors" is created (or updated if it exists)
2. Each color stop becomes a variable
3. Variables are named using your color labels: `ColorName/StopNumber`

**Example output:**
- Primary/50
- Primary/100
- Primary/500
- Secondary/500
- etc.

### Using Your Variables

Once exported, your colors appear in Figma's Variables panel. You can:
- Apply them to fills, strokes, and effects
- Reference them in other variables
- Use them across all your Figma files in the same library

---

## Quick Reference

### Keyboard Shortcuts

- **Cmd+Z** (Mac) / **Ctrl+Z** (Windows) - Undo
- **Cmd+Shift+Z** (Mac) / **Ctrl+Shift+Z** (Windows) - Redo
- **Enter** - Confirm text input changes
- **Click outside** - Close popups

### Visual Indicators

| Symbol | Meaning |
|--------|---------|
| Grayed column | Inactive generation method |
| Reset icon | Click to remove an override |

### Recommended Workflow

1. **Start** - Add a color and set your base color
2. **Choose method** - Lightness for visual control, Contrast for accessibility
3. **Adjust defaults** - Set up your stop values in the Defaults Table
4. **Fine-tune** - Use artistic controls for visual harmony
5. **Customize** - Override individual stops as needed
6. **Export** - Create Figma Variables when ready

---

## Tips for Great Color Palettes

1. **Start with a good base color** - The quality of your base determines the quality of your palette

2. **Use Contrast Method for text colors** - Ensures your text will be readable

3. **Try small hue shifts first** - A little goes a long way (10-20 is usually enough)

4. **Enable corrections for saturated colors** - HK and BB corrections help bright colors look more natural

5. **Check the contrast ratios** - Make sure important colors meet WCAG guidelines:
   - 4.5:1 for normal text
   - 3:1 for large text and UI elements

6. **Name your colors meaningfully** - "Primary" and "Error" are clearer than "Color 1" and "Color 2"

---

## Troubleshooting

### Colors look identical
- The plugin automatically adjusts duplicates to make them unique
- This uses smart nudging: first tries hue shifts, then chroma, then lightness

### Colors look too bright/dim
- Enable HK Correction in the color's settings (click the settings button on the color row)
- Adjust the base color's lightness

### Contrast ratios are wrong
- Make sure your Background Color is set correctly
- Check that you're using the Contrast Method (not Lightness)

### Eyedropper doesn't work
- Make sure you have a shape selected in Figma
- The shape must have a solid fill (not gradient or image)

---

*Octarine uses the OKLCH color space for perceptually-uniform color generation, ensuring your palettes look great and meet accessibility standards.*
