import React, { useState, useEffect, useRef } from 'react';
import { ColorPickerPopup } from '../color-picker';

interface BaseColorFieldProps {
  color: string;
  onChange: (hex: string) => void;
}

// Expand shorthand hex codes (e.g., "#F" -> "#FFFFFF", "#ABC" -> "#AABBCC")
function expandHexShorthand(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length === 1) return '#' + h.repeat(6);
  if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
  return hex;
}

export function BaseColorField({ color, onChange }: BaseColorFieldProps) {
  const swatchRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerOpenUpward, setPickerOpenUpward] = useState(false);
  const [hexInput, setHexInput] = useState(color);

  // Keep input in sync when color changes externally
  useEffect(() => {
    setHexInput(color);
  }, [color]);

  const applyHex = (newHex: string) => {
    const expanded = expandHexShorthand(newHex);
    if (/^#[0-9A-Fa-f]{6}$/.test(expanded)) {
      setHexInput(expanded.toUpperCase());
      onChange(expanded.toUpperCase());
    } else {
      setHexInput(color);
    }
  };

  const handleSwatchClick = () => {
    if (!swatchRef.current) {
      setShowPicker(!showPicker);
      return;
    }

    // Calculate if there's enough space below for the picker (~380px)
    const rect = swatchRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const pickerHeight = 380;

    setPickerOpenUpward(spaceBelow < pickerHeight);
    setShowPicker(!showPicker);
  };

  return (
    <div className="stop-popup-section" style={{ position: 'relative' }}>
      <div className="color-field-row">
        <span className="color-field-label">Base color</span>
        <div className="color-field-controls">
          <div
            ref={swatchRef}
            className="color-field-swatch"
            style={{ backgroundColor: color }}
            onClick={handleSwatchClick}
          />
          <input
            type="text"
            className="color-field-hex"
            value={hexInput.toUpperCase()}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={(e) => applyHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyHex((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>
      </div>
      {showPicker && (
        <div
          className={pickerOpenUpward ? 'picker-upward' : 'mt-2'}
          style={pickerOpenUpward ? {
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '8px',
            zIndex: 10
          } : undefined}
        >
          <ColorPickerPopup
            color={color}
            onChange={onChange}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  );
}
