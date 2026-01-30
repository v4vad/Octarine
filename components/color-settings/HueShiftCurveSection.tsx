import React from 'react';
import {
  HueShiftCurve,
  HueShiftCurvePreset,
  HUE_SHIFT_CURVE_PRESETS
} from '../../lib/types';
import { hexToOklch, oklchToHex, getYellowEquivalentShifts } from '../../lib/color-utils';
import { Slider } from '../primitives';

interface HueShiftCurveSectionProps {
  baseColor: string;
  hueShiftCurve: HueShiftCurve | undefined;
  onChange: (curve: HueShiftCurve) => void;
}

export function HueShiftCurveSection({
  baseColor,
  hueShiftCurve,
  onChange
}: HueShiftCurveSectionProps) {
  const preset = hueShiftCurve?.preset ?? 'none';
  const lightShift = hueShiftCurve?.lightShift ?? 0;
  const darkShift = hueShiftCurve?.darkShift ?? 0;

  const handlePresetChange = (newPreset: HueShiftCurvePreset) => {
    if (newPreset === 'custom') {
      // Check if this is a yellow color - use calculated yellow shifts
      const baseOklch = hexToOklch(baseColor);
      const yellowShifts = getYellowEquivalentShifts(baseOklch.h);

      // Use yellow-calculated values if yellow, otherwise use preset values
      const current = yellowShifts
        ? yellowShifts
        : (hueShiftCurve?.preset && hueShiftCurve.preset !== 'custom'
            ? HUE_SHIFT_CURVE_PRESETS[hueShiftCurve.preset]
            : { light: 0, dark: 0 });

      onChange({
        preset: 'custom',
        lightShift: current.light,
        darkShift: current.dark,
      });
    } else {
      onChange({ preset: newPreset });
    }
  };

  // Get current values for preview
  const values = preset === 'custom'
    ? { light: lightShift, dark: darkShift }
    : (preset === 'none' ? { light: 0, dark: 0 } : HUE_SHIFT_CURVE_PRESETS[preset]);

  // Calculate preview colors
  const baseOklch = hexToOklch(baseColor);
  const lightL = 0.85;
  const midL = 0.55;
  const darkL = 0.25;

  const lightHue = (baseOklch.h + values.light + 360) % 360;
  const lightColor = oklchToHex({ l: lightL, c: baseOklch.c * 0.6, h: lightHue });

  const midColor = oklchToHex({ l: midL, c: baseOklch.c, h: baseOklch.h });

  const darkHue = (baseOklch.h + values.dark + 360) % 360;
  const darkColor = oklchToHex({ l: darkL, c: baseOklch.c * 0.8, h: darkHue });

  return (
    <div className="stop-popup-section">
      <div className="stop-popup-label">Hue Shift Curve</div>
      <select
        className="chroma-curve-select"
        value={preset}
        onChange={(e) => handlePresetChange(e.target.value as HueShiftCurvePreset)}
      >
        <option value="none">None</option>
        <option value="subtle">Subtle</option>
        <option value="natural">Natural</option>
        <option value="dramatic">Dramatic</option>
        <option value="custom">Custom</option>
      </select>

      {/* Visual Curve Preview - shows actual shifted colors */}
      <div className="hue-shift-visual-preview">
        <div
          className="hue-bar"
          style={{ background: lightColor }}
          title={`Light: ${values.light > 0 ? '+' : ''}${values.light}°`}
        />
        <div
          className="hue-bar"
          style={{ background: midColor }}
          title="Mid: 0°"
        />
        <div
          className="hue-bar"
          style={{ background: darkColor }}
          title={`Dark: ${values.dark > 0 ? '+' : ''}${values.dark}°`}
        />
      </div>

      {/* Custom Sliders */}
      {preset === 'custom' && (
        <div className="chroma-curve-sliders">
          <Slider
            label="Light"
            value={lightShift}
            min={-20}
            max={20}
            unit="°"
            onChange={(val) => onChange({
              preset: 'custom',
              lightShift: val,
              darkShift: darkShift,
            })}
          />
          <Slider
            label="Dark"
            value={darkShift}
            min={-20}
            max={20}
            unit="°"
            onChange={(val) => onChange({
              preset: 'custom',
              lightShift: lightShift,
              darkShift: val,
            })}
          />
        </div>
      )}
    </div>
  );
}
