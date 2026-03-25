import React, { useRef, useCallback, useEffect } from 'react';

interface HueSliderProps {
  hue: number;
  onChange: (hue: number) => void;
}

export function HueSlider({ hue, onChange }: HueSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const getHueFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    const slider = sliderRef.current;
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(x * 360);
  }, [onChange]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) getHueFromEvent(e);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [getHueFromEvent]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    getHueFromEvent(e);
  };

  return (
    <div
      ref={sliderRef}
      className="hue-slider"
      onMouseDown={handleMouseDown}
    >
      <div className="hue-handle" style={{ left: `${(hue / 360) * 100}%` }} />
    </div>
  );
}
