import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  Input,
  Icon,
} from 'react-figma-plugin-ds';
import 'react-figma-plugin-ds/figma-plugin-ds.css';
import './styles.css';

import {
  Color,
  GlobalSettings,
  Stop,
  GeneratedStop,
  PaletteResult,
  AppState,
  createDefaultColor,
  createDefaultGlobalSettings,
  DEFAULT_STOPS,
  ChromaCurve,
  ChromaCurvePreset,
  CHROMA_CURVE_PRESETS,
  HueShiftCurve,
  HueShiftCurvePreset,
  HUE_SHIFT_CURVE_PRESETS,
} from './lib/types';

import { useHistory } from './lib/useHistory';

import {
  hexToOklch,
  oklchToHex,
  hexToRgb,
  rgbToHex,
  rgbToHsb,
  hsbToRgb,
  generateColor,
  generateColorPalette,
  getContrastRatio,
  DELTA_E_THRESHOLD,
  OKLCH,
} from './lib/color-utils';

// ============================================
// GRADIENT PICKER (2D Canvas)
// ============================================
interface GradientPickerProps {
  hue: number;
  saturation: number;  // 0-100 for HSB, 0-0.4 for OKLCH chroma
  brightness: number;  // 0-100 for HSB, 0-1 for OKLCH lightness
  mode: 'hsb' | 'oklch';
  onChange: (sat: number, bright: number) => void;
}

