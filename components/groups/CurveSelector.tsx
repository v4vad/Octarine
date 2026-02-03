import React, { useState, useRef } from 'react';
import type { StopValueCurve, StopValueCurvePreset } from '../../lib/types';
import { CurvePopover } from './CurvePopover';

interface CurveSelectorProps {
  curve: StopValueCurve;
  type: 'lightness' | 'contrast';
  stops: number[];
  onCurveChange: (curve: StopValueCurve) => void;
}

const PRESET_LABELS: Record<StopValueCurvePreset, string> = {
  'linear': 'Linear',
  'lifted-darks': 'Lifted Darks',
  'compressed-range': 'Compressed',
  'expanded-ends': 'Expanded',
  'custom': 'Custom'
};

/**
 * Compact row with curve icon + preset name + dropdown arrow
 * Click opens CurvePopover
 */
export function CurveSelector({
  curve,
  type,
  stops,
  onCurveChange
}: CurveSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLButtonElement>(null);

  const handlePresetChange = (preset: StopValueCurvePreset) => {
    // When changing preset, clear overrides and custom values
    onCurveChange({ preset });
    setIsOpen(false);
  };

  return (
    <div className="curve-selector-wrapper">
      <button
        ref={selectorRef}
        className={`curve-selector ${isOpen ? 'open' : ''} ${curve.preset === 'custom' ? 'custom' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="curve-selector-icon">📈</span>
        <span className="curve-selector-label">{PRESET_LABELS[curve.preset]}</span>
        <span className="curve-selector-arrow">▾</span>
      </button>

      {isOpen && (
        <CurvePopover
          curve={curve}
          type={type}
          stops={stops}
          onPresetChange={handlePresetChange}
          onClose={() => setIsOpen(false)}
          anchorRef={selectorRef}
        />
      )}
    </div>
  );
}
