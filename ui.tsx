import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  createDefaultColor,
  createDefaultGlobalSettings,
  DEFAULT_STOPS,
} from './lib/types';

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
  OKLCH,
  HueShiftDirection,
  ChromaShiftDirection,
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
        {(['hsb', 'oklch', 'hex'] as const).map((tab) => (
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

      <button
        onClick={() => parent.postMessage({ pluginMessage: { type: 'get-selection-color' } }, '*')}
        className="btn btn-full mt-2"
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

      {onReset && (
        <Button
          onClick={() => {
            onReset();
            onClose();
          }}
          isSecondary
          className="mt-3 w-full"
        >
          Reset to Auto
        </Button>
      )}
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
  const [activeTab, setActiveTab] = useState<'lightness' | 'contrast'>('lightness');
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

  return (
    <div className="defaults-section">
      {/* Tab switcher */}
      <div className="defaults-tabs">
        <button
          className={`defaults-tab ${activeTab === 'lightness' ? 'active' : ''}`}
          onClick={() => setActiveTab('lightness')}
        >
          Lightness
        </button>
        <button
          className={`defaults-tab ${activeTab === 'contrast' ? 'active' : ''}`}
          onClick={() => setActiveTab('contrast')}
        >
          Contrast
        </button>
      </div>

      {/* Table */}
      <table className="defaults-table">
        <thead>
          <tr>
            <th className="stop-col">stop</th>
            <th className="value-col">{activeTab === 'lightness' ? 'L' : 'C'}</th>
          </tr>
        </thead>
        <tbody>
          {stopNumbers.map((num) => (
            <tr key={num}>
              <td className="stop-col">{num}</td>
              <td className="value-col">
                {activeTab === 'lightness' ? (
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
                ) : (
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
                )}
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
  effectiveMode: 'lightness' | 'contrast';
  defaultLightness: number;
  defaultContrast: number;
  colorHueShift: number;
  colorSaturationShift: number;
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
  effectiveMode,
  defaultLightness,
  defaultContrast,
  colorHueShift,
  colorSaturationShift,
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
      hueShiftOverride: undefined,
      saturationShiftOverride: undefined,
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
              {wasNudged && !isOverridden && <span className="nudge-indicator">~</span>}
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
            {effectiveMode === 'lightness' ? 'Lightness Override' : 'Contrast Override'}
          </div>
          <div className="stop-popup-input-row">
            <select
              value={
                (effectiveMode === 'lightness' ? stop.lightnessOverride : stop.contrastOverride) === undefined
                  ? 'default'
                  : 'custom'
              }
              onChange={(e) => {
                if (e.target.value === 'default') {
                  onUpdate(effectiveMode === 'lightness'
                    ? { lightnessOverride: undefined }
                    : { contrastOverride: undefined }
                  );
                } else {
                  onUpdate(effectiveMode === 'lightness'
                    ? { lightnessOverride: defaultLightness }
                    : { contrastOverride: defaultContrast }
                  );
                }
              }}
              className="stop-popup-input"
              style={{ flex: 'none', width: '90px' }}
            >
              <option value="default">Default</option>
              <option value="custom">Custom</option>
            </select>
            {effectiveMode === 'lightness' && stop.lightnessOverride !== undefined && (
              <RefBasedNumericInput
                value={stop.lightnessOverride}
                onChange={(val) => onUpdate({ lightnessOverride: val })}
                min={0}
                max={1}
                decimals={2}
                className="stop-popup-input"
                style={{ width: '60px' }}
              />
            )}
            {effectiveMode === 'contrast' && stop.contrastOverride !== undefined && (
              <RefBasedNumericInput
                value={stop.contrastOverride}
                onChange={(val) => onUpdate({ contrastOverride: val })}
                min={1}
                max={21}
                decimals={1}
                className="stop-popup-input"
                style={{ width: '60px' }}
              />
            )}
          </div>
        </div>

        {/* Hue Shift Override */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Hue Shift Override</div>
          <div className="stop-popup-input-row">
            <select
              value={stop.hueShiftOverride === undefined ? 'default' : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'default') {
                  onUpdate({ hueShiftOverride: undefined });
                } else {
                  onUpdate({ hueShiftOverride: colorHueShift });
                }
              }}
              className="stop-popup-input"
              style={{ flex: 'none', width: '90px' }}
            >
              <option value="default">Default ({colorHueShift})</option>
              <option value="custom">Custom</option>
            </select>
            {stop.hueShiftOverride !== undefined && (
              <>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stop.hueShiftOverride}
                  onChange={(e) => onUpdate({ hueShiftOverride: parseInt(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '10px', minWidth: '24px' }}>{stop.hueShiftOverride}</span>
              </>
            )}
          </div>
        </div>

        {/* Saturation Shift Override */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Saturation Shift Override</div>
          <div className="stop-popup-input-row">
            <select
              value={stop.saturationShiftOverride === undefined ? 'default' : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'default') {
                  onUpdate({ saturationShiftOverride: undefined });
                } else {
                  onUpdate({ saturationShiftOverride: colorSaturationShift });
                }
              }}
              className="stop-popup-input"
              style={{ flex: 'none', width: '90px' }}
            >
              <option value="default">Default ({colorSaturationShift})</option>
              <option value="custom">Custom</option>
            </select>
            {stop.saturationShiftOverride !== undefined && (
              <>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stop.saturationShiftOverride}
                  onChange={(e) => onUpdate({ saturationShiftOverride: parseInt(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '10px', minWidth: '24px' }}>{stop.saturationShiftOverride}</span>
              </>
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
          <div className="stop-popup-label">Base Color</div>
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 32,
                height: 32,
                backgroundColor: color.baseColor,
                borderRadius: 4,
                border: '1px solid var(--figma-color-border)',
                cursor: 'pointer',
              }}
              onClick={() => setShowBasePicker(!showBasePicker)}
            />
            <span className="font-mono text-sm">{color.baseColor.toUpperCase()}</span>
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

        {/* Mode Override */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Mode</div>
          <select
            value={color.modeOverride ?? 'global'}
            onChange={(e) => {
              const val = e.target.value;
              onUpdate({
                ...color,
                modeOverride: val === 'global' ? undefined : val as 'lightness' | 'contrast',
              });
            }}
            className="stop-popup-input w-full"
          >
            <option value="global">Use Global ({globalSettings.mode})</option>
            <option value="lightness">Lightness</option>
            <option value="contrast">Contrast</option>
          </select>
        </div>

        {/* Corrections */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Corrections</div>
          <div className="flex gap-3">
            <label className="checkbox-label">
              <select
                value={color.hkCorrectionOverride === undefined ? 'global' : color.hkCorrectionOverride ? 'on' : 'off'}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdate({
                    ...color,
                    hkCorrectionOverride: val === 'global' ? undefined : val === 'on',
                  });
                }}
                className="stop-popup-input"
                style={{ width: '80px' }}
              >
                <option value="global">HK: Global</option>
                <option value="on">HK: On</option>
                <option value="off">HK: Off</option>
              </select>
            </label>
            <label className="checkbox-label">
              <select
                value={color.bbCorrectionOverride === undefined ? 'global' : color.bbCorrectionOverride ? 'on' : 'off'}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdate({
                    ...color,
                    bbCorrectionOverride: val === 'global' ? undefined : val === 'on',
                  });
                }}
                className="stop-popup-input"
                style={{ width: '80px' }}
              >
                <option value="global">BB: Global</option>
                <option value="on">BB: On</option>
                <option value="off">BB: Off</option>
              </select>
            </label>
          </div>
        </div>

        {/* L Expansion Override */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">L Expansion Override</div>
          <div className="flex items-center gap-2">
            <select
              value={color.lightnessExpansionOverride === undefined ? 'global' : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'global') {
                  onUpdate({ ...color, lightnessExpansionOverride: undefined });
                } else {
                  onUpdate({ ...color, lightnessExpansionOverride: globalSettings.lightnessExpansion });
                }
              }}
              className="stop-popup-input"
              style={{ width: '90px' }}
            >
              <option value="global">Global</option>
              <option value="custom">Custom</option>
            </select>
            {color.lightnessExpansionOverride !== undefined && (
              <RefBasedNumericInput
                value={color.lightnessExpansionOverride}
                onChange={(val) => onUpdate({ ...color, lightnessExpansionOverride: val })}
                min={0.5}
                max={2}
                decimals={2}
                className="stop-popup-input"
                style={{ width: '60px' }}
              />
            )}
          </div>
        </div>

        {/* Hue Shift */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Hue Shift: {color.hueShift ?? 0}</div>
          <input
            type="range"
            min="0"
            max="100"
            value={color.hueShift ?? 0}
            onChange={(e) => onUpdate({ ...color, hueShift: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex gap-2 mt-1">
            <label className="radio-label text-xs">
              <input
                type="radio"
                checked={(color.hueShiftDirection ?? 'warm-cool') === 'warm-cool'}
                onChange={() => onUpdate({ ...color, hueShiftDirection: 'warm-cool' })}
              />
              Warm→Cool
            </label>
            <label className="radio-label text-xs">
              <input
                type="radio"
                checked={color.hueShiftDirection === 'cool-warm'}
                onChange={() => onUpdate({ ...color, hueShiftDirection: 'cool-warm' })}
              />
              Cool→Warm
            </label>
          </div>
        </div>

        {/* Saturation Shift */}
        <div className="stop-popup-section">
          <div className="stop-popup-label">Saturation Shift: {color.saturationShift ?? 0}</div>
          <input
            type="range"
            min="0"
            max="100"
            value={color.saturationShift ?? 0}
            onChange={(e) => onUpdate({ ...color, saturationShift: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex gap-2 mt-1">
            <label className="radio-label text-xs">
              <input
                type="radio"
                checked={(color.saturationShiftDirection ?? 'vivid-muted') === 'vivid-muted'}
                onChange={() => onUpdate({ ...color, saturationShiftDirection: 'vivid-muted' })}
              />
              Vivid→Muted
            </label>
            <label className="radio-label text-xs">
              <input
                type="radio"
                checked={color.saturationShiftDirection === 'muted-vivid'}
                onChange={() => onUpdate({ ...color, saturationShiftDirection: 'muted-vivid' })}
              />
              Muted→Vivid
            </label>
          </div>
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

  // Generate palette
  const paletteResult = useMemo(() => {
    return generateColorPalette(color, globalSettings);
  }, [color, globalSettings]);

  const effectiveMode = color.modeOverride ?? globalSettings.mode;

  const handleStopClick = (index: number, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setSelectedStop({
      index,
      position: { x: rect.left, y: rect.bottom + 8 },
    });
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
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
      {/* Header */}
      <div className="color-row-header">
        <div className="color-row-label">
          <input
            type="text"
            value={color.label}
            onChange={(e) => onUpdate({ ...color, label: e.target.value })}
          />
          <span className="edit-icon">✏️</span>
        </div>
        <div className="color-row-actions">
          <button onClick={handleSettingsClick}>settings</button>
          <button className="delete" onClick={onRemove}>delete</button>
        </div>
      </div>

      {/* Duplicate warning */}
      {paletteResult.hadDuplicates && (
        <div className="warning-banner mb-2">
          Some colors were auto-adjusted (~) for uniqueness.
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
            stop.contrastOverride !== undefined ||
            stop.hueShiftOverride !== undefined ||
            stop.saturationShiftOverride !== undefined;

          return (
            <div
              key={stop.number}
              className="stop-strip-item"
              onClick={(e) => handleStopClick(i, e)}
            >
              <span className="stop-strip-number">{stop.number}</span>
              <div
                className={`stop-strip-swatch ${hasOverride ? 'has-override' : ''}`}
                style={{ backgroundColor: displayColor }}
              />
              <span className="stop-strip-hex">
                {displayColor.slice(1, 5).toUpperCase()}
                {generatedStop?.wasNudged && !stop.manualOverride && '~'}
              </span>
              <span className="stop-strip-contrast">{contrastRatio.toFixed(2)}:1</span>
            </div>
          );
        })}
      </div>

      {/* Stop Popup */}
      {selectedStop && (
        <StopPopup
          stop={color.stops[selectedStop.index]}
          stopNumber={color.stops[selectedStop.index].number}
          generatedColor={paletteResult.stops[selectedStop.index]?.hex ?? '#808080'}
          wasNudged={paletteResult.stops[selectedStop.index]?.wasNudged ?? false}
          effectiveMode={effectiveMode}
          defaultLightness={globalSettings.defaultLightness[color.stops[selectedStop.index].number] ?? 0.5}
          defaultContrast={globalSettings.defaultContrast[color.stops[selectedStop.index].number] ?? 4.5}
          colorHueShift={color.hueShift ?? 0}
          colorSaturationShift={color.saturationShift ?? 0}
          backgroundColor={globalSettings.backgroundColor}
          position={selectedStop.position}
          onUpdate={(updates) => handleUpdateStop(selectedStop.index, updates)}
          onClose={() => setSelectedStop(null)}
        />
      )}

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
}

function LeftPanel({ settings, onUpdate, onExport }: LeftPanelProps) {
  const [showBgPicker, setShowBgPicker] = useState(false);

  return (
    <div className="left-panel">
      {/* Background Color */}
      <div className="bg-color-section">
        <div className="bg-color-row">
          <span className="bg-color-label">Bg color</span>
          <div
            className="bg-color-swatch"
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
            className="bg-color-hex"
          />
        </div>
        {showBgPicker && (
          <div className="relative">
            <ColorPickerPopup
              color={settings.backgroundColor}
              onChange={(hex) => onUpdate({ ...settings, backgroundColor: hex })}
              onClose={() => setShowBgPicker(false)}
            />
          </div>
        )}
      </div>

      {/* Defaults Table */}
      <DefaultsTable settings={settings} onUpdate={onUpdate} />

      {/* Global Settings */}
      <div className="global-settings-section">
        <div className="section-title">Global settings</div>
        <div className="toggle-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.hkCorrection}
              onChange={(e) => onUpdate({ ...settings, hkCorrection: e.target.checked })}
            />
            <span className="text-sm">HK</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.bbCorrection}
              onChange={(e) => onUpdate({ ...settings, bbCorrection: e.target.checked })}
            />
            <span className="text-sm">BB</span>
          </label>
        </div>
      </div>

      {/* L Expansion */}
      <div className="expansion-slider-row">
        <div className="expansion-label">
          <span>L expansion</span>
          <span className="expansion-value">
            {settings.lightnessExpansion < 0.95 ? 'Compress' : settings.lightnessExpansion > 1.05 ? 'Spread' : 'Normal'}
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.05"
          value={settings.lightnessExpansion}
          onChange={(e) => onUpdate({ ...settings, lightnessExpansion: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

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
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(
    createDefaultGlobalSettings()
  );
  const [colors, setColors] = useState<Color[]>([]);

  // Listen for messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'plugin-ready') {
        console.log('Plugin ready');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const addColor = () => {
    const id = `color-${Date.now()}`;
    const label = `Color ${colors.length + 1}`;
    const baseColor = '#0066CC';
    setColors([...colors, createDefaultColor(id, label, baseColor)]);
  };

  const updateColor = (index: number, updatedColor: Color) => {
    const newColors = [...colors];
    newColors[index] = updatedColor;
    setColors(newColors);
  };

  const removeColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index));
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

  const handleClose = () => {
    parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div className="app-header">
        <span className="app-header-title">Octarine</span>
        <span className="app-header-close" onClick={handleClose}>×</span>
      </div>

      {/* Main Layout */}
      <div className="app-layout">
        {/* Left Panel */}
        <LeftPanel
          settings={globalSettings}
          onUpdate={setGlobalSettings}
          onExport={createVariables}
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
