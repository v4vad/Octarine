/**
 * Gamut Lookup Table
 *
 * Pre-computes maximum in-gamut chroma for every (lightness, hue) pair in a
 * 101×360 grid at module load time (~100-200ms, one-time cost).
 *
 * lookupMaxChroma() then uses bilinear interpolation to answer queries in O(1)
 * instead of running a binary search on every call.
 */

import { clampChroma } from 'culori'

function buildGamutTable(): number[][] {
  const table: number[][] = []
  for (let lIndex = 0; lIndex <= 100; lIndex++) {
    const l = lIndex / 100
    const row: number[] = []
    for (let h = 0; h < 360; h++) {
      if (l <= 0 || l >= 1) {
        row.push(0)
      } else {
        const clamped = clampChroma({ mode: 'oklch', l, c: 0.4, h }, 'oklch')
        row.push(clamped?.c ?? 0)
      }
    }
    table.push(row)
  }
  return table
}

const GAMUT_TABLE = buildGamutTable()

/**
 * O(1) maximum in-gamut chroma lookup with bilinear interpolation.
 *
 * @param l - Lightness (0-1)
 * @param h - Hue (0-360 degrees)
 * @returns Maximum chroma that stays within the sRGB gamut
 */
export function lookupMaxChroma(l: number, h: number): number {
  l = Math.max(0, Math.min(1, l))
  h = ((h % 360) + 360) % 360

  const lIndex = l * 100
  const l0 = Math.floor(lIndex)
  const l1 = Math.min(100, l0 + 1)
  const h0 = Math.floor(h)
  const h1 = (h0 + 1) % 360
  const lFrac = lIndex - l0
  const hFrac = h - h0

  const c00 = GAMUT_TABLE[l0][h0]
  const c01 = GAMUT_TABLE[l0][h1]
  const c10 = GAMUT_TABLE[l1][h0]
  const c11 = GAMUT_TABLE[l1][h1]

  const c0 = c00 + (c01 - c00) * hFrac
  const c1 = c10 + (c11 - c10) * hFrac
  return c0 + (c1 - c0) * lFrac
}
