/**
 * Color Conversions Module
 *
 * Pure conversion functions between color formats:
 * - Hex ↔ OKLCH
 * - Hex ↔ RGB
 * - RGB ↔ HSB
 * - OKLCH ↔ RGB
 *
 * These functions only depend on the culori library and have no internal dependencies.
 */

import { oklch, rgb, formatHex } from "culori"

export interface OKLCH {
  l: number
  c: number
  h: number
}

// Convert hex to OKLCH using culori (accurate)
export function hexToOklch(hex: string): OKLCH {
  const color = oklch(hex)
  if (!color) {
    return { l: 0.5, c: 0.1, h: 0 }
  }
  return {
    l: color.l ?? 0,
    c: color.c ?? 0,
    h: color.h ?? 0,
  }
}

// Convert OKLCH to hex using culori (accurate)
export function oklchToHex(color: OKLCH): string {
  const result = formatHex({
    mode: "oklch",
    l: color.l,
    c: color.c,
    h: color.h,
  })
  return result || "#000000"
}

// Convert OKLCH to CSS oklch() string
export function oklchToCss(color: OKLCH): string {
  return `oklch(${(color.l * 100).toFixed(1)}% ${color.c.toFixed(3)} ${color.h.toFixed(1)})`
}

export function parseOklch(color: string): OKLCH {
  if (color.startsWith("#")) {
    return hexToOklch(color)
  }
  // Try parsing as any color format
  const parsed = oklch(color)
  if (parsed) {
    return {
      l: parsed.l ?? 0,
      c: parsed.c ?? 0,
      h: parsed.h ?? 0,
    }
  }
  return { l: 0.5, c: 0.1, h: 0 }
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const color = rgb(hex)
  return {
    r: Math.round((color?.r ?? 0) * 255),
    g: Math.round((color?.g ?? 0) * 255),
    b: Math.round((color?.b ?? 0) * 255),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const result = formatHex({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 })
  return result || "#000000"
}

export function rgbToHsb(r: number, g: number, b: number): { h: number; s: number; b: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6
    } else {
      h = ((r - g) / delta + 4) / 6
    }
  }

  const s = max === 0 ? 0 : delta / max
  const brightness = max

  return { h: h * 360, s: s * 100, b: brightness * 100 }
}

export function hsbToRgb(h: number, s: number, b: number): { r: number; g: number; b: number } {
  h /= 360
  s /= 100
  b /= 100

  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = b * (1 - s)
  const q = b * (1 - f * s)
  const t = b * (1 - (1 - f) * s)

  let r = 0,
    g = 0,
    bl = 0

  switch (i % 6) {
    case 0:
      ;(r = b), (g = t), (bl = p)
      break
    case 1:
      ;(r = q), (g = b), (bl = p)
      break
    case 2:
      ;(r = p), (g = b), (bl = t)
      break
    case 3:
      ;(r = p), (g = q), (bl = b)
      break
    case 4:
      ;(r = t), (g = p), (bl = b)
      break
    case 5:
      ;(r = b), (g = p), (bl = q)
      break
  }

  return { r: r * 255, g: g * 255, b: bl * 255 }
}

export function rgbToOklch(r: number, g: number, b: number): OKLCH {
  return hexToOklch(rgbToHex(r, g, b))
}

export function oklchToRgb(l: number, c: number, h: number): { r: number; g: number; b: number } {
  const hex = oklchToHex({ l, c, h })
  return hexToRgb(hex)
}
