import { useState, useCallback } from 'react';
import { hexToOklch, oklchToHex, hexToRgb, rgbToHex, rgbToHsb, hsbToRgb, OKLCH } from '../lib/color-utils';

export interface HSB {
  h: number;
  s: number;
  b: number;
}

export interface ColorPickerState {
  hex: string;
  hexInput: string;
  oklch: OKLCH;
  hsb: HSB;
  // OKLCH input fields
  lInput: string;
  cInput: string;
  hInput: string;
  // HSB input fields
  hsbHInput: string;
  hsbSInput: string;
  hsbBInput: string;
}

export interface ColorPickerHandlers {
  applyHex: (newHex: string) => void;
  applyOklch: (newOklch: OKLCH) => void;
  applyHsb: (newHsb: HSB) => void;
  setHexInput: (value: string) => void;
  setLInput: (value: string) => void;
  setCInput: (value: string) => void;
  setHInput: (value: string) => void;
  setHsbHInput: (value: string) => void;
  setHsbSInput: (value: string) => void;
  setHsbBInput: (value: string) => void;
  handleLBlur: () => void;
  handleCBlur: () => void;
  handleHBlur: () => void;
  handleHsbHBlur: () => void;
  handleHsbSBlur: () => void;
  handleHsbBBlur: () => void;
  syncFromExternal: (colorHex: string) => void;
}

function expandHexShorthand(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length === 1) return '#' + h.repeat(6);
  if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
  return hex;
}

