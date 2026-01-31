// Type declarations for the culori color library
// Uses discriminated unions for strict typing when constructing colors,
// but allows flexible access when reading results from culori functions.

declare module 'culori' {
  // Strict types for constructing colors (use these when creating color objects)
  export type OklchColor = {
    mode: 'oklch';
    l: number;  // Lightness (0-1)
    c: number;  // Chroma (0-0.4)
    h: number;  // Hue (0-360)
    alpha?: number;
  };

  export type RgbColor = {
    mode: 'rgb';
    r: number;  // Red (0-1)
    g: number;  // Green (0-1)
    b: number;  // Blue (0-1)
    alpha?: number;
  };

  export type HslColor = {
    mode: 'hsl';
    h: number;  // Hue (0-360)
    s: number;  // Saturation (0-1)
    l: number;  // Lightness (0-1)
    alpha?: number;
  };

  // Flexible Color type for function returns
  // This allows accessing any property since culori may return various modes
  export type Color = {
    mode: 'oklch' | 'rgb' | 'hsl' | string;
    // OKLCH properties
    l?: number;
    c?: number;
    h?: number;
    // RGB properties
    r?: number;
    g?: number;
    b?: number;
    // HSL uses h, s, l (overlaps with OKLCH l)
    s?: number;
    alpha?: number;
  };

  // Core conversion functions
  // These can accept a string (like "#ff0000") or a Color object
  export function oklch(color: string | Color): OklchColor | undefined;
  export function rgb(color: string | Color): RgbColor | undefined;
  export function formatHex(color: Color): string;
  export function parse(color: string): Color | undefined;

  // Gamut functions
  // clampChroma preserves the mode, so it returns the same type structure
  export function clampChroma(color: OklchColor, mode?: 'oklch'): OklchColor | undefined;
  export function clampChroma(color: Color, mode?: string): Color | undefined;
  export function displayable(color: string | Color): boolean;

  // WCAG contrast functions
  export function wcagLuminance(color: string | Color): number;
  export function wcagContrast(colorA: string | Color, colorB: string | Color): number;

  // Allow any other exports from culori
  export const converter: any;
  export const formatCss: any;
}
