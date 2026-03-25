import React, { useState, useRef } from 'react';
import type { StopValueCurve } from '../../lib/types';
import { STOP_VALUE_PRESET_LABELS } from '../../lib/types';
import { CurvePopover } from './CurvePopover';

interface CurveSelectorProps {
  curve: StopValueCurve;
  type: 'lightness' | 'contrast';
  stops: number[];
  onCurveChange: (curve: StopValueCurve) => void;
}

/**
 * Compact row with curve icon + preset name + dropdown arrow
 * Click opens CurvePopover for full curve editing
 */
export function CurveSelector({
  curve,
  type,
  stops,
  onCurveChange
}: CurveSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLButtonElement>(null);

  // Handle curve changes from popover (preset selection or slider adjustment)
  const handleCurveChange = (newCurve: StopValueCurve) => {
    onCurveChange(newCurve);
    // Don't close popover on slider changes - only on preset selection
    // The popover will close when clicking outside or pressing Escape
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
        <span className="curve-selector-label">{STOP_VALUE_PRESET_LABELS[curve.preset]}</span>
        <span className="curve-selector-arrow">▾</span>
      </button>

      {isOpen && (
        <CurvePopover
          curve={curve}
          type={type}
          stops={stops}
          onCurveChange={handleCurveChange}
          onClose={() => setIsOpen(false)}
          anchorRef={selectorRef}
        />
      )}
    </div>
  );
}
