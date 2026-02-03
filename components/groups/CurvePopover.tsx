import React, { useRef, useEffect } from 'react';
import type { StopValueCurve, StopValueCurvePreset } from '../../lib/types';
import { CurveGraph } from './CurveGraph';

interface CurvePopoverProps {
  curve: StopValueCurve;
  type: 'lightness' | 'contrast';
  stops: number[];
  onPresetChange: (preset: StopValueCurvePreset) => void;
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
 * Popover containing curve preset dropdown and visual graph
 */
export function CurvePopover({
  curve,
  type,
  stops,
  onPresetChange,
  onClose,
  anchorRef
}: CurvePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

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

  // Add 'custom' if currently selected (can't manually select it)
  if (curve.preset === 'custom') {
    // Custom is shown but not selectable from dropdown
  }

  return (
    <div ref={popoverRef} className="curve-popover">
      {/* Preset dropdown */}
      <div className="curve-popover-section">
        <label className="curve-popover-label">Curve Preset</label>
        <select
          className="curve-popover-select"
          value={curve.preset}
          onChange={(e) => onPresetChange(e.target.value as StopValueCurvePreset)}
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
          Values were manually edited. Select a preset to reset.
        </div>
      )}

      {/* Visual graph */}
      <div className="curve-popover-graph">
        <CurveGraph
          curve={curve}
          type={type}
          width={160}
          height={80}
          stops={stops}
        />
      </div>

      {/* Axis labels */}
      <div className="curve-popover-axis-labels">
        <span className="curve-axis-label-light">Light</span>
        <span className="curve-axis-label-dark">Dark</span>
      </div>
    </div>
  );
}
