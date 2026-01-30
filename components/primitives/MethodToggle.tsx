import React from 'react';

interface MethodToggleProps {
  method: 'lightness' | 'contrast';
  onChange: (method: 'lightness' | 'contrast') => void;
}

export function MethodToggle({ method, onChange }: MethodToggleProps) {
  return (
    <div className="method-toggle">
      <button
        className={`method-toggle-btn ${method === 'lightness' ? 'active' : ''}`}
        onClick={() => onChange('lightness')}
      >
        Lightness
      </button>
      <button
        className={`method-toggle-btn ${method === 'contrast' ? 'active' : ''}`}
        onClick={() => onChange('contrast')}
      >
        Contrast
      </button>
    </div>
  );
}
