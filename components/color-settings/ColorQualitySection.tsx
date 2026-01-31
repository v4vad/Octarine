import React from 'react';
import { Toggle } from '../primitives';

interface ColorQualitySectionProps {
  preserveColorIdentity: boolean;
  onChange: (value: boolean) => void;
}

export function ColorQualitySection({ preserveColorIdentity, onChange }: ColorQualitySectionProps) {
  return (
    <div className="stop-popup-section">
      <div className="stop-popup-label">Color Quality</div>
      <div className="toggle-stack">
        <Toggle
          label="Preserve color identity"
          checked={preserveColorIdentity}
          onChange={onChange}
          tooltip="Keeps visible color tint at light/dark extremes (may slightly miss contrast targets)"
        />
      </div>
    </div>
  );
}
