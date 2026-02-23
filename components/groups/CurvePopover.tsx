import React, { useRef, useEffect, useCallback } from 'react';
import type { StopValueCurve, StopValueCurvePreset } from '../../lib/types';
import { LIGHTNESS_CURVE_PRESETS, CONTRAST_CURVE_PRESETS } from '../../lib/types';
import { CurveGraph } from './CurveGraph';

interface CurvePopoverProps {
  curve: StopValueCurve;
  type: 'lightness' | 'contrast';
  stops: number[];
  onCurveChange: (curve: StopValueCurve) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

const PRESET_LABELS: Record<StopValueCurvePreset, string> = {
  'linear': 'Linear',
  'lifted-darks': 'Lifted Darks',
  'compressed-range': 'Compressed Range',
  'expanded-ends': 'Expanded Ends',
  'custom': 'Custom'
};

const PRESET_DESCRIPTIONS: Record<Exclude<StopValueCurvePreset, 'custom'>, string> = {
  'linear': 'Balanced distribution across all stops',
  'lifted-darks': 'More visible colors at dark stops',
  'compressed-range': 'Tighter range, less extreme values',
  'expanded-ends': 'Maximum range from light to dark'
};

/**
 * Get the current control point values from a curve
 * Returns the effective values whether from a preset or custom
 */
function getControlPointValues(
  curve: StopValueCurve,
  type: 'lightness' | 'contrast'
): { light: number; mid: number; dark: number } {
  const presets = type === 'lightness' ? LIGHTNESS_CURVE_PRESETS : CONTRAST_CURVE_PRESETS;

  if (curve.preset === 'custom') {
    const defaults = presets['linear'];
    return {
      light: curve.lightValue ?? defaults.light,
      mid: curve.midValue ?? defaults.mid,
      dark: curve.darkValue ?? defaults.dark,
    };
  }

  return presets[curve.preset];
}

/**
 * Popover containing curve preset dropdown, visual graph, and control point sliders
 */
export function CurvePopover({
  curve,
  type,
  stops,
  onCurveChange,
  onClose,
  anchorRef
}: CurvePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Get current control point values
  const controlPoints = getControlPointValues(curve, type);

  // Get min/max for sliders based on type
  const sliderConfig = type === 'lightness'
    ? { min: 0, max: 1, step: 0.01, decimals: 2 }
    : { min: 1, max: 21, step: 0.1, decimals: 1 };

  // Position popover below anchor
  useEffect(() => {
    if (!popoverRef.current || !anchorRef.current) return;

    const anchor = anchorRef.current.getBoundingClientRect();
    const popover = popoverRef.current;

    // Position below the anchor
    popover.style.top = `${anchor.bottom + 4}px`;
    popover.style.left = `${anchor.left}px`;
  }, [anchorRef]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const presetOptions: StopValueCurvePreset[] = [
    'linear',
    'lifted-darks',
    'compressed-range',
    'expanded-ends'
  ];

  // Handle preset change - resets to preset values
  const handlePresetChange = (preset: StopValueCurvePreset) => {
    onCurveChange({ preset });
  };

  // Handle control point change via slider
  const handleControlPointChange = useCallback((
    point: 'light' | 'mid' | 'dark',
    value: number
  ) => {
    // When user adjusts a slider, switch to custom mode
    const newCurve: StopValueCurve = {
      preset: 'custom',
      lightValue: point === 'light' ? value : controlPoints.light,
      midValue: point === 'mid' ? value : controlPoints.mid,
      darkValue: point === 'dark' ? value : controlPoints.dark,
      overrides: curve.overrides, // Preserve any per-stop overrides
    };
    onCurveChange(newCurve);
  }, [controlPoints, curve.overrides, onCurveChange]);

  // Format value for display
  const formatValue = (value: number): string => {
    return value.toFixed(sliderConfig.decimals);
  };

  return (
    <div ref={popoverRef} className="curve-popover curve-popover-expanded">
      {/* Header */}
      <div className="curve-popover-header">
        <span className="curve-popover-title">Stop Value Curve</span>
      </div>

      {/* Preset dropdown */}
      <div className="curve-popover-section">
        <label className="curve-popover-label">Preset</label>
        <select
          className="curve-popover-select"
          value={curve.preset}
          onChange={(e) => handlePresetChange(e.target.value as StopValueCurvePreset)}
        >
          {presetOptions.map(preset => (
            <option key={preset} value={preset}>
              {PRESET_LABELS[preset]}
            </option>
          ))}
          {curve.preset === 'custom' && (
            <option value="custom" disabled>
              Custom (modified)
            </option>
          )}
        </select>
      </div>

      {/* Description */}
      {curve.preset !== 'custom' && (
        <div className="curve-popover-description">
          {PRESET_DESCRIPTIONS[curve.preset]}
        </div>
      )}
      {curve.preset === 'custom' && (
        <div className="curve-popover-description curve-popover-custom-hint">
          Adjust sliders below or select a preset to reset.
        </div>
      )}

      {/* Visual graph - larger with draggable points */}
      <div className="curve-popover-graph">
        <CurveGraph
          curve={curve}
          type={type}
          width={220}
          height={100}
          stops={stops}
          onControlPointChange={handleControlPointChange}
        />
      </div>

      {/* Axis labels */}
      <div className="curve-popover-axis-labels">
        <span className="curve-axis-label-light">Light</span>
        <span className="curve-axis-label-mid">Mid</span>
        <span className="curve-axis-label-dark">Dark</span>
      </div>

      {/* Control point sliders */}
      <div className="curve-control-sliders">
        {/* Light slider */}
        <div className="curve-slider-row">
          <span className="curve-slider-label">Light</span>
          <input
            type="range"
            className="curve-slider-input"
            min={sliderConfig.min}
            max={sliderConfig.max}
            step={sliderConfig.step}
            value={controlPoints.light}
            onChange={(e) => handleControlPointChange('light', parseFloat(e.target.value))}
          />
          <span className="curve-slider-value">{formatValue(controlPoints.light)}</span>
        </div>

        {/* Mid slider */}
        <div className="curve-slider-row">
          <span className="curve-slider-label">Mid</span>
          <input
            type="range"
            className="curve-slider-input"
            min={sliderConfig.min}
            max={sliderConfig.max}
            step={sliderConfig.step}
            value={controlPoints.mid}
            onChange={(e) => handleControlPointChange('mid', parseFloat(e.target.value))}
          />
          <span className="curve-slider-value">{formatValue(controlPoints.mid)}</span>
        </div>

        {/* Dark slider */}
        <div className="curve-slider-row">
          <span className="curve-slider-label">Dark</span>
          <input
            type="range"
            className="curve-slider-input"
            min={sliderConfig.min}
            max={sliderConfig.max}
            step={sliderConfig.step}
            value={controlPoints.dark}
            onChange={(e) => handleControlPointChange('dark', parseFloat(e.target.value))}
          />
          <span className="curve-slider-value">{formatValue(controlPoints.dark)}</span>
        </div>
      </div>
    </div>
  );
}
