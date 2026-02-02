/**
 * Export Utilities
 *
 * Functions for exporting color palettes to various formats:
 * - CSS Custom Properties (with hex/rgb/oklch/hsl support)
 * - JSON (W3C Design Token format)
 * - OKLCH Raw (CSV format)
 *
 * Also provides clipboard and download functionality.
 */

import type { ColorGroup, GlobalConfig, ExportableStop, CSSColorFormat } from "./types"
import { generateColorPalette } from "./color-utils"
import { hexToOklch, hexToRgb } from "./color-conversions"

// ============================================
// DATA PREPARATION
// ============================================

/**
 * Prepare export data from groups
 * Generates all color palettes and structures them for export
 */
export function prepareExportData(
  groups: ColorGroup[],
  globalConfig: GlobalConfig
): ExportableStop[] {
  const exportableStops: ExportableStop[] = []

  for (const group of groups) {
    // Merge group settings with global background color
    const effectiveSettings = {
      ...group.settings,
      backgroundColor: globalConfig.backgroundColor
    }

    for (const color of group.colors) {
      // Generate the full palette for this color
      const paletteResult = generateColorPalette(color, effectiveSettings)

      // Convert each generated stop to exportable format
      for (const generatedStop of paletteResult.stops) {
        const oklch = hexToOklch(generatedStop.hex)
        exportableStops.push({
          colorLabel: color.label,
          stopNumber: generatedStop.stopNumber,
          hex: generatedStop.hex,
          oklch: {
            l: oklch.l,
            c: oklch.c,
            h: oklch.h
          }
        })
      }
    }
  }

  return exportableStops
}

// ============================================
// COLOR FORMATTING
// ============================================

/**
 * Format a color value in the specified CSS format
 */
export function formatCSSValue(stop: ExportableStop, format: CSSColorFormat): string {
  switch (format) {
    case "hex":
      return stop.hex.toUpperCase()

    case "rgb": {
      const rgb = hexToRgb(stop.hex)
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
    }

    case "oklch": {
      const { l, c, h } = stop.oklch
      return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`
    }

    case "hsl": {
      // Convert hex to HSL
      const rgb = hexToRgb(stop.hex)
      const r = rgb.r / 255
      const g = rgb.g / 255
      const b = rgb.b / 255

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const l = (max + min) / 2
      const d = max - min

      let h = 0
      let s = 0

      if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6
            break
          case g:
            h = ((b - r) / d + 2) / 6
            break
          case b:
            h = ((r - g) / d + 4) / 6
            break
        }
      }

      return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
    }

    default:
      return stop.hex.toUpperCase()
  }
}

/**
 * Convert color label to a valid CSS variable name
 * e.g., "Primary Blue" -> "primary-blue"
 */
function toCSSVariableName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// ============================================
// EXPORT GENERATORS
// ============================================

/**
 * Generate CSS Custom Properties
 * Format: --{color}-{stop}: {value};
 */
export function generateCSS(stops: ExportableStop[], colorFormat: CSSColorFormat): string {
  const lines: string[] = [":root {"]

  for (const stop of stops) {
    const varName = `--${toCSSVariableName(stop.colorLabel)}-${stop.stopNumber}`
    const value = formatCSSValue(stop, colorFormat)
    lines.push(`  ${varName}: ${value};`)
  }

  lines.push("}")
  return lines.join("\n")
}

/**
 * Generate W3C Design Tokens JSON
 * Format follows the W3C Design Tokens specification
 */
export function generateJSON(stops: ExportableStop[]): string {
  // Group stops by color label
  const grouped: Record<string, ExportableStop[]> = {}

  for (const stop of stops) {
    if (!grouped[stop.colorLabel]) {
      grouped[stop.colorLabel] = []
    }
    grouped[stop.colorLabel].push(stop)
  }

  // Build the token structure
  const tokens: Record<string, Record<string, object>> = {}

  for (const [label, colorStops] of Object.entries(grouped)) {
    tokens[label] = {}
    for (const stop of colorStops) {
      tokens[label][String(stop.stopNumber)] = {
        $type: "color",
        $value: {
          colorSpace: "oklch",
          components: {
            l: Number(stop.oklch.l.toFixed(4)),
            c: Number(stop.oklch.c.toFixed(4)),
            h: Number(stop.oklch.h.toFixed(1))
          },
          hex: stop.hex.toUpperCase()
        }
      }
    }
  }

  return JSON.stringify(tokens, null, 2)
}

/**
 * Generate OKLCH Raw values as CSV
 * Format: Color,Stop,L,C,H
 */
export function generateOKLCH(stops: ExportableStop[]): string {
  const lines: string[] = ["Color,Stop,L,C,H"]

  for (const stop of stops) {
    const { l, c, h } = stop.oklch
    lines.push(`${stop.colorLabel},${stop.stopNumber},${l.toFixed(4)},${c.toFixed(4)},${h.toFixed(1)}`)
  }

  return lines.join("\n")
}

// ============================================
// OUTPUT FUNCTIONS
// ============================================

/**
 * Copy text to clipboard
 * Returns true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error("Failed to copy to clipboard:", err)
    return false
  }
}

/**
 * Download text as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Get the appropriate file extension for an export format
 */
export function getFileExtension(format: "css" | "json" | "oklch-raw"): string {
  switch (format) {
    case "css":
      return "css"
    case "json":
      return "json"
    case "oklch-raw":
      return "csv"
    default:
      return "txt"
  }
}

/**
 * Get the appropriate MIME type for an export format
 */
export function getMimeType(format: "css" | "json" | "oklch-raw"): string {
  switch (format) {
    case "css":
      return "text/css"
    case "json":
      return "application/json"
    case "oklch-raw":
      return "text/csv"
    default:
      return "text/plain"
  }
}