function GradientPicker({ hue, saturation, brightness, mode, onChange }: GradientPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Draw the gradient
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    if (mode === 'hsb') {
      const hueColor = `hsl(${hue}, 100%, 50%)`;
      const satGradient = ctx.createLinearGradient(0, 0, width, 0);
      satGradient.addColorStop(0, 'white');
      satGradient.addColorStop(1, hueColor);
      ctx.fillStyle = satGradient;
      ctx.fillRect(0, 0, width, height);

      const brightGradient = ctx.createLinearGradient(0, 0, 0, height);
      brightGradient.addColorStop(0, 'rgba(0,0,0,0)');
      brightGradient.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = brightGradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      const imageData = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const l = 1 - (y / height);
          const c = (x / width) * 0.4;
          const hex = oklchToHex({ l, c, h: hue });
          const rgb = hexToRgb(hex);
          const i = (y * width + x) * 4;
          imageData.data[i] = rgb.r;
          imageData.data[i + 1] = rgb.g;
          imageData.data[i + 2] = rgb.b;
          imageData.data[i + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    let posX: number, posY: number;
    if (mode === 'hsb') {
      posX = (saturation / 100) * width;
      posY = (1 - brightness / 100) * height;
    } else {
      posX = (saturation / 0.4) * width;
      posY = (1 - brightness) * height;
    }

    ctx.beginPath();
    ctx.arc(posX, posY, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(posX, posY, 7, 0, 2 * Math.PI);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hue, saturation, brightness, mode]);

  const handleMouse = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (mode === 'hsb') {
      onChange(x * 100, (1 - y) * 100);
    } else {
      onChange(x * 0.4, 1 - y);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className="gradient-canvas"
      onMouseDown={(e) => { setIsDragging(true); handleMouse(e); }}
      onMouseMove={(e) => { if (isDragging) handleMouse(e); }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    />
  );
}

// ============================================
// HUE SLIDER
// ============================================
interface HueSliderProps {
  hue: number;
  onChange: (hue: number) => void;
}

function HueSlider({ hue, onChange }: HueSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const slider = sliderRef.current;
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(x * 360);
  };

  return (
    <div
      ref={sliderRef}
      className="hue-slider"
      onMouseDown={(e) => { setIsDragging(true); handleMouse(e); }}
      onMouseMove={(e) => { if (isDragging) handleMouse(e); }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      <div className="hue-handle" style={{ left: `${(hue / 360) * 100}%` }} />
    </div>
  );
}

// ============================================
// COLOR PICKER POPUP
// ============================================
interface ColorPickerPopupProps {
  color: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  onReset?: () => void;
}

function ColorPickerPopup({ color, onChange, onClose, onReset }: ColorPickerPopupProps) {
  const [hex, setHex] = useState(color);
  const [oklch, setOklch] = useState<OKLCH>(hexToOklch(color));
  const [hsb, setHsb] = useState(() => {
    const rgb = hexToRgb(color);
    return rgbToHsb(rgb.r, rgb.g, rgb.b);
  });
  const popupRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'oklch' | 'hex' | 'hsb'>('hsb');
  const [hexInput, setHexInput] = useState(color);
  const [lInput, setLInput] = useState(oklch.l.toFixed(2));
  const [cInput, setCInput] = useState(oklch.c.toFixed(3));
  const [hInput, setHInput] = useState(oklch.h.toFixed(0));
  const [hsbHInput, setHsbHInput] = useState(hsb.h.toFixed(0));
  const [hsbSInput, setHsbSInput] = useState(hsb.s.toFixed(0));
  const [hsbBInput, setHsbBInput] = useState(hsb.b.toFixed(0));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.pluginMessage?.type === 'selection-color') {
        const colorHex = e.data.pluginMessage.color as string;
        setHex(colorHex);
        setHexInput(colorHex);
        const newOklch = hexToOklch(colorHex);
        setOklch(newOklch);
        setLInput(newOklch.l.toFixed(2));
        setCInput(newOklch.c.toFixed(3));
        setHInput(newOklch.h.toFixed(0));
        const rgb = hexToRgb(colorHex);
        const newHsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
        setHsb(newHsb);
        setHsbHInput(newHsb.h.toFixed(0));
        setHsbSInput(newHsb.s.toFixed(0));
        setHsbBInput(newHsb.b.toFixed(0));
        onChange(colorHex);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onChange]);

  const expandHexShorthand = (hex: string): string => {
    const h = hex.replace('#', '');
    if (h.length === 1) return '#' + h.repeat(6);
    if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
    return hex;
  };

  const applyHex = (newHex: string) => {
    const expanded = expandHexShorthand(newHex);
    if (/^#[0-9A-Fa-f]{6}$/.test(expanded)) {
      setHex(expanded);
      setHexInput(expanded);
      const newOklch = hexToOklch(expanded);
      setOklch(newOklch);
      setLInput(newOklch.l.toFixed(2));
      setCInput(newOklch.c.toFixed(3));
      setHInput(newOklch.h.toFixed(0));
      const rgb = hexToRgb(expanded);
      const newHsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
      setHsb(newHsb);
      setHsbHInput(newHsb.h.toFixed(0));
      setHsbSInput(newHsb.s.toFixed(0));
      setHsbBInput(newHsb.b.toFixed(0));
      onChange(expanded);
    }
  };

  const applyOklch = (newOklch: OKLCH) => {
    setOklch(newOklch);
    setLInput(newOklch.l.toFixed(2));
    setCInput(newOklch.c.toFixed(3));
    setHInput(newOklch.h.toFixed(0));
    const newHex = oklchToHex(newOklch);
    setHex(newHex);
    setHexInput(newHex);
    const rgb = hexToRgb(newHex);
    const newHsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
    setHsb(newHsb);
    setHsbHInput(newHsb.h.toFixed(0));
    setHsbSInput(newHsb.s.toFixed(0));
    setHsbBInput(newHsb.b.toFixed(0));
    onChange(newHex);
  };

  const applyHsb = (newHsb: { h: number; s: number; b: number }) => {
    setHsb(newHsb);
    setHsbHInput(newHsb.h.toFixed(0));
    setHsbSInput(newHsb.s.toFixed(0));
    setHsbBInput(newHsb.b.toFixed(0));
    const rgb = hsbToRgb(newHsb.h, newHsb.s, newHsb.b);
    const newHex = rgbToHex(Math.round(rgb.r), Math.round(rgb.g), Math.round(rgb.b));
    setHex(newHex);
    setHexInput(newHex);
    const newOklch = hexToOklch(newHex);
    setOklch(newOklch);
    setLInput(newOklch.l.toFixed(2));
    setCInput(newOklch.c.toFixed(3));
    setHInput(newOklch.h.toFixed(0));
    onChange(newHex);
  };

  const handleLBlur = () => {
    const val = parseFloat(lInput);
    if (!isNaN(val)) {
      applyOklch({ ...oklch, l: Math.max(0, Math.min(1, val)) });
    } else {
      setLInput(oklch.l.toFixed(2));
    }
  };

  const handleCBlur = () => {
    const val = parseFloat(cInput);
    if (!isNaN(val)) {
      applyOklch({ ...oklch, c: Math.max(0, val) });
    } else {
      setCInput(oklch.c.toFixed(3));
    }
  };

  const handleHBlur = () => {
    const val = parseFloat(hInput);
    if (!isNaN(val)) {
      applyOklch({ ...oklch, h: val });
    } else {
      setHInput(oklch.h.toFixed(0));
    }
  };

  const handleHsbHBlur = () => {
    const val = parseFloat(hsbHInput);
    if (!isNaN(val)) {
      applyHsb({ ...hsb, h: Math.max(0, Math.min(360, val)) });
    } else {
      setHsbHInput(hsb.h.toFixed(0));
    }
  };

  const handleHsbSBlur = () => {
    const val = parseFloat(hsbSInput);
    if (!isNaN(val)) {
      applyHsb({ ...hsb, s: Math.max(0, Math.min(100, val)) });
    } else {
      setHsbSInput(hsb.s.toFixed(0));
    }
  };

  const handleHsbBBlur = () => {
    const val = parseFloat(hsbBInput);
    if (!isNaN(val)) {
      applyHsb({ ...hsb, b: Math.max(0, Math.min(100, val)) });
    } else {
      setHsbBInput(hsb.b.toFixed(0));
    }
  };

  return (
    <div ref={popupRef} className="popup">
      <div className="tab-bar">
        {(['hex', 'hsb', 'oklch'] as const).map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
          >
            {tab.toUpperCase()}
          </div>
        ))}
      </div>

      {activeTab === 'oklch' ? (
        <>
          <GradientPicker
            hue={oklch.h}
            saturation={oklch.c}
            brightness={oklch.l}
            mode="oklch"
            onChange={(c, l) => applyOklch({ ...oklch, c, l })}
          />
          <HueSlider hue={oklch.h} onChange={(h) => applyOklch({ ...oklch, h })} />
        </>
      ) : (
        <>
          <GradientPicker
            hue={hsb.h}
            saturation={hsb.s}
            brightness={hsb.b}
            mode="hsb"
            onChange={(s, b) => applyHsb({ ...hsb, s, b })}
          />
          <HueSlider hue={hsb.h} onChange={(h) => applyHsb({ ...hsb, h })} />
        </>
      )}

      <div className="picker-action-row">
        <button
          onClick={() => parent.postMessage({ pluginMessage: { type: 'get-selection-color' } }, '*')}
          className="btn btn-full"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
          Pick from selection
        </button>
        {onReset && (
          <button
            onClick={() => {
              onReset();
              onClose();
            }}
            className="reset-icon-btn"
            title="Reset to auto"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
        )}
      </div>

      <div className="mt-3">
        {activeTab === 'hex' && (
          <div>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={() => applyHex(hexInput)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyHex(hexInput); }}
              placeholder="#000000"
              className="input input-mono input-center w-full"
            />
          </div>
        )}

        {activeTab === 'oklch' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="form-label-sm">L</label>
              <input
                type="text"
                value={lInput}
                onChange={(e) => setLInput(e.target.value)}
                onBlur={handleLBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLBlur(); }}
                className="input w-full"
              />
            </div>
            <div className="flex-1">
              <label className="form-label-sm">C</label>
              <input
                type="text"
                value={cInput}
                onChange={(e) => setCInput(e.target.value)}
                onBlur={handleCBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCBlur(); }}
                className="input w-full"
              />
            </div>
            <div className="flex-1">
              <label className="form-label-sm">H</label>
              <input
                type="text"
                value={hInput}
                onChange={(e) => setHInput(e.target.value)}
                onBlur={handleHBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleHBlur(); }}
                className="input w-full"
              />
            </div>
          </div>
        )}

        {activeTab === 'hsb' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="form-label-sm">H</label>
              <input
                type="text"
                value={hsbHInput}
                onChange={(e) => setHsbHInput(e.target.value)}
                onBlur={handleHsbHBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleHsbHBlur(); }}
                className="input w-full"
              />
            </div>
            <div className="flex-1">
              <label className="form-label-sm">S</label>
              <input
                type="text"
                value={hsbSInput}
                onChange={(e) => setHsbSInput(e.target.value)}
                onBlur={handleHsbSBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleHsbSBlur(); }}
                className="input w-full"
              />
            </div>
            <div className="flex-1">
              <label className="form-label-sm">B</label>
              <input
                type="text"
                value={hsbBInput}
                onChange={(e) => setHsbBInput(e.target.value)}
                onBlur={handleHsbBBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleHsbBBlur(); }}
                className="input w-full"
              />
            </div>
          </div>
        )}
      </div>

      <div className="color-preview">
        <div className="color-preview-swatch" style={{ backgroundColor: hex }} />
        <span className="color-preview-hex">{hex}</span>
      </div>
    </div>
  );
}

