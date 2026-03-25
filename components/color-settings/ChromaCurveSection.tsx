import React from 'react';
import {
  ChromaCurve,
  ChromaCurvePreset,
  CHROMA_CURVE_PRESETS
} from '../../lib/types';
import { hexToOklch, oklchToHex } from '../../lib/color-utils';
import { Slider } from '../primitives';

interface ChromaCurveSectionProps {
  baseColor: string;
  chromaCurve: ChromaCurve | undefined;
  onChange: (curve: ChromaCurve) => void;
}

export function ChromaCurveSection({
  baseColor,
  chromaCurve,
  onChange
}: ChromaCurveSectionProps) {
  const preset = chromaCurve?.preset ?? 'flat';
  const lightChroma = chromaCurve?.lightChroma ?? 100;
  const midChroma = chromaCurve?.midChroma ?? 100;
  const darkChroma = chromaCurve?.darkChroma ?? 100;

  const handlePresetChange = (newPreset: ChromaCurvePreset) => {
    if (newPreset === 'custom') {
      // Initialize custom with current preset values or defaults
      const current = chromaCurve?.preset && chromaCurve.preset !== 'custom'
        ? CHROMA_CURVE_PRESETS[chromaCurve.preset]
        : { light: 100, mid: 100, dark: 100 };
      onChange({
        preset: 'custom',
        lightChroma: current.light,
        midChroma: current.mid,
        darkChroma: current.dark,
      });
    } else {
      onChange({ preset: newPreset });
    }
  };

  // Get current values for preview
  const values = preset === 'custom'
    ? { light: lightChroma, mid: midChroma, dark: darkChroma }
    : CHROMA_CURVE_PRESETS[preset];

  return (
    <div className="stop-popup-section">
      <div className="stop-popup-label">Chroma Curve</div>
      <select
        className="chroma-curve-select"
        value={preset}
        onChange={(e) => handlePresetChange(e.target.value as ChromaCurvePreset)}
      >
        <option value="flat">Flat</option>
        <option value="bell">Bell</option>
        <option value="pastel">Pastel</option>
        <option value="jewel">Jewel</option>
        <option value="linear-fade">Linear Fade</option>
        <option value="custom">Custom</option>
      </select>

      {/* Curve Preview - uses actual chroma-scaled colors */}
      <div className="chroma-curve-preview">
        {(['light', 'mid', 'dark'] as const).map((level) => {
          const oklch = hexToOklch(baseColor);
          const scaledHex = oklchToHex({
            ...oklch,
            c: oklch.c * (values[level] / 100)
          });
          return (
            <div
              key={level}
              className="chroma-bar"
              style={{ background: scaledHex }}
              title={`${level.charAt(0).toUpperCase() + level.slice(1)}: ${values[level]}%`}
            />
          );
        })}
      </div>

      {/* Custom Sliders */}
      {preset === 'custom' && (
        <div className="chroma-curve-sliders">
          <Slider
            label="Light"
            value={lightChroma}
            min={0}
            max={100}
            unit="%"
            onChange={(val) => onChange({
              preset: 'custom',
              lightChroma: val,
              midChroma: midChroma,
              darkChroma: darkChroma,
            })}
          />
          <Slider
            label="Mid"
            value={midChroma}
            min={0}
            max={100}
            unit="%"
            onChange={(val) => onChange({
              preset: 'custom',
              lightChroma: lightChroma,
              midChroma: val,
              darkChroma: darkChroma,
            })}
          />
          <Slider
            label="Dark"
            value={darkChroma}
            min={0}
            max={100}
            unit="%"
            onChange={(val) => onChange({
              preset: 'custom',
              lightChroma: lightChroma,
              midChroma: midChroma,
              darkChroma: val,
            })}
          />
        </div>
      )}
    </div>
  );
}
