import React, { useState, useEffect } from 'react';

interface SwatchHexInputProps {
  color: string;
  onChange: (hex: string) => void;
  onSwatchClick?: () => void;
}

// Expand shorthand hex codes (e.g., "#F" -> "#FFFFFF", "#ABC" -> "#AABBCC")
function expandHexShorthand(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length === 1) return '#' + h.repeat(6);
  if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
  return hex;
}

export function SwatchHexInput({ color, onChange, onSwatchClick }: SwatchHexInputProps) {
  const [hexInput, setHexInput] = useState(color);
  const [isFocused, setIsFocused] = useState(false);

  // Keep input in sync when color changes externally, but only if not focused
  useEffect(() => {
    if (!isFocused) {
      setHexInput(color);
    }
  }, [color, isFocused]);

  const applyHex = (newHex: string) => {
    const expanded = expandHexShorthand(newHex);
    if (/^#[0-9A-Fa-f]{6}$/.test(expanded)) {
      const normalizedHex = expanded.toUpperCase();
      setHexInput(normalizedHex);
      onChange(normalizedHex);
    } else {
      // Revert to current valid color if invalid
      setHexInput(color);
    }
  };

  return (
    <div className="swatch-hex-input">
      <div
        className="swatch-hex-input-swatch"
        style={{ backgroundColor: color }}
        onClick={onSwatchClick}
      />
      <input
        type="text"
        className="swatch-hex-input-field"
        value={hexInput.toUpperCase()}
        onChange={(e) => setHexInput(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          setIsFocused(false);
          applyHex(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            applyHex((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}
