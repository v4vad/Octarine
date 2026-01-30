import React from 'react';
import { Color, EffectiveSettings } from '../../lib/types';
import { BaseColorField } from './BaseColorField';
import { ColorQualitySection } from './ColorQualitySection';
import { CorrectionsSection } from './CorrectionsSection';
import { HueShiftCurveSection } from './HueShiftCurveSection';
import { ChromaCurveSection } from './ChromaCurveSection';

interface ColorSettingsContentProps {
  color: Color;
  globalSettings: EffectiveSettings;
  onUpdate: (color: Color) => void;
}

export function ColorSettingsContent({
  color,
  globalSettings,
  onUpdate
}: ColorSettingsContentProps) {
  return (
    <>
      <BaseColorField
        color={color.baseColor}
        onChange={(hex) => onUpdate({ ...color, baseColor: hex })}
      />

      <ColorQualitySection
        preserveColorIdentity={color.preserveColorIdentity !== false}
        onChange={(val) => onUpdate({ ...color, preserveColorIdentity: val })}
      />

      <CorrectionsSection
        hkCorrection={color.hkCorrection ?? false}
        bbCorrection={color.bbCorrection ?? false}
        onHkChange={(val) => onUpdate({ ...color, hkCorrection: val })}
        onBbChange={(val) => onUpdate({ ...color, bbCorrection: val })}
      />

      <HueShiftCurveSection
        baseColor={color.baseColor}
        hueShiftCurve={color.hueShiftCurve}
        onChange={(curve) => onUpdate({ ...color, hueShiftCurve: curve })}
      />

      <ChromaCurveSection
        baseColor={color.baseColor}
        chromaCurve={color.chromaCurve}
        onChange={(curve) => onUpdate({ ...color, chromaCurve: curve })}
      />
    </>
  );
}
