import React from 'react';
import { Toggle } from '../primitives';

interface CorrectionsSectionProps {
  hkCorrection: boolean;
  bbCorrection: boolean;
  onHkChange: (value: boolean) => void;
  onBbChange: (value: boolean) => void;
}

export function CorrectionsSection({
  hkCorrection,
  bbCorrection,
  onHkChange,
  onBbChange
}: CorrectionsSectionProps) {
  return (
    <div className="stop-popup-section">
      <div className="stop-popup-label">Corrections</div>
      <div className="toggle-stack">
        <Toggle
          label="Helmholtz-Kohlrausch"
          checked={hkCorrection}
          onChange={onHkChange}
          tooltip="Compensates for saturated colors appearing brighter to the eye"
        />
        <Toggle
          label="Bezold-Brücke"
          checked={bbCorrection}
          onChange={onBbChange}
          tooltip="Corrects for hue shifts that occur at different lightness levels"
        />
      </div>
    </div>
  );
}
