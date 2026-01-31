import React, { useRef, useEffect } from 'react';

interface RefBasedNumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function RefBasedNumericInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  decimals = 1,
  style,
  className
}: RefBasedNumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (inputRef.current && !isFocusedRef.current) {
      inputRef.current.value = value.toFixed(decimals);
    }
  }, [value, decimals]);

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (inputRef.current) {
      const parsed = parseFloat(inputRef.current.value);
      if (!isNaN(parsed)) {
        const clamped = Math.max(min, Math.min(max, parsed));
        onChange(clamped);
        inputRef.current.value = clamped.toFixed(decimals);
      } else {
        inputRef.current.value = value.toFixed(decimals);
      }
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value.toFixed(decimals)}
      onFocus={() => { isFocusedRef.current = true; }}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={style}
      className={className}
    />
  );
}
