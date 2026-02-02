import React, { useState, useMemo } from 'react';
import { GlobalSettings } from '../../lib/types';
import { MethodToggle, RefBasedNumericInput } from '../primitives';

interface DefaultsTableProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
}

export function DefaultsTable({ settings, onUpdate }: DefaultsTableProps) {
  const [newStopNumber, setNewStopNumber] = useState('');

  const stopNumbers = useMemo(
    () => Object.keys(settings.defaultLightness)
      .map(Number)
      .sort((a, b) => a - b),
    [settings.defaultLightness]
  );

  const handleAddStop = () => {
    const num = parseInt(newStopNumber, 10);
    if (isNaN(num) || num <= 0) return;
    if (settings.defaultLightness[num] !== undefined) return;

    // Calculate interpolated values based on neighbors
    const sorted = [...stopNumbers, num].sort((a, b) => a - b);
    const idx = sorted.indexOf(num);

    let newL = 0.5;
    let newC = 4.5;

    if (idx > 0 && idx < sorted.length - 1) {
      // Interpolate between neighbors
      const prevStop = sorted[idx - 1];
      const nextStop = sorted[idx + 1];
      const ratio = (num - prevStop) / (nextStop - prevStop);
      newL = settings.defaultLightness[prevStop] + ratio * (settings.defaultLightness[nextStop] - settings.defaultLightness[prevStop]);
      newC = settings.defaultContrast[prevStop] + ratio * (settings.defaultContrast[nextStop] - settings.defaultContrast[prevStop]);
    } else if (idx === 0 && sorted.length > 1) {
      newL = settings.defaultLightness[sorted[1]] + 0.05;
      newC = settings.defaultContrast[sorted[1]] - 0.5;
    } else if (idx === sorted.length - 1 && sorted.length > 1) {
      newL = settings.defaultLightness[sorted[sorted.length - 2]] - 0.05;
      newC = settings.defaultContrast[sorted[sorted.length - 2]] + 1;
    }

    onUpdate({
      ...settings,
      defaultLightness: { ...settings.defaultLightness, [num]: Math.max(0, Math.min(1, newL)) },
      defaultContrast: { ...settings.defaultContrast, [num]: Math.max(1, Math.min(21, newC)) },
    });
    setNewStopNumber('');
  };

  const isLightnessActive = settings.method === 'lightness';

  return (
    <div className="defaults-section">
      {/* Method toggle above table */}
      <MethodToggle
        method={settings.method}
        onChange={(method) => onUpdate({ ...settings, method })}
      />

      {/* Table with both columns */}
      <table className="defaults-table dual-column">
        <thead>
          <tr>
            <th className="stop-col">stop</th>
            <th className={`value-col ${isLightnessActive ? '' : 'inactive'}`}>
              Lightness
            </th>
            <th className={`value-col ${!isLightnessActive ? '' : 'inactive'}`}>
              Contrast
            </th>
          </tr>
        </thead>
        <tbody>
          {stopNumbers.map((num) => (
            <tr key={num}>
              <td className="stop-col">{num}</td>
              <td className={`value-col ${isLightnessActive ? '' : 'inactive'}`}>
                <RefBasedNumericInput
                  value={settings.defaultLightness[num] ?? 0.5}
                  onChange={(val) => {
                    onUpdate({
                      ...settings,
                      defaultLightness: { ...settings.defaultLightness, [num]: val },
                    });
                  }}
                  min={0}
                  max={1}
                  decimals={2}
                />
              </td>
              <td className={`value-col ${!isLightnessActive ? '' : 'inactive'}`}>
                <RefBasedNumericInput
                  value={settings.defaultContrast[num] ?? 1}
                  onChange={(val) => {
                    onUpdate({
                      ...settings,
                      defaultContrast: { ...settings.defaultContrast, [num]: val },
                    });
                  }}
                  min={1}
                  max={21}
                  decimals={2}
                />
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
          style={{ width: '60px' }}
        />
        <button onClick={handleAddStop} className="btn btn-compact">
          + Add Stop
        </button>
      </div>
    </div>
  );
}
