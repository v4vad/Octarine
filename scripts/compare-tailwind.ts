/**
 * Compare Generated Colors Against Tailwind's Design System
 *
 * Tailwind colors are designed by professionals to look visually pleasing.
 * This test checks if our algorithm produces colors similar to Tailwind's
 * when given similar base colors.
 */

import { generateColorPalette } from "../lib/color-utils"
import type { Color, EffectiveSettings } from "../lib/types"
import { DEFAULT_STOPS, DEFAULT_LIGHTNESS, DEFAULT_CONTRAST } from "../lib/types"

// Tailwind CSS v3 color palette (official values)
const TAILWIND: Record<string, Record<number, string>> = {
  red: {
    50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
    400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
    800: '#991b1b', 900: '#7f1d1d'
  },
  orange: {
    50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
    400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
    800: '#9a3412', 900: '#7c2d12'
  },
  yellow: {
    50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047',
    400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207',
    800: '#854d0e', 900: '#713f12'
  },
  green: {
    50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
    400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
    800: '#166534', 900: '#14532d'
  },
  blue: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
    400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
    800: '#1e40af', 900: '#1e3a8a'
  },
  purple: {
    50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
    400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
    800: '#6b21a8', 900: '#581c87'
  },
  pink: {
    50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4',
    400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d',
    800: '#9d174d', 900: '#831843'
  }
}

// Use Tailwind's 500 level as base color
const TEST_CASES = [
  { name: 'red', base: TAILWIND.red[500] },
  { name: 'orange', base: TAILWIND.orange[500] },
  { name: 'yellow', base: TAILWIND.yellow[500] },
  { name: 'green', base: TAILWIND.green[500] },
  { name: 'blue', base: TAILWIND.blue[500] },
  { name: 'purple', base: TAILWIND.purple[500] },
  { name: 'pink', base: TAILWIND.pink[500] },
]

function createStops() {
  return DEFAULT_STOPS.map(num => ({ number: num }))
}

function createSettings(): EffectiveSettings {
  return {
    method: "lightness",
    defaultLightness: { ...DEFAULT_LIGHTNESS },
    defaultContrast: { ...DEFAULT_CONTRAST },
    backgroundColor: "#ffffff"
  }
}

// Calculate color difference (RGB Euclidean distance)
function colorDistance(hex1: string, hex2: string): number {
  const h1 = hex1.replace('#', '')
  const h2 = hex2.replace('#', '')
  const r1 = parseInt(h1.slice(0, 2), 16)
  const g1 = parseInt(h1.slice(2, 4), 16)
  const b1 = parseInt(h1.slice(4, 6), 16)
  const r2 = parseInt(h2.slice(0, 2), 16)
  const g2 = parseInt(h2.slice(2, 4), 16)
  const b2 = parseInt(h2.slice(4, 6), 16)
  return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)
}

console.log("======================================================================")
console.log("TAILWIND COLOR COMPARISON")
console.log("======================================================================")
console.log("")
console.log("Comparing generated colors against Tailwind's professionally designed palette")
console.log("Lower distance = closer match (0=identical, <30=very close, <60=similar)")
console.log("")

let excellent = 0, good = 0, fair = 0, different = 0

for (const tc of TEST_CASES) {
  const color: Color = {
    id: tc.name,
    label: tc.name,
    baseColor: tc.base,
    stops: createStops()
  }

  const palette = generateColorPalette(color, createSettings())
  const tailwindPalette = TAILWIND[tc.name]

  let totalDistance = 0
  const stopResults: string[] = []

  console.log("")
  console.log(tc.name.toUpperCase() + " (base: " + tc.base + ")")
  console.log("------------------------------------------------------------")
  console.log(" Stop | Generated | Tailwind  | Distance | Match")
  console.log("------------------------------------------------------------")

  for (const stop of palette.stops) {
    const twColor = tailwindPalette[stop.stopNumber]
    const dist = Math.round(colorDistance(stop.hex, twColor))
    totalDistance += dist

    let match = ""
    if (dist < 20) { match = "✓ Excellent"; excellent++ }
    else if (dist < 40) { match = "○ Good"; good++ }
    else if (dist < 70) { match = "△ Fair"; fair++ }
    else { match = "✗ Different"; different++ }

    const stopStr = stop.stopNumber.toString().padStart(4)
    const genStr = stop.hex.padStart(9)
    const twStr = twColor.padStart(9)
    const distStr = dist.toString().padStart(8)

    console.log(` ${stopStr} | ${genStr} | ${twStr} | ${distStr} | ${match}`)
  }

  const avg = Math.round(totalDistance / palette.stops.length)
  console.log("------------------------------------------------------------")
  console.log("Average distance: " + avg)
}

// Summary
const total = excellent + good + fair + different
console.log("")
console.log("======================================================================")
console.log("SUMMARY")
console.log("======================================================================")
console.log("")
console.log("Excellent (<20):     " + excellent + " (" + (100*excellent/total).toFixed(1) + "%)")
console.log("Good (20-40):        " + good + " (" + (100*good/total).toFixed(1) + "%)")
console.log("Fair (40-70):        " + fair + " (" + (100*fair/total).toFixed(1) + "%)")
console.log("Different (>70):     " + different + " (" + (100*different/total).toFixed(1) + "%)")
console.log("")
console.log("Note: Some difference is expected since Tailwind uses hand-tuned values")
console.log("while our algorithm generates mathematically consistent palettes.")
