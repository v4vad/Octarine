import React, { useRef } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  unit = '',
  onChange
}: SliderProps) {
  const rafRef = useRef<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (isNaN(parsed)) return;
    const clamped = Math.max(min, Math.min(max, parsed));
    // Throttle to one update per animation frame — prevents >60 onChange
    // calls/second on high-refresh displays from flooding React's queue
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      onChange(clamped);
      rafRef.current = null;
    });
  };

  return (
    <div className="chroma-slider-row">
      <span className="chroma-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
      />
      <span className="chroma-slider-value">{value}{unit}</span>
    </div>
  );
}
