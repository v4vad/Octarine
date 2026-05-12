import React from 'react';

type ViewMode = 'all' | 'selected';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div className="method-toggle">
      <button
        className={`method-toggle-btn ${mode === 'all' ? 'active' : ''}`}
        onClick={() => onChange('all')}
      >
        All Colors
      </button>
      <button
        className={`method-toggle-btn ${mode === 'selected' ? 'active' : ''}`}
        onClick={() => onChange('selected')}
      >
        Selected
      </button>
    </div>
  );
}
