// Type declarations for the culori color library
// This tells TypeScript to trust the library without strict type checking

declare module 'culori' {
  // Color type can be various formats
  export type Color = {
    mode: string;
    l?: number;
    c?: number;
    h?: number;
    r?: number;
    g?: number;
    b?: number;
    alpha?: number;
  };

  // Core conversion functions
  export function oklch(color: string | Color): Color | undefined;
  export function rgb(color: string | Color): Color | undefined;
  export function formatHex(color: Color): string;
  export function parse(color: string): Color | undefined;
  export function clampChroma(color: Color, mode?: string): Color;

  // Allow any other exports from culori
  export const converter: any;
  export const formatCss: any;
}