export function useColorPicker(
  initialColor: string,
  onChange: (hex: string) => void
): { state: ColorPickerState; handlers: ColorPickerHandlers } {
  // Core color state
  const [hex, setHex] = useState(initialColor);
  const [oklch, setOklch] = useState<OKLCH>(() => hexToOklch(initialColor));
  const [hsb, setHsb] = useState<HSB>(() => {
    const rgb = hexToRgb(initialColor);
    return rgbToHsb(rgb.r, rgb.g, rgb.b);
  });

  // Input field state (for controlled inputs)
  const [hexInput, setHexInput] = useState(initialColor);
  const [lInput, setLInput] = useState(() => hexToOklch(initialColor).l.toFixed(2));
  const [cInput, setCInput] = useState(() => hexToOklch(initialColor).c.toFixed(3));
  const [hInput, setHInput] = useState(() => hexToOklch(initialColor).h.toFixed(0));
  const [hsbHInput, setHsbHInput] = useState(() => {
    const rgb = hexToRgb(initialColor);
    return rgbToHsb(rgb.r, rgb.g, rgb.b).h.toFixed(0);
  });
  const [hsbSInput, setHsbSInput] = useState(() => {
    const rgb = hexToRgb(initialColor);
    return rgbToHsb(rgb.r, rgb.g, rgb.b).s.toFixed(0);
  });
  const [hsbBInput, setHsbBInput] = useState(() => {
    const rgb = hexToRgb(initialColor);
    return rgbToHsb(rgb.r, rgb.g, rgb.b).b.toFixed(0);
  });

  // Sync all state from a hex color (used when applying changes)
  const syncAllFromHex = useCallback((newHex: string) => {
    setHex(newHex);
    setHexInput(newHex);
    const newOklch = hexToOklch(newHex);
    setOklch(newOklch);
    setLInput(newOklch.l.toFixed(2));
    setCInput(newOklch.c.toFixed(3));
    setHInput(newOklch.h.toFixed(0));
    const rgb = hexToRgb(newHex);
    const newHsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
    setHsb(newHsb);
    setHsbHInput(newHsb.h.toFixed(0));
    setHsbSInput(newHsb.s.toFixed(0));
    setHsbBInput(newHsb.b.toFixed(0));
  }, []);

  // Apply hex color (validates and expands shorthand)
  const applyHex = useCallback((newHex: string) => {
    const expanded = expandHexShorthand(newHex);
    if (/^#[0-9A-Fa-f]{6}$/.test(expanded)) {
      syncAllFromHex(expanded);
      onChange(expanded);
    }
  }, [syncAllFromHex, onChange]);

  // Apply OKLCH color
  const applyOklch = useCallback((newOklch: OKLCH) => {
    setOklch(newOklch);
    setLInput(newOklch.l.toFixed(2));
    setCInput(newOklch.c.toFixed(3));
    setHInput(newOklch.h.toFixed(0));
    const newHex = oklchToHex(newOklch);
    setHex(newHex);
    setHexInput(newHex);
    const rgb = hexToRgb(newHex);
    const newHsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
    setHsb(newHsb);
    setHsbHInput(newHsb.h.toFixed(0));
    setHsbSInput(newHsb.s.toFixed(0));
    setHsbBInput(newHsb.b.toFixed(0));
    onChange(newHex);
  }, [onChange]);

  // Apply HSB color
  const applyHsb = useCallback((newHsb: HSB) => {
    setHsb(newHsb);
    setHsbHInput(newHsb.h.toFixed(0));
    setHsbSInput(newHsb.s.toFixed(0));
    setHsbBInput(newHsb.b.toFixed(0));
    const rgb = hsbToRgb(newHsb.h, newHsb.s, newHsb.b);
    const newHex = rgbToHex(Math.round(rgb.r), Math.round(rgb.g), Math.round(rgb.b));
    setHex(newHex);
    setHexInput(newHex);
    const newOklch = hexToOklch(newHex);
    setOklch(newOklch);
    setLInput(newOklch.l.toFixed(2));
    setCInput(newOklch.c.toFixed(3));
    setHInput(newOklch.h.toFixed(0));
    onChange(newHex);
  }, [onChange]);

  // Blur handlers for input validation
  const handleLBlur = useCallback(() => {
    const val = parseFloat(lInput);
    if (!isNaN(val)) {
      applyOklch({ ...oklch, l: Math.max(0, Math.min(1, val)) });
    } else {
      setLInput(oklch.l.toFixed(2));
    }
  }, [lInput, oklch, applyOklch]);

  const handleCBlur = useCallback(() => {
    const val = parseFloat(cInput);
    if (!isNaN(val)) {
      applyOklch({ ...oklch, c: Math.max(0, val) });
    } else {
      setCInput(oklch.c.toFixed(3));
    }
  }, [cInput, oklch, applyOklch]);

  const handleHBlur = useCallback(() => {
    const val = parseFloat(hInput);
    if (!isNaN(val)) {
      applyOklch({ ...oklch, h: val });
    } else {
      setHInput(oklch.h.toFixed(0));
    }
  }, [hInput, oklch, applyOklch]);

  const handleHsbHBlur = useCallback(() => {
    const val = parseFloat(hsbHInput);
    if (!isNaN(val)) {
      applyHsb({ ...hsb, h: Math.max(0, Math.min(360, val)) });
    } else {
      setHsbHInput(hsb.h.toFixed(0));
    }
  }, [hsbHInput, hsb, applyHsb]);

  const handleHsbSBlur = useCallback(() => {
    const val = parseFloat(hsbSInput);
    if (!isNaN(val)) {
      applyHsb({ ...hsb, s: Math.max(0, Math.min(100, val)) });
    } else {
      setHsbSInput(hsb.s.toFixed(0));
    }
  }, [hsbSInput, hsb, applyHsb]);

  const handleHsbBBlur = useCallback(() => {
    const val = parseFloat(hsbBInput);
    if (!isNaN(val)) {
      applyHsb({ ...hsb, b: Math.max(0, Math.min(100, val)) });
    } else {
      setHsbBInput(hsb.b.toFixed(0));
    }
  }, [hsbBInput, hsb, applyHsb]);

  // Sync from external source (e.g., "Pick from selection")
  const syncFromExternal = useCallback((colorHex: string) => {
    syncAllFromHex(colorHex);
    onChange(colorHex);
  }, [syncAllFromHex, onChange]);

  return {
    state: {
      hex,
      hexInput,
      oklch,
      hsb,
      lInput,
      cInput,
      hInput,
      hsbHInput,
      hsbSInput,
      hsbBInput,
    },
    handlers: {
      applyHex,
      applyOklch,
      applyHsb,
      setHexInput,
      setLInput,
      setCInput,
      setHInput,
      setHsbHInput,
      setHsbSInput,
      setHsbBInput,
      handleLBlur,
      handleCBlur,
      handleHBlur,
      handleHsbHBlur,
      handleHsbSBlur,
      handleHsbBBlur,
      syncFromExternal,
    },
  };
}
