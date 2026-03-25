import React, { useState, useMemo } from 'react';
import type { GroupSettings, StopValueCurve, StopValueCurvePreset } from '../../lib/types';
import { MethodToggle, RefBasedNumericInput } from '../primitives';
import { CurveSelector } from './CurveSelector';
import { getLightnessFromCurve, getContrastFromCurve } from '../../lib/stop-value-curves';

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

  // Get the active curve based on method
  const activeCurve: StopValueCurve = isLightnessActive
    ? (settings.lightnessCurve ?? { preset: 'linear' })
    : (settings.contrastCurve ?? { preset: 'linear' });

  // Compute displayed values from curve
  const displayedValues = useMemo(() => {
    const values: Record<number, number> = {};
    for (const stopNum of stopNumbers) {
      if (isLightnessActive) {
        values[stopNum] = getLightnessFromCurve(stopNum, stopNumbers, activeCurve);
      } else {
        values[stopNum] = getContrastFromCurve(stopNum, stopNumbers, activeCurve);
      }
    }
    return values;
  }, [stopNumbers, activeCurve, isLightnessActive]);

  // Check if a stop has an override in the curve
  const hasOverride = (stopNum: number): boolean => {
    return activeCurve.overrides?.[stopNum] !== undefined;
  };

  const handleCurveChange = (newCurve: StopValueCurve) => {
    if (isLightnessActive) {
      onUpdate({
        ...settings,
        lightnessCurve: newCurve,
        // Update legacy lookup table to stay in sync
        defaultLightness: computeLegacyValues(stopNumbers, newCurve, 'lightness'),
      });
    } else {
      onUpdate({
        ...settings,
        contrastCurve: newCurve,
        // Update legacy lookup table to stay in sync
        defaultContrast: computeLegacyValues(stopNumbers, newCurve, 'contrast'),
      });
    }
  };

  const handleValueEdit = (stopNum: number, newValue: number) => {
    // When user edits a value, add it as an override and switch to "custom" preset
    const newOverrides = { ...activeCurve.overrides, [stopNum]: newValue };

    const newCurve: StopValueCurve = {
      preset: 'custom' as StopValueCurvePreset,
      // Preserve existing custom control points if any
      lightValue: activeCurve.lightValue,
      midValue: activeCurve.midValue,
      darkValue: activeCurve.darkValue,
      overrides: newOverrides,
    };

    handleCurveChange(newCurve);
  };

  const handleResetOverride = (stopNum: number) => {
    if (!activeCurve.overrides?.[stopNum]) return;

    const newOverrides = { ...activeCurve.overrides };
    delete newOverrides[stopNum];

    // If no more overrides and preset is custom, check if we can stay custom
    const hasRemainingOverrides = Object.keys(newOverrides).length > 0;

    const newCurve: StopValueCurve = {
      ...activeCurve,
      overrides: hasRemainingOverrides ? newOverrides : undefined,
      // Keep custom preset if there are still overrides or custom values
      preset: hasRemainingOverrides || activeCurve.lightValue !== undefined
        ? 'custom'
        : 'linear',
    };

    handleCurveChange(newCurve);
  };

  const handleAddStop = () => {
    const num = parseInt(newStopNumber, 10);
    if (isNaN(num) || num <= 0) return;
    if (settings.defaultLightness[num] !== undefined) return;

    // New stops just get added to the lookup tables
    // The curve will automatically interpolate values for them
    const newStops = [...stopNumbers, num].sort((a, b) => a - b);

    // Compute interpolated values from curve for the legacy tables
    const newLightness = computeLegacyValues(newStops, settings.lightnessCurve ?? { preset: 'linear' }, 'lightness');
    const newContrast = computeLegacyValues(newStops, settings.contrastCurve ?? { preset: 'linear' }, 'contrast');

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

      {/* Curve selector */}
      <CurveSelector
        curve={activeCurve}
        type={isLightnessActive ? 'lightness' : 'contrast'}
        stops={stopNumbers}
        onCurveChange={handleCurveChange}
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
            <tr key={num} className={hasOverride(num) ? 'has-override' : ''}>
              <td className="stop-col">
                {num}
                {hasOverride(num) && (
                  <button
                    className="stop-override-reset"
                    onClick={() => handleResetOverride(num)}
                    title="Reset to curve value"
                  >
                    ×
                  </button>
                )}
              </td>
              <td className="value-col">
                {isLightnessActive ? (
                  <RefBasedNumericInput
                    value={displayedValues[num] ?? 0.5}
                    onChange={(val) => handleValueEdit(num, val)}
                    min={0}
                    max={1}
                    decimals={2}
                  />
                ) : (
                  <RefBasedNumericInput
                    value={displayedValues[num] ?? 4.5}
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
 * Compute legacy lookup table values from curve
 * This keeps the old defaultLightness/defaultContrast in sync for backward compatibility
 */
function computeLegacyValues(
  stops: number[],
  curve: StopValueCurve,
  type: 'lightness' | 'contrast'
): Record<number, number> {
  const values: Record<number, number> = {};
  for (const stopNum of stops) {
    if (type === 'lightness') {
      values[stopNum] = getLightnessFromCurve(stopNum, stops, curve);
    } else {
      values[stopNum] = getContrastFromCurve(stopNum, stops, curve);
    }
  }
  return values;
}
