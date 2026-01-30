import React, { useRef, useState, useEffect } from 'react';
import { Stop } from '../../lib/types';
import { hexToOklch, oklchToHex, getContrastRatio } from '../../lib/color-utils';
import { RefBasedNumericInput } from '../primitives';
import { ColorPickerPopup } from '../color-picker';

interface StopPopupProps {
  stop: Stop;
  stopNumber: number;
  generatedColor: string;
  wasNudged: boolean;
  effectiveMethod: 'lightness' | 'contrast';
  defaultLightness: number;
  defaultContrast: number;
  backgroundColor: string;
  position: { x: number; y: number };
  onUpdate: (updates: Partial<Stop>) => void;
  onClose: () => void;
}

export function StopPopup({
  stop,
  stopNumber,
  generatedColor,
  wasNudged,
  effectiveMethod,
  defaultLightness,
  defaultContrast,
  backgroundColor,
  position,
  onUpdate,
  onClose
}: StopPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const displayColor = stop.manualOverride ? oklchToHex(stop.manualOverride) : generatedColor;
  const isOverridden = !!stop.manualOverride;

  // Calculate contrast ratio
  const contrastRatio = getContrastRatio(displayColor, backgroundColor);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleManualOverride = (hex: string) => {
    const oklch = hexToOklch(hex);
    onUpdate({ manualOverride: oklch });
  };

  const handleResetToAuto = () => {
    onUpdate({
      manualOverride: undefined,
      lightnessOverride: undefined,
      contrastOverride: undefined,
    });
  };

  return (
    <>
      <div className="popup-backdrop" onClick={onClose} />
      <div
        ref={popupRef}
        className="stop-popup"
        style={{
          left: Math.min(position.x, window.innerWidth - 280),
          top: Math.min(position.y, window.innerHeight - 400),
        }}
      >
        {/* Header */}
        <div className="stop-popup-header">
          <span className="stop-popup-title">Stop {stopNumber}</span>
          <span className="stop-popup-close" onClick={onClose}>×</span>
        </div>

        {/* Color Preview */}
        <div className="stop-popup-preview">
          <div
            className="stop-popup-swatch"
            style={{ backgroundColor: displayColor }}
            onClick={() => setShowColorPicker(!showColorPicker)}
          />
          <div className="stop-popup-info">
            <div className="stop-popup-hex">
              {displayColor.toUpperCase()}
              {isOverridden && <span className="override-indicator"> (Override)</span>}
            </div>
            <div className="stop-popup-contrast">
              {contrastRatio.toFixed(2)}:1 contrast
            </div>
          </div>
        </div>

        {/* Manual Color Picker */}
        {showColorPicker && (
          <div className="mb-3">
            <ColorPickerPopup
              color={displayColor}
              onChange={handleManualOverride}
              onClose={() => setShowColorPicker(false)}
              onReset={isOverridden ? () => onUpdate({ manualOverride: undefined }) : undefined}
            />
          </div>
        )}

        {/* Lightness/Contrast Override */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">
            {effectiveMethod === 'lightness' ? 'Lightness' : 'Contrast'}
            {(effectiveMethod === 'lightness' ? stop.lightnessOverride : stop.contrastOverride) === undefined
              ? ' (Default)' : ' (Override)'}
          </div>
          <div className="stop-override-controls">
            <RefBasedNumericInput
              value={effectiveMethod === 'lightness'
                ? (stop.lightnessOverride ?? defaultLightness)
                : (stop.contrastOverride ?? defaultContrast)}
              onChange={(val) => onUpdate(effectiveMethod === 'lightness'
                ? { lightnessOverride: val }
                : { contrastOverride: val }
              )}
              min={effectiveMethod === 'lightness' ? 0 : 1}
              max={effectiveMethod === 'lightness' ? 1 : 21}
              decimals={effectiveMethod === 'lightness' ? 2 : 1}
              className="stop-popup-input"
              style={{ width: '60px' }}
            />
            {(effectiveMethod === 'lightness' ? stop.lightnessOverride : stop.contrastOverride) !== undefined && (
              <button
                className="reset-icon-btn"
                onClick={() => onUpdate(effectiveMethod === 'lightness'
                  ? { lightnessOverride: undefined }
                  : { contrastOverride: undefined }
                )}
                title="Reset to default"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Reset Button */}
        <button onClick={handleResetToAuto} className="stop-popup-reset w-full mt-2">
          Reset to Auto
        </button>
      </div>
    </>
  );
}
