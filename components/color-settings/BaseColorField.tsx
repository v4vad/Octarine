import React, { useState, useRef } from 'react';
import { ColorPickerPopup } from '../color-picker';
import { SwatchHexInput } from '../primitives';

interface BaseColorFieldProps {
  color: string;
  onChange: (hex: string) => void;
}

export function BaseColorField({ color, onChange }: BaseColorFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerOpenUpward, setPickerOpenUpward] = useState(false);

  const handleSwatchClick = () => {
    if (!containerRef.current) {
      setShowPicker(!showPicker);
      return;
    }

    // Calculate if there's enough space below for the picker (~380px)
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const pickerHeight = 380;

    setPickerOpenUpward(spaceBelow < pickerHeight);
    setShowPicker(!showPicker);
  };

  return (
    <div ref={containerRef} className="stop-popup-section" style={{ position: 'relative' }}>
      <div className="color-field-row">
        <span className="color-field-label">Base color</span>
        <SwatchHexInput
          color={color}
          onChange={onChange}
          onSwatchClick={handleSwatchClick}
        />
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
