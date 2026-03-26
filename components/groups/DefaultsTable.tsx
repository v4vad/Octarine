import React, { useState, useMemo } from 'react';
import type { Color, ColorMethod, Stop } from '../../lib/types';
import { MethodToggle, RefBasedNumericInput } from '../primitives';

interface DefaultsTableProps {
  color: Color;
  onUpdate: (updates: Partial<Color>) => void;
}

export function DefaultsTable({ color, onUpdate }: DefaultsTableProps) {
  const [newStopNumber, setNewStopNumber] = useState('');

  const stopNumbers = useMemo(
    () => Object.keys(color.defaultLightness)
      .map(Number)
      .sort((a, b) => a - b),
    [color.defaultLightness]
  );

  const isLightnessActive = color.method === 'lightness';

  const handleValueEdit = (stopNum: number, newValue: number) => {
    if (isLightnessActive) {
      onUpdate({
        defaultLightness: { ...color.defaultLightness, [stopNum]: newValue },
      });
    } else {
      onUpdate({
        defaultContrast: { ...color.defaultContrast, [stopNum]: newValue },
      });
    }
  };

  const handleAddStop = () => {
    const num = parseInt(newStopNumber, 10);
    if (isNaN(num) || num <= 0) return;
    if (color.defaultLightness[num] !== undefined) return;

    const newLightness = {
      ...color.defaultLightness,
      [num]: interpolateValue(num, color.defaultLightness, 0.5),
    };
    const newContrast = {
      ...color.defaultContrast,
      [num]: interpolateValue(num, color.defaultContrast, 4.5),
    };

    // Add stop to both defaults and stops array
    const newStop: Stop = { number: num };
    const newStops = [...color.stops, newStop].sort((a, b) => a.number - b.number);

    onUpdate({
      defaultLightness: newLightness,
      defaultContrast: newContrast,
      stops: newStops,
    });
    setNewStopNumber('');
  };

  return (
    <div className="defaults-section">
      {/* Method toggle above table */}
      <MethodToggle
        method={color.method}
        onChange={(method: ColorMethod) => onUpdate({ method })}
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
                    value={color.defaultLightness[num] ?? 0.5}
                    onChange={(val) => handleValueEdit(num, val)}
                    min={0}
                    max={1}
                    decimals={2}
                  />
                ) : (
                  <RefBasedNumericInput
                    value={color.defaultContrast[num] ?? 4.5}
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
