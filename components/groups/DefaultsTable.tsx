import React, { useState, useMemo } from 'react';
import type { GroupSettings } from '../../lib/types';
import { MethodToggle, RefBasedNumericInput } from '../primitives';

interface DefaultsTableProps {
  settings: GroupSettings;
  onUpdate: (settings: GroupSettings) => void;
}

export function DefaultsTable({ settings, onUpdate }: DefaultsTableProps) {
  const [newStopNumber, setNewStopNumber] = useState('');

  const stopNumbers = useMemo(
    () => Object.keys(settings.defaultLightness)
      .map(Number)
      .sort((a, b) => a - b),
    [settings.defaultLightness]
  );

  const isLightnessActive = settings.method === 'lightness';

  const handleValueEdit = (stopNum: number, newValue: number) => {
    if (isLightnessActive) {
      onUpdate({
        ...settings,
        defaultLightness: { ...settings.defaultLightness, [stopNum]: newValue },
      });
    } else {
      onUpdate({
        ...settings,
        defaultContrast: { ...settings.defaultContrast, [stopNum]: newValue },
      });
    }
  };

  const handleAddStop = () => {
    const num = parseInt(newStopNumber, 10);
    if (isNaN(num) || num <= 0) return;
    if (settings.defaultLightness[num] !== undefined) return;

    const newLightness = {
      ...settings.defaultLightness,
      [num]: interpolateValue(num, settings.defaultLightness, 0.5),
    };
    const newContrast = {
      ...settings.defaultContrast,
      [num]: interpolateValue(num, settings.defaultContrast, 4.5),
    };

    onUpdate({
      ...settings,
      defaultLightness: newLightness,
      defaultContrast: newContrast,
    });
    setNewStopNumber('');
  };

  return (
    <div className="defaults-section">
      {/* Method toggle above table */}
      <MethodToggle
        method={settings.method}
        onChange={(method) => onUpdate({ ...settings, method })}
      />

      {/* Table with single active column */}
      <table className="defaults-table">
        <thead>
          <tr>
            <th className="stop-col">stop</th>
            <th className="value-col" style={{ textAlign: 'right' }}>
              {isLightnessActive ? 'Lightness' : 'Contrast'}
            </th>
          </tr>
        </thead>
        <tbody>
          {stopNumbers.map((num) => (
            <tr key={num}>
              <td className="stop-col">{num}</td>
              <td className="value-col">
                {isLightnessActive ? (
                  <RefBasedNumericInput
                    value={settings.defaultLightness[num] ?? 0.5}
                    onChange={(val) => handleValueEdit(num, val)}
                    min={0}
                    max={1}
                    decimals={2}
                  />
                ) : (
                  <RefBasedNumericInput
                    value={settings.defaultContrast[num] ?? 4.5}
                    onChange={(val) => handleValueEdit(num, val)}
                    min={1}
                    max={21}
                    decimals={2}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add Stop */}
      <div className="flex gap-1 mt-2">
        <input
          type="text"
          value={newStopNumber}
          onChange={(e) => setNewStopNumber(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddStop(); }}
          placeholder="e.g. 150"
          className="input-sm"
          style={{ flex: 1 }}
        />
        <button onClick={handleAddStop} className="btn btn-compact">
          + Add Stop
        </button>
      </div>
    </div>
  );
}

/**
 * Linearly interpolate a value for a new stop based on its nearest neighbors.
 * - If neighbors exist on both sides, interpolate between them.
 * - If only one side has a neighbor, use that neighbor's value.
 * - If no neighbors exist, use the fallback default.
 */
function interpolateValue(
  newStop: number,
  existing: Record<number, number>,
  fallback: number
): number {
  const sorted = Object.keys(existing).map(Number).sort((a, b) => a - b);
  if (sorted.length === 0) return fallback;

  // Find neighbors
  let lower: number | undefined;
  let upper: number | undefined;
  for (const s of sorted) {
    if (s < newStop) lower = s;
    if (s > newStop && upper === undefined) upper = s;
  }

  if (lower !== undefined && upper !== undefined) {
    // Interpolate between neighbors
    const t = (newStop - lower) / (upper - lower);
    return existing[lower] + (existing[upper] - existing[lower]) * t;
  }
  if (lower !== undefined) return existing[lower];
  if (upper !== undefined) return existing[upper];
  return fallback;
}