// ============================================
// CONFIRM MODAL
// ============================================
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <>
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="confirm-modal">
        <div className="confirm-modal-title">{title}</div>
        <div className="confirm-modal-message">{message}</div>
        <div className="confirm-modal-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

// ============================================
// TOGGLE SWITCH
// ============================================
interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onReset?: () => void;
  tooltip?: string;
}

function Toggle({ label, checked, onChange, onReset, tooltip }: ToggleProps) {
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

// ============================================
// METHOD TOGGLE (Lightness / Contrast)
// ============================================
interface MethodToggleProps {
  method: 'lightness' | 'contrast';
  onChange: (method: 'lightness' | 'contrast') => void;
}

function MethodToggle({ method, onChange }: MethodToggleProps) {
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

// ============================================
// REF-BASED NUMERIC INPUT
// ============================================
interface RefBasedNumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: number;
  style?: React.CSSProperties;
  className?: string;
}

function RefBasedNumericInput({
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

// ============================================
// DEFAULTS TABLE (Left Panel)
// ============================================
interface DefaultsTableProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
}

function DefaultsTable({ settings, onUpdate }: DefaultsTableProps) {
  const [newStopNumber, setNewStopNumber] = useState('');

  const stopNumbers = useMemo(
    () => Object.keys(settings.defaultLightness)
      .map(Number)
      .sort((a, b) => a - b),
    [settings.defaultLightness]
  );

  const handleAddStop = () => {
    const num = parseInt(newStopNumber, 10);
    if (isNaN(num) || num <= 0) return;
    if (settings.defaultLightness[num] !== undefined) return;

    // Calculate interpolated values based on neighbors
    const sorted = [...stopNumbers, num].sort((a, b) => a - b);
    const idx = sorted.indexOf(num);

    let newL = 0.5;
    let newC = 4.5;

    if (idx > 0 && idx < sorted.length - 1) {
      // Interpolate between neighbors
      const prevStop = sorted[idx - 1];
      const nextStop = sorted[idx + 1];
      const ratio = (num - prevStop) / (nextStop - prevStop);
      newL = settings.defaultLightness[prevStop] + ratio * (settings.defaultLightness[nextStop] - settings.defaultLightness[prevStop]);
      newC = settings.defaultContrast[prevStop] + ratio * (settings.defaultContrast[nextStop] - settings.defaultContrast[prevStop]);
    } else if (idx === 0 && sorted.length > 1) {
      newL = settings.defaultLightness[sorted[1]] + 0.05;
      newC = settings.defaultContrast[sorted[1]] - 0.5;
    } else if (idx === sorted.length - 1 && sorted.length > 1) {
      newL = settings.defaultLightness[sorted[sorted.length - 2]] - 0.05;
      newC = settings.defaultContrast[sorted[sorted.length - 2]] + 1;
    }

    onUpdate({
      ...settings,
      defaultLightness: { ...settings.defaultLightness, [num]: Math.max(0, Math.min(1, newL)) },
      defaultContrast: { ...settings.defaultContrast, [num]: Math.max(1, Math.min(21, newC)) },
    });
    setNewStopNumber('');
  };

  const isLightnessActive = settings.method === 'lightness';

  return (
    <div className="defaults-section">
      {/* Method toggle above table */}
      <MethodToggle
        method={settings.method}
        onChange={(method) => onUpdate({ ...settings, method })}
      />

      {/* Table with both columns */}
      <table className="defaults-table dual-column">
        <thead>
          <tr>
            <th className="stop-col">stop</th>
            <th className={`value-col ${isLightnessActive ? '' : 'inactive'}`}>
              Lightness
            </th>
            <th className={`value-col ${!isLightnessActive ? '' : 'inactive'}`}>
              Contrast
            </th>
          </tr>
        </thead>
        <tbody>
          {stopNumbers.map((num) => (
            <tr key={num}>
              <td className="stop-col">{num}</td>
              <td className={`value-col ${isLightnessActive ? '' : 'inactive'}`}>
                <RefBasedNumericInput
                  value={settings.defaultLightness[num] ?? 0.5}
                  onChange={(val) => {
                    onUpdate({
                      ...settings,
                      defaultLightness: { ...settings.defaultLightness, [num]: val },
                    });
                  }}
                  min={0}
                  max={1}
                  decimals={2}
                />
              </td>
              <td className={`value-col ${!isLightnessActive ? '' : 'inactive'}`}>
                <RefBasedNumericInput
                  value={settings.defaultContrast[num] ?? 1}
                  onChange={(val) => {
                    onUpdate({
                      ...settings,
                      defaultContrast: { ...settings.defaultContrast, [num]: val },
                    });
                  }}
                  min={1}
                  max={21}
                  decimals={2}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add Stop */}
      <div className="flex gap-1 mt-2">
        <input
          type="text"
          value={newStopNumber}
          onChange={(e) => setNewStopNumber(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddStop(); }}
          placeholder="e.g. 150"
          className="input-sm"
          style={{ width: '60px' }}
        />
        <button onClick={handleAddStop} className="btn" style={{ padding: '4px 8px', fontSize: '10px' }}>
          + Add Stop
        </button>
      </div>
    </div>
  );
}

// ============================================
// STOP POPUP (Click swatch to edit)
// ============================================
interface StopPopupProps {
  stop: Stop;
  stopNumber: number;
  generatedColor: string;
  wasNudged: boolean;
  effectiveMethod: 'lightness' | 'contrast';
  defaultLightness: number;
  defaultContrast: number;
  backgroundColor: string;
  position: { x: number; y: number };
  onUpdate: (updates: Partial<Stop>) => void;
  onClose: () => void;
}

function StopPopup({
  stop,
  stopNumber,
  generatedColor,
  wasNudged,
  effectiveMethod,
  defaultLightness,
  defaultContrast,
  backgroundColor,
  position,
  onUpdate,
  onClose
}: StopPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const displayColor = stop.manualOverride ? oklchToHex(stop.manualOverride) : generatedColor;
  const isOverridden = !!stop.manualOverride;

  // Calculate contrast ratio
  const contrastRatio = getContrastRatio(displayColor, backgroundColor);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleManualOverride = (hex: string) => {
    const oklch = hexToOklch(hex);
    onUpdate({ manualOverride: oklch });
  };

  const handleResetToAuto = () => {
    onUpdate({
      manualOverride: undefined,
      lightnessOverride: undefined,
      contrastOverride: undefined,
    });
  };

  return (
    <>
      <div className="popup-backdrop" onClick={onClose} />
      <div
        ref={popupRef}
        className="stop-popup"
        style={{
          left: Math.min(position.x, window.innerWidth - 280),
          top: Math.min(position.y, window.innerHeight - 400),
        }}
      >
        {/* Header */}
        <div className="stop-popup-header">
          <span className="stop-popup-title">Stop {stopNumber}</span>
          <span className="stop-popup-close" onClick={onClose}>×</span>
        </div>

        {/* Color Preview */}
        <div className="stop-popup-preview">
          <div
            className="stop-popup-swatch"
            style={{ backgroundColor: displayColor }}
            onClick={() => setShowColorPicker(!showColorPicker)}
          />
          <div className="stop-popup-info">
            <div className="stop-popup-hex">
              {displayColor.toUpperCase()}
              {isOverridden && <span className="override-indicator"> (Override)</span>}
            </div>
            <div className="stop-popup-contrast">
              {contrastRatio.toFixed(2)}:1 contrast
            </div>
          </div>
        </div>

        {/* Manual Color Picker */}
        {showColorPicker && (
          <div className="mb-3">
            <ColorPickerPopup
              color={displayColor}
              onChange={handleManualOverride}
              onClose={() => setShowColorPicker(false)}
              onReset={isOverridden ? () => onUpdate({ manualOverride: undefined }) : undefined}
            />
          </div>
        )}

        {/* Lightness/Contrast Override */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">
            {effectiveMethod === 'lightness' ? 'Lightness' : 'Contrast'}
            {(effectiveMethod === 'lightness' ? stop.lightnessOverride : stop.contrastOverride) === undefined
              ? ' (Default)' : ' (Override)'}
          </div>
          <div className="stop-override-controls">
            <RefBasedNumericInput
              value={effectiveMethod === 'lightness'
                ? (stop.lightnessOverride ?? defaultLightness)
                : (stop.contrastOverride ?? defaultContrast)}
              onChange={(val) => onUpdate(effectiveMethod === 'lightness'
                ? { lightnessOverride: val }
                : { contrastOverride: val }
              )}
              min={effectiveMethod === 'lightness' ? 0 : 1}
              max={effectiveMethod === 'lightness' ? 1 : 21}
              decimals={effectiveMethod === 'lightness' ? 2 : 1}
              className="stop-popup-input"
              style={{ width: '60px' }}
            />
            {(effectiveMethod === 'lightness' ? stop.lightnessOverride : stop.contrastOverride) !== undefined && (
              <button
                className="reset-icon-btn"
                onClick={() => onUpdate(effectiveMethod === 'lightness'
                  ? { lightnessOverride: undefined }
                  : { contrastOverride: undefined }
                )}
                title="Reset to default"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Reset Button */}
        <button onClick={handleResetToAuto} className="stop-popup-reset w-full mt-2">
          Reset to Auto
        </button>
      </div>
    </>
  );
}

// ============================================
// COLOR SETTINGS POPUP
// ============================================
interface ColorSettingsPopupProps {
  color: Color;
  globalSettings: GlobalSettings;
  position: { x: number; y: number };
  onUpdate: (color: Color) => void;
  onClose: () => void;
}

function ColorSettingsPopup({ color, globalSettings, position, onUpdate, onClose }: ColorSettingsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [showBasePicker, setShowBasePicker] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <>
      <div className="popup-backdrop" onClick={onClose} />
      <div
        ref={popupRef}
        className="color-settings-popup"
        style={{
          left: Math.min(position.x, window.innerWidth - 300),
          top: Math.min(position.y, window.innerHeight - 500),
        }}
      >
        <div className="stop-popup-header">
          <span className="stop-popup-title">{color.label} Settings</span>
          <span className="stop-popup-close" onClick={onClose}>×</span>
        </div>

        {/* Base Color */}
        <div className="stop-popup-section">
          <div className="color-field-row">
            <span className="color-field-label">Base Color</span>
            <div className="color-field-controls">
              <div
                className="color-field-swatch"
                style={{ backgroundColor: color.baseColor }}
                onClick={() => setShowBasePicker(!showBasePicker)}
              />
              <span className="color-field-hex">{color.baseColor.toUpperCase()}</span>
            </div>
          </div>
          {showBasePicker && (
            <div className="mt-2">
              <ColorPickerPopup
                color={color.baseColor}
                onChange={(hex) => onUpdate({ ...color, baseColor: hex })}
                onClose={() => setShowBasePicker(false)}
              />
            </div>
          )}
        </div>

        {/* Color Quality */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Color Quality</div>
          <div className="toggle-stack">
            <Toggle
              label="Preserve color identity"
              checked={color.preserveColorIdentity !== false}
              onChange={(val) => onUpdate({ ...color, preserveColorIdentity: val })}
              tooltip="Keeps visible color tint at light/dark extremes (may slightly miss contrast targets)"
            />
          </div>
        </div>

        {/* Corrections */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Corrections</div>
          <div className="toggle-stack">
            <Toggle
              label="Helmholtz-Kohlrausch"
              checked={color.hkCorrection ?? false}
              onChange={(val) => onUpdate({ ...color, hkCorrection: val })}
              tooltip="Compensates for saturated colors appearing brighter to the eye"
            />
            <Toggle
              label="Bezold-Brücke"
              checked={color.bbCorrection ?? false}
              onChange={(val) => onUpdate({ ...color, bbCorrection: val })}
              tooltip="Corrects for hue shifts that occur at different lightness levels"
            />
          </div>
        </div>

        {/* Hue Shift Curve */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Hue Shift Curve</div>
          <select
            className="chroma-curve-select"
            value={color.hueShiftCurve?.preset ?? 'none'}
            onChange={(e) => {
              const preset = e.target.value as HueShiftCurvePreset;
              if (preset === 'custom') {
                // Initialize custom with current preset values or defaults
                const current = color.hueShiftCurve?.preset && color.hueShiftCurve.preset !== 'custom'
                  ? HUE_SHIFT_CURVE_PRESETS[color.hueShiftCurve.preset]
                  : { light: 0, dark: 0 };
                onUpdate({
                  ...color,
                  hueShiftCurve: {
                    preset: 'custom',
                    lightShift: current.light,
                    darkShift: current.dark,
                  }
                });
              } else {
                onUpdate({ ...color, hueShiftCurve: { preset } });
              }
            }}
          >
            <option value="none">None (No shift)</option>
            <option value="subtle">Subtle (+4° / -5°)</option>
            <option value="natural">Natural (+8° / -10°)</option>
            <option value="dramatic">Dramatic (+12° / -15°)</option>
            <option value="vivid">Vivid (+12° / -15°, golden yellows)</option>
            <option value="custom">Custom</option>
          </select>

          {/* Curve Preview */}
          <div className="hue-shift-preview">
            {(() => {
              const preset = color.hueShiftCurve?.preset ?? 'none';
              const values = preset === 'custom'
                ? {
                    light: color.hueShiftCurve?.lightShift ?? 0,
                    dark: color.hueShiftCurve?.darkShift ?? 0
                  }
                : (preset === 'none' ? { light: 0, dark: 0 } : HUE_SHIFT_CURVE_PRESETS[preset]);
              return (
                <div className="hue-shift-indicator">
                  <span className="hue-shift-value light" title="Light stops shift">
                    Light: {values.light > 0 ? '+' : ''}{values.light}°
                  </span>
                  <span className="hue-shift-arrow">→ 0° →</span>
                  <span className="hue-shift-value dark" title="Dark stops shift">
                    Dark: {values.dark > 0 ? '+' : ''}{values.dark}°
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Custom Sliders */}
          {color.hueShiftCurve?.preset === 'custom' && (
            <div className="chroma-curve-sliders">
              <div className="chroma-slider-row">
                <span className="chroma-slider-label">Light</span>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={color.hueShiftCurve.lightShift ?? 0}
                  onChange={(e) => onUpdate({
                    ...color,
                    hueShiftCurve: { ...color.hueShiftCurve!, lightShift: parseInt(e.target.value) }
                  })}
                />
                <span className="chroma-slider-value">{color.hueShiftCurve.lightShift ?? 0}°</span>
              </div>
              <div className="chroma-slider-row">
                <span className="chroma-slider-label">Dark</span>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={color.hueShiftCurve.darkShift ?? 0}
                  onChange={(e) => onUpdate({
                    ...color,
                    hueShiftCurve: { ...color.hueShiftCurve!, darkShift: parseInt(e.target.value) }
                  })}
                />
                <span className="chroma-slider-value">{color.hueShiftCurve.darkShift ?? 0}°</span>
              </div>
            </div>
          )}
        </div>

        {/* Chroma Curve */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Chroma Curve</div>
          <select
            className="chroma-curve-select"
            value={color.chromaCurve?.preset ?? 'flat'}
            onChange={(e) => {
              const preset = e.target.value as ChromaCurvePreset;
              if (preset === 'custom') {
                // Initialize custom with current preset values or defaults
                const current = color.chromaCurve?.preset && color.chromaCurve.preset !== 'custom'
                  ? CHROMA_CURVE_PRESETS[color.chromaCurve.preset]
                  : { light: 100, mid: 100, dark: 100 };
                onUpdate({
                  ...color,
                  chromaCurve: {
                    preset: 'custom',
                    lightChroma: current.light,
                    midChroma: current.mid,
                    darkChroma: current.dark,
                  }
                });
              } else {
                onUpdate({ ...color, chromaCurve: { preset } });
              }
            }}
          >
            <option value="flat">Flat (Uniform)</option>
            <option value="bell">Bell (Natural)</option>
            <option value="pastel">Pastel (Soft lights)</option>
            <option value="jewel">Jewel (Vibrant mids)</option>
            <option value="linear-fade">Linear Fade (Rich darks)</option>
            <option value="custom">Custom</option>
          </select>

          {/* Curve Preview */}
          <div className="chroma-curve-preview">
            {(() => {
              const preset = color.chromaCurve?.preset ?? 'flat';
              const values = preset === 'custom'
                ? {
                    light: color.chromaCurve?.lightChroma ?? 100,
                    mid: color.chromaCurve?.midChroma ?? 100,
                    dark: color.chromaCurve?.darkChroma ?? 100
                  }
                : CHROMA_CURVE_PRESETS[preset];
              return (
                <>
                  <div className="chroma-bar" style={{ opacity: values.light / 100 }} title={`Light: ${values.light}%`} />
                  <div className="chroma-bar" style={{ opacity: values.mid / 100 }} title={`Mid: ${values.mid}%`} />
                  <div className="chroma-bar" style={{ opacity: values.dark / 100 }} title={`Dark: ${values.dark}%`} />
                </>
              );
            })()}
          </div>

          {/* Custom Sliders */}
          {color.chromaCurve?.preset === 'custom' && (
            <div className="chroma-curve-sliders">
              <div className="chroma-slider-row">
                <span className="chroma-slider-label">Light</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={color.chromaCurve.lightChroma ?? 100}
                  onChange={(e) => onUpdate({
                    ...color,
                    chromaCurve: { ...color.chromaCurve!, lightChroma: parseInt(e.target.value) }
                  })}
                />
                <span className="chroma-slider-value">{color.chromaCurve.lightChroma ?? 100}%</span>
              </div>
              <div className="chroma-slider-row">
                <span className="chroma-slider-label">Mid</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={color.chromaCurve.midChroma ?? 100}
                  onChange={(e) => onUpdate({
                    ...color,
                    chromaCurve: { ...color.chromaCurve!, midChroma: parseInt(e.target.value) }
                  })}
                />
                <span className="chroma-slider-value">{color.chromaCurve.midChroma ?? 100}%</span>
              </div>
              <div className="chroma-slider-row">
                <span className="chroma-slider-label">Dark</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={color.chromaCurve.darkChroma ?? 100}
                  onChange={(e) => onUpdate({
                    ...color,
                    chromaCurve: { ...color.chromaCurve!, darkChroma: parseInt(e.target.value) }
                  })}
                />
                <span className="chroma-slider-value">{color.chromaCurve.darkChroma ?? 100}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================
// COLOR ROW (Horizontal palette row)
// ============================================
interface ColorRowProps {
  color: Color;
  globalSettings: GlobalSettings;
  onUpdate: (color: Color) => void;
  onRemove: () => void;
}

function ColorRow({ color, globalSettings, onUpdate, onRemove }: ColorRowProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPosition, setSettingsPosition] = useState({ x: 0, y: 0 });
  const [selectedStop, setSelectedStop] = useState<{ index: number; position: { x: number; y: number } } | null>(null);
  const [showBaseColorPicker, setShowBaseColorPicker] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Generate palette
  const paletteResult = useMemo(() => {
    return generateColorPalette(color, globalSettings);
  }, [color, globalSettings]);

  // Method is now global-only (no per-color override)
  const effectiveMethod = globalSettings.method;

  const handleStopClick = (index: number, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setShowSettings(false); // Close settings if open
    setSelectedStop({
      index,
      position: { x: rect.left, y: rect.bottom + 8 },
    });
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setSelectedStop(null); // Close color picker if open
    setSettingsPosition({ x: rect.left - 200, y: rect.bottom + 8 });
    setShowSettings(true);
  };

  const handleUpdateStop = (stopIndex: number, updates: Partial<Stop>) => {
    const newStops = [...color.stops];
    newStops[stopIndex] = { ...newStops[stopIndex], ...updates };
    onUpdate({ ...color, stops: newStops });
  };

  return (
    <div className="color-row">
      {/* Header: Name + Base Color + Actions */}
      <div className="color-row-header">
        <input
          type="text"
          value={color.label}
          onChange={(e) => onUpdate({ ...color, label: e.target.value })}
          className="color-row-name"
        />
        <div className="color-row-right">
          <span className="base-color-label">Base color:</span>
          <div
            className="base-color-swatch clickable"
            style={{ backgroundColor: color.baseColor }}
            title={`Base: ${color.baseColor} (click to edit)`}
            onClick={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              setShowBaseColorPicker({ x: rect.left, y: rect.bottom + 8 });
            }}
          />
          <input
            type="text"
            value={color.baseColor.toUpperCase()}
            onChange={(e) => {
              let val = e.target.value;
              if (!val.startsWith('#')) val = '#' + val;
              if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                onUpdate({ ...color, baseColor: val.toLowerCase() });
              }
            }}
            className="base-color-hex"
          />
          <div className="color-row-actions">
            <button onClick={handleSettingsClick}>settings</button>
            <button className="delete" onClick={() => setShowDeleteConfirm(true)}>delete</button>
          </div>
        </div>
      </div>

      {/* Duplicate warning */}
      {paletteResult.hadDuplicates && (
        <div className="warning-banner mb-2">
          Some colors were auto-adjusted for uniqueness.
        </div>
      )}

      {/* Stop Strip */}
      <div className="stop-strip">
        {color.stops.map((stop, i) => {
          const generatedStop = paletteResult.stops[i];
          const displayColor = stop.manualOverride
            ? oklchToHex(stop.manualOverride)
            : generatedStop?.hex ?? '#808080';
          const contrastRatio = getContrastRatio(displayColor, globalSettings.backgroundColor);
          const hasOverride = !!stop.manualOverride ||
            stop.lightnessOverride !== undefined ||
            stop.contrastOverride !== undefined;

          const isNudged = generatedStop?.wasNudged && !stop.manualOverride;
          const isTooSimilar = generatedStop?.tooSimilar && !stop.manualOverride;

          return (
            <div
              key={stop.number}
              className="stop-strip-item"
              onClick={(e) => handleStopClick(i, e)}
            >
              <span className="stop-strip-number">{stop.number}</span>
              <div
                className={`stop-strip-swatch ${hasOverride ? 'has-override' : ''} ${isNudged ? 'was-nudged' : ''} ${isTooSimilar ? 'too-similar' : ''}`}
                style={{ backgroundColor: displayColor }}
                title={isTooSimilar ? `Very similar to previous stop (ΔE=${generatedStop?.deltaE?.toFixed(1)})` : undefined}
              >
                {isTooSimilar && (
                  <span className="similarity-warning" title={`ΔE=${generatedStop?.deltaE?.toFixed(1)} - may look identical`}>
                    ⚠
                  </span>
                )}
              </div>
              <span className="stop-strip-hex">
                {displayColor.slice(1, 7).toUpperCase()}
              </span>
              <span className="stop-strip-contrast">{contrastRatio.toFixed(2)}:1</span>
            </div>
          );
        })}
      </div>

      {/* Color Picker (one-click) */}
      {selectedStop && (() => {
        const stop = color.stops[selectedStop.index];
        const displayColor = stop.manualOverride
          ? oklchToHex(stop.manualOverride)
          : paletteResult.stops[selectedStop.index]?.hex ?? '#808080';
        const hasManualOverride = !!stop.manualOverride;

        const handleColorChange = (hex: string) => {
          const oklch = hexToOklch(hex);
          handleUpdateStop(selectedStop.index, { manualOverride: oklch });
        };

        const handleReset = () => {
          handleUpdateStop(selectedStop.index, { manualOverride: undefined });
        };

        // Calculate position that stays within viewport
        const popupWidth = 280;
        const popupHeight = 380;
        const constrainedLeft = Math.max(8, Math.min(selectedStop.position.x, window.innerWidth - popupWidth - 8));
        const constrainedTop = Math.max(8, Math.min(selectedStop.position.y, window.innerHeight - popupHeight - 8));

        return (
          <>
            <div className="popup-backdrop" onClick={() => setSelectedStop(null)} />
            <div
              className="stop-color-picker"
              style={{
                position: 'fixed',
                left: constrainedLeft,
                top: constrainedTop,
                zIndex: 1000,
              }}
            >
              <ColorPickerPopup
                color={displayColor}
                onChange={handleColorChange}
                onClose={() => setSelectedStop(null)}
                onReset={hasManualOverride ? handleReset : undefined}
              />
            </div>
          </>
        );
      })()}

      {/* Color Settings Popup */}
      {showSettings && (
        <ColorSettingsPopup
          color={color}
          globalSettings={globalSettings}
          position={settingsPosition}
          onUpdate={onUpdate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Base Color Picker */}
      {showBaseColorPicker && (() => {
        // Calculate position that stays within viewport
        const popupWidth = 280;
        const popupHeight = 380;
        const constrainedLeft = Math.max(8, Math.min(showBaseColorPicker.x, window.innerWidth - popupWidth - 8));
        const constrainedTop = Math.max(8, Math.min(showBaseColorPicker.y, window.innerHeight - popupHeight - 8));

        return (
          <>
            <div className="popup-backdrop" onClick={() => setShowBaseColorPicker(null)} />
            <div
              className="base-color-picker-popup"
              style={{
                position: 'fixed',
                left: constrainedLeft,
                top: constrainedTop,
                zIndex: 1000,
              }}
            >
              <ColorPickerPopup
                color={color.baseColor}
                onChange={(hex) => onUpdate({ ...color, baseColor: hex })}
                onClose={() => setShowBaseColorPicker(null)}
              />
            </div>
          </>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Color"
          message={`Are you sure you want to delete "${color.label}"?`}
          onConfirm={() => {
            onRemove();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

// ============================================
// LEFT PANEL
// ============================================
interface LeftPanelProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function LeftPanel({ settings, onUpdate, onExport, onUndo, onRedo, canUndo, canRedo }: LeftPanelProps) {
  const [showBgPicker, setShowBgPicker] = useState(false);

  return (
    <div className="left-panel">
      {/* Undo/Redo Buttons */}
      <div className="undo-redo-row">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="undo-redo-btn"
          title="Undo (Cmd+Z)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10h10a5 5 0 0 1 0 10H9" />
            <path d="M3 10l4-4" />
            <path d="M3 10l4 4" />
          </svg>
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="undo-redo-btn"
          title="Redo (Cmd+Shift+Z)"
        >
          Redo
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10H11a5 5 0 0 0 0 10h4" />
            <path d="M21 10l-4-4" />
            <path d="M21 10l-4 4" />
          </svg>
        </button>
      </div>
      {/* Background Color */}
      <div className="bg-color-section">
        <div className="color-field-row">
          <span className="color-field-label">Bg color</span>
          <div className="color-field-controls">
            <div
              className="color-field-swatch"
              style={{ backgroundColor: settings.backgroundColor }}
              onClick={() => setShowBgPicker(!showBgPicker)}
            />
            <input
              type="text"
              value={settings.backgroundColor}
              onChange={(e) => {
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                  onUpdate({ ...settings, backgroundColor: e.target.value });
                }
              }}
              className="color-field-hex"
            />
          </div>
        </div>
        {showBgPicker && (
          <>
            <div className="popup-backdrop" onClick={() => setShowBgPicker(false)} />
            <div className="bg-color-picker-popup">
              <ColorPickerPopup
                color={settings.backgroundColor}
                onChange={(hex) => onUpdate({ ...settings, backgroundColor: hex })}
                onClose={() => setShowBgPicker(false)}
              />
            </div>
          </>
        )}
      </div>

      {/* Defaults Table */}
      <DefaultsTable settings={settings} onUpdate={onUpdate} />

      {/* Export Button */}
      <button onClick={onExport} className="export-btn">
        export
      </button>
    </div>
  );
}

// ============================================
// RESIZE HANDLE (for resizable plugin window)
// ============================================
function ResizeHandle() {
  const handleRef = useRef<SVGSVGElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    const handle = handleRef.current;
    if (!handle) return;

    handle.setPointerCapture(e.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const width = Math.max(300, Math.floor(moveEvent.clientX + 5));
      const height = Math.max(200, Math.floor(moveEvent.clientY + 5));
      parent.postMessage(
        { pluginMessage: { type: 'resize', width, height } },
        '*'
      );
    };

    const onPointerUp = () => {
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
    };

    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
  };

  return (
    <svg
      ref={handleRef}
      className="resize-handle"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      onPointerDown={handlePointerDown}
    >
      <path d="M16 0V16H0L16 0Z" fill="var(--figma-color-bg, white)" />
      <path d="M6.22577 16H3L16 3V6.22576L6.22577 16Z" fill="var(--figma-color-border, #8C8C8C)" />
      <path d="M11.8602 16H8.63441L16 8.63441V11.8602L11.8602 16Z" fill="var(--figma-color-border, #8C8C8C)" />
    </svg>
  );
}

// ============================================
// MAIN APP
// ============================================
function App() {
  // Use history hook for undo/redo support
  const initialState: AppState = {
    globalSettings: createDefaultGlobalSettings(),
    colors: [],
  };
  const { state, setState, replaceState, undo, redo, canUndo, canRedo } = useHistory(initialState);
  const { globalSettings, colors } = state;

  // Track whether we've received the initial load response
  // This prevents auto-save from overwriting saved data before it's loaded
  const hasLoadedRef = useRef(false);

  // Request saved state when component mounts (request/response pattern)
  // This avoids the race condition where the plugin sends data before React mounts
  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'request-state' } }, '*');
  }, []);

  // Listen for messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'plugin-ready') {
        console.log('Plugin ready');
      }

      // Handle load-state response - mark as loaded whether data exists or not
      if (msg.type === 'load-state') {
        hasLoadedRef.current = true;
        if (msg.state) {
          replaceState(msg.state);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [replaceState]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Auto-save state to document storage (debounced)
  // Only save after initial load completes to prevent overwriting saved data
  useEffect(() => {
    if (!hasLoadedRef.current) return;  // Don't save until we've received load response

    const timer = setTimeout(() => {
      parent.postMessage({ pluginMessage: { type: 'save-state', state } }, '*');
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  const setGlobalSettings = useCallback((newSettings: GlobalSettings) => {
    setState({ globalSettings: newSettings, colors });
  }, [setState, colors]);

  const addColor = () => {
    const id = `color-${Date.now()}`;
    const label = `Color ${colors.length + 1}`;
    const baseColor = '#0066CC';
    setState({ globalSettings, colors: [...colors, createDefaultColor(id, label, baseColor)] });
  };

  const updateColor = (index: number, updatedColor: Color) => {
    const newColors = [...colors];
    newColors[index] = updatedColor;
    setState({ globalSettings, colors: newColors });
  };

  const removeColor = (index: number) => {
    setState({ globalSettings, colors: colors.filter((_, i) => i !== index) });
  };

  const createVariables = () => {
    parent.postMessage(
      {
        pluginMessage: {
          type: 'create-variables',
          colors,
          globalSettings,
        },
      },
      '*'
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Main Layout */}
      <div className="app-layout">
        {/* Left Panel */}
        <LeftPanel
          settings={globalSettings}
          onUpdate={setGlobalSettings}
          onExport={createVariables}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Right Panel */}
        <div className="right-panel">
          {colors.length === 0 ? (
            <p className="empty-state p-4">No colors yet. Add one to get started.</p>
          ) : (
            colors.map((color, i) => (
              <ColorRow
                key={color.id}
                color={color}
                globalSettings={globalSettings}
                onUpdate={(c) => updateColor(i, c)}
                onRemove={() => removeColor(i)}
              />
            ))
          )}

          {/* Add Color Button */}
          <button onClick={addColor} className="add-color-btn">
            + Add Color
          </button>
        </div>
      </div>

      {/* Resize handle for plugin window */}
      <ResizeHandle />
    </div>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
