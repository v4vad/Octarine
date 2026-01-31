import React from 'react';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onReset?: () => void;
  tooltip?: string;
}

export function Toggle({ label, checked, onChange, onReset, tooltip }: ToggleProps) {
  return (
    <div
      className="toggle-wrapper"
      onDoubleClick={onReset ? () => onReset() : undefined}
      title={tooltip || (onReset ? 'Double-click to reset to global' : undefined)}
    >
      <span className="toggle-label">{label}</span>
      <div
        className={`toggle-switch ${checked ? 'on' : 'off'}`}
        onClick={() => onChange(!checked)}
      >
        <div className="toggle-thumb" />
      </div>
    </div>
  );
}
