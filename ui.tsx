import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import 'react-figma-plugin-ds/figma-plugin-ds.css';
import './styles.css';

import {
  Color,
  GlobalSettings,
  GroupSettings,
  GlobalConfig,
  EffectiveSettings,
  ColorGroup,
  Stop,
  GeneratedStop,
  PaletteResult,
  AppState,
  createDefaultColor,
  createDefaultGroupSettings,
  createDefaultGlobalConfig,
  createDefaultGroup,
  createInitialAppState,
  migrateState,
  DEFAULT_STOPS,
  ChromaCurve,
  ChromaCurvePreset,
  CHROMA_CURVE_PRESETS,
  HueShiftCurve,
  HueShiftCurvePreset,
  HUE_SHIFT_CURVE_PRESETS,
} from './lib/types';

import { Toggle, ConfirmModal, RefBasedNumericInput, MethodToggle } from './components/primitives';

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
  getYellowEquivalentShifts,
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
  const [activeTab, setActiveTab] = useState<'oklch' | 'hsb'>('hsb');
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
        {(['hsb', 'oklch'] as const).map((tab) => (
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
        {activeTab === 'oklch' && (
          <>
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
            <div className="picker-swatch-hex-row">
              <div className="picker-swatch" style={{ backgroundColor: hex }} />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onBlur={() => applyHex(hexInput)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyHex(hexInput); }}
                placeholder="#000000"
                className="picker-hex-input"
              />
            </div>
          </>
        )}

        {activeTab === 'hsb' && (
          <>
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
            <div className="picker-swatch-hex-row">
              <div className="picker-swatch" style={{ backgroundColor: hex }} />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onBlur={() => applyHex(hexInput)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyHex(hexInput); }}
                placeholder="#000000"
                className="picker-hex-input"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ============================================
// GROUP ACCORDION ITEM (Collapsed/Expanded group in left panel)
// ============================================
interface GroupAccordionItemProps {
  group: ColorGroup;
  backgroundColor: string;  // Global background color for color strip display
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (group: ColorGroup) => void;
  onDelete: () => void;
  canDelete: boolean;
}

function GroupAccordionItem({
  group,
  backgroundColor,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  canDelete
}: GroupAccordionItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSettingsChange = (newSettings: GroupSettings) => {
    onUpdate({ ...group, settings: newSettings });
  };

  // Generate palette for each color to get base colors for strip
  const colorStripData = useMemo(() => {
    return group.colors.map(color => ({
      id: color.id,
      baseColor: color.baseColor,
      label: color.label
    }));
  }, [group.colors]);

  // Color strip component - used in both collapsed and expanded states
  const ColorStrip = () => (
    <div className="group-color-strip" onClick={onToggle}>
      {colorStripData.length === 0 ? (
        <div className="group-color-strip-empty">No colors</div>
      ) : (
        colorStripData.map(color => (
          <div
            key={color.id}
            className="group-color-segment"
            style={{ backgroundColor: color.baseColor }}
            title={color.label}
          />
        ))
      )}
    </div>
  );

  // Collapsed view: just the color strip with delete button overlay
  if (!isExpanded) {
    return (
      <div className="group-accordion-item collapsed">
        <div className="group-strip-container">
          <ColorStrip />
          {canDelete && (
            <button
              className="group-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              title="Delete group"
            >
              ×
            </button>
          )}
        </div>
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <ConfirmModal
            title="Delete Group"
            message={`Delete "${group.name || 'Untitled Group'}"? This will delete all ${group.colors.length} color(s) in this group.`}
            onConfirm={() => {
              onDelete();
              setShowDeleteConfirm(false);
            }}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
      </div>
    );
  }

  // Expanded view: color strip + separator + content
  return (
    <div className="group-accordion-item expanded">
      {/* Color strip header with delete button overlay */}
      <div className="group-strip-container">
        <ColorStrip />
        {canDelete && (
          <button
            className="group-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            title="Delete group"
          >
            ×
          </button>
        )}
      </div>

      {/* Separator line */}
      <div className="group-accordion-separator" />

      {/* Expanded content: settings only */}
      <div className="group-accordion-content">
        {/* Defaults Table (includes Method Toggle) */}
        <DefaultsTable
          settings={group.settings}
          onUpdate={handleSettingsChange}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Group"
          message={`Delete "${group.name || 'Untitled Group'}"? This will delete all ${group.colors.length} color(s) in this group.`}
          onConfirm={() => {
            onDelete();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
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
  globalSettings: EffectiveSettings;
  position: { x: number; y: number };
  onUpdate: (color: Color) => void;
  onClose: () => void;
}

function ColorSettingsPopup({ color, globalSettings, position, onUpdate, onClose }: ColorSettingsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const baseSwatchRef = useRef<HTMLDivElement>(null);
  const [showBasePicker, setShowBasePicker] = useState(false);
  const [pickerOpenUpward, setPickerOpenUpward] = useState(false);
  const [baseHexInput, setBaseHexInput] = useState(color.baseColor);

  // Keep input in sync when baseColor changes externally
  useEffect(() => {
    setBaseHexInput(color.baseColor);
  }, [color.baseColor]);

  const expandHexShorthand = (hex: string): string => {
    const h = hex.replace('#', '');
    if (h.length === 1) return '#' + h.repeat(6);
    if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
    return hex;
  };

  const applyBaseHex = (newHex: string) => {
    const expanded = expandHexShorthand(newHex);
    if (/^#[0-9A-Fa-f]{6}$/.test(expanded)) {
      setBaseHexInput(expanded.toUpperCase());
      onUpdate({ ...color, baseColor: expanded.toUpperCase() });
    } else {
      setBaseHexInput(color.baseColor);
    }
  };

  const handleBaseSwatchClick = () => {
    if (!baseSwatchRef.current) {
      setShowBasePicker(!showBasePicker);
      return;
    }

    // Calculate if there's enough space below for the picker (~380px)
    const rect = baseSwatchRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const pickerHeight = 380;

    setPickerOpenUpward(spaceBelow < pickerHeight);
    setShowBasePicker(!showBasePicker);
  };

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
        <div className="stop-popup-section" style={{ position: 'relative' }}>
          <div className="color-field-row">
            <span className="color-field-label">Base color</span>
            <div className="color-field-controls">
              <div
                ref={baseSwatchRef}
                className="color-field-swatch"
                style={{ backgroundColor: color.baseColor }}
                onClick={handleBaseSwatchClick}
              />
              <input
                type="text"
                className="color-field-hex"
                value={baseHexInput.toUpperCase()}
                onChange={(e) => setBaseHexInput(e.target.value)}
                onBlur={(e) => applyBaseHex(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyBaseHex((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
          </div>
          {showBasePicker && (
            <div
              className={pickerOpenUpward ? 'picker-upward' : 'mt-2'}
              style={pickerOpenUpward ? {
                position: 'absolute',
                bottom: '100%',
                left: 0,
                marginBottom: '8px',
                zIndex: 10
              } : undefined}
            >
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
                // Check if this is a yellow color - use calculated yellow shifts
                const baseOklch = hexToOklch(color.baseColor);
                const yellowShifts = getYellowEquivalentShifts(baseOklch.h);

                // Use yellow-calculated values if yellow, otherwise use preset values
                const current = yellowShifts
                  ? yellowShifts
                  : (color.hueShiftCurve?.preset && color.hueShiftCurve.preset !== 'custom'
                      ? HUE_SHIFT_CURVE_PRESETS[color.hueShiftCurve.preset]
                      : { light: 0, dark: 0 });

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
            <option value="none">None</option>
            <option value="subtle">Subtle</option>
            <option value="natural">Natural</option>
            <option value="dramatic">Dramatic</option>
            <option value="custom">Custom</option>
          </select>

          {/* Visual Curve Preview - shows actual shifted colors */}
          <div className="hue-shift-visual-preview">
            {(() => {
              const preset = color.hueShiftCurve?.preset ?? 'none';
              const values = preset === 'custom'
                ? {
                    light: color.hueShiftCurve?.lightShift ?? 0,
                    dark: color.hueShiftCurve?.darkShift ?? 0
                  }
                : (preset === 'none' ? { light: 0, dark: 0 } : HUE_SHIFT_CURVE_PRESETS[preset]);

              // Get base color's OKLCH
              const baseOklch = hexToOklch(color.baseColor);

              // Calculate shifted colors at different lightness levels
              const lightL = 0.85;
              const midL = 0.55;
              const darkL = 0.25;

              // Light: shift toward cyan (positive)
              const lightHue = (baseOklch.h + values.light + 360) % 360;
              const lightColor = oklchToHex({ l: lightL, c: baseOklch.c * 0.6, h: lightHue });

              // Mid: no shift
              const midColor = oklchToHex({ l: midL, c: baseOklch.c, h: baseOklch.h });

              // Dark: shift toward purple (negative)
              const darkHue = (baseOklch.h + values.dark + 360) % 360;
              const darkColor = oklchToHex({ l: darkL, c: baseOklch.c * 0.8, h: darkHue });

              return (
                <>
                  <div className="hue-bar" style={{ background: lightColor }} title={`Light: ${values.light > 0 ? '+' : ''}${values.light}°`} />
                  <div className="hue-bar" style={{ background: midColor }} title="Mid: 0°" />
                  <div className="hue-bar" style={{ background: darkColor }} title={`Dark: ${values.dark > 0 ? '+' : ''}${values.dark}°`} />
                </>
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
            <option value="flat">Flat</option>
            <option value="bell">Bell</option>
            <option value="pastel">Pastel</option>
            <option value="jewel">Jewel</option>
            <option value="linear-fade">Linear Fade</option>
            <option value="custom">Custom</option>
          </select>

          {/* Curve Preview - uses selected color */}
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
                  <div className="chroma-bar" style={{ background: color.baseColor, opacity: values.light / 100 }} title={`Light: ${values.light}%`} />
                  <div className="chroma-bar" style={{ background: color.baseColor, opacity: values.mid / 100 }} title={`Mid: ${values.mid}%`} />
                  <div className="chroma-bar" style={{ background: color.baseColor, opacity: values.dark / 100 }} title={`Dark: ${values.dark}%`} />
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
// RIGHT SETTINGS PANEL (Always visible panel)
// ============================================
interface RightSettingsPanelProps {
  color: Color;
  globalSettings: EffectiveSettings;
  onUpdate: (color: Color) => void;
  onDelete: () => void;
  onClose: () => void;
}

function RightSettingsPanel({ color, globalSettings, onUpdate, onDelete, onClose }: RightSettingsPanelProps) {
  const baseSwatchRef = useRef<HTMLDivElement>(null);
  const [showBasePicker, setShowBasePicker] = useState(false);
  const [pickerOpenUpward, setPickerOpenUpward] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [baseHexInput, setBaseHexInput] = useState(color.baseColor);

  // Keep input in sync when baseColor changes externally
  useEffect(() => {
    setBaseHexInput(color.baseColor);
  }, [color.baseColor]);

  const expandHexShorthand = (hex: string): string => {
    const h = hex.replace('#', '');
    if (h.length === 1) return '#' + h.repeat(6);
    if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
    return hex;
  };

  const applyBaseHex = (newHex: string) => {
    const expanded = expandHexShorthand(newHex);
    if (/^#[0-9A-Fa-f]{6}$/.test(expanded)) {
      setBaseHexInput(expanded.toUpperCase());
      onUpdate({ ...color, baseColor: expanded.toUpperCase() });
    } else {
      setBaseHexInput(color.baseColor);
    }
  };

  const handleBaseSwatchClick = () => {
    if (!baseSwatchRef.current) {
      setShowBasePicker(!showBasePicker);
      return;
    }

    // Calculate if there's enough space below for the picker (~380px)
    const rect = baseSwatchRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const pickerHeight = 380;

    setPickerOpenUpward(spaceBelow < pickerHeight);
    setShowBasePicker(!showBasePicker);
  };

  return (
    <div className="right-settings-panel">
      <div className="right-settings-header">
        <span className="right-settings-title">{color.label} Settings</span>
        <div className="right-settings-actions">
          <button
            className="right-settings-delete"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete this color"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Base Color */}
      <div className="stop-popup-section" style={{ position: 'relative' }}>
        <div className="color-field-row">
          <span className="color-field-label">Base color</span>
          <div className="color-field-controls">
            <div
              ref={baseSwatchRef}
              className="color-field-swatch"
              style={{ backgroundColor: color.baseColor }}
              onClick={handleBaseSwatchClick}
            />
            <input
              type="text"
              className="color-field-hex"
              value={baseHexInput.toUpperCase()}
              onChange={(e) => setBaseHexInput(e.target.value)}
              onBlur={(e) => applyBaseHex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyBaseHex((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>
        </div>
        {showBasePicker && (
          <div
            className={pickerOpenUpward ? 'picker-upward' : 'mt-2'}
            style={pickerOpenUpward ? {
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: '8px',
              zIndex: 10
            } : undefined}
          >
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
              // Check if this is a yellow color - use calculated yellow shifts
              const baseOklch = hexToOklch(color.baseColor);
              const yellowShifts = getYellowEquivalentShifts(baseOklch.h);

              // Use yellow-calculated values if yellow, otherwise use preset values
              const current = yellowShifts
                ? yellowShifts
                : (color.hueShiftCurve?.preset && color.hueShiftCurve.preset !== 'custom'
                    ? HUE_SHIFT_CURVE_PRESETS[color.hueShiftCurve.preset]
                    : { light: 0, dark: 0 });

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
          <option value="none">None</option>
          <option value="subtle">Subtle</option>
          <option value="natural">Natural</option>
          <option value="dramatic">Dramatic</option>
          <option value="custom">Custom</option>
        </select>

        {/* Visual Curve Preview - shows actual shifted colors */}
        <div className="hue-shift-visual-preview">
          {(() => {
            const preset = color.hueShiftCurve?.preset ?? 'none';
            const values = preset === 'custom'
              ? {
                  light: color.hueShiftCurve?.lightShift ?? 0,
                  dark: color.hueShiftCurve?.darkShift ?? 0
                }
              : (preset === 'none' ? { light: 0, dark: 0 } : HUE_SHIFT_CURVE_PRESETS[preset]);

            // Get base color's OKLCH
            const baseOklch = hexToOklch(color.baseColor);

            // Calculate shifted colors at different lightness levels
            const lightL = 0.85;
            const midL = 0.55;
            const darkL = 0.25;

            // Light: shift toward cyan (positive)
            const lightHue = (baseOklch.h + values.light + 360) % 360;
            const lightColor = oklchToHex({ l: lightL, c: baseOklch.c * 0.6, h: lightHue });

            // Mid: no shift
            const midColor = oklchToHex({ l: midL, c: baseOklch.c, h: baseOklch.h });

            // Dark: shift toward purple (negative)
            const darkHue = (baseOklch.h + values.dark + 360) % 360;
            const darkColor = oklchToHex({ l: darkL, c: baseOklch.c * 0.8, h: darkHue });

            return (
              <>
                <div className="hue-bar" style={{ background: lightColor }} title={`Light: ${values.light > 0 ? '+' : ''}${values.light}°`} />
                <div className="hue-bar" style={{ background: midColor }} title="Mid: 0°" />
                <div className="hue-bar" style={{ background: darkColor }} title={`Dark: ${values.dark > 0 ? '+' : ''}${values.dark}°`} />
              </>
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
          <option value="flat">Flat</option>
          <option value="bell">Bell</option>
          <option value="pastel">Pastel</option>
          <option value="jewel">Jewel</option>
          <option value="linear-fade">Linear Fade</option>
          <option value="custom">Custom</option>
        </select>

        {/* Curve Preview - uses selected color */}
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
                <div className="chroma-bar" style={{ background: color.baseColor, opacity: values.light / 100 }} title={`Light: ${values.light}%`} />
                <div className="chroma-bar" style={{ background: color.baseColor, opacity: values.mid / 100 }} title={`Mid: ${values.mid}%`} />
                <div className="chroma-bar" style={{ background: color.baseColor, opacity: values.dark / 100 }} title={`Dark: ${values.dark}%`} />
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Color"
          message={`Are you sure you want to delete "${color.label}"?`}
          onConfirm={() => {
            onDelete();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

// ============================================
// COLOR ROW (Horizontal palette row)
// ============================================
interface ColorRowProps {
  color: Color;
  globalSettings: EffectiveSettings;
  onUpdate: (color: Color) => void;
  onRemove: () => void;
  onOpenSettings: () => void;
  isSettingsOpen: boolean;
}

function ColorRow({ color, globalSettings, onUpdate, onRemove, onOpenSettings, isSettingsOpen }: ColorRowProps) {
  const [selectedStop, setSelectedStop] = useState<{ index: number; position: { x: number; y: number } } | null>(null);

  // Generate palette
  const paletteResult = useMemo(() => {
    return generateColorPalette(color, globalSettings);
  }, [color, globalSettings]);

  // Method is now global-only (no per-color override)
  const effectiveMethod = globalSettings.method;

  const handleStopClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering row click
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setSelectedStop({
      index,
      position: { x: rect.left, y: rect.bottom + 8 },
    });
  };

  const handleRowClick = () => {
    setSelectedStop(null); // Close color picker if open
    onOpenSettings();
  };

  const handleUpdateStop = (stopIndex: number, updates: Partial<Stop>) => {
    const newStops = [...color.stops];
    newStops[stopIndex] = { ...newStops[stopIndex], ...updates };
    onUpdate({ ...color, stops: newStops });
  };

  return (
    <div
      className={`color-row ${isSettingsOpen ? 'active' : ''}`}
      onClick={handleRowClick}
    >
      {/* Header: Just the name input */}
      <div className="color-row-header">
        <input
          type="text"
          value={color.label}
          onChange={(e) => onUpdate({ ...color, label: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="color-row-name"
        />
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
            <div className="popup-backdrop" onClick={(e) => { e.stopPropagation(); setSelectedStop(null); }} />
            <div
              className="stop-color-picker"
              style={{
                position: 'fixed',
                left: constrainedLeft,
                top: constrainedTop,
                zIndex: 1000,
              }}
              onClick={(e) => e.stopPropagation()}
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
    </div>
  );
}

// ============================================
// LEFT PANEL (Now contains group accordion)
// ============================================
// ============================================
// TOP BAR (Undo/Redo, Background Color, Export)
// ============================================
interface TopBarProps {
  globalConfig: GlobalConfig;
  onUpdateGlobalConfig: (config: GlobalConfig) => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function TopBar({
  globalConfig,
  onUpdateGlobalConfig,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}: TopBarProps) {
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [bgHexInput, setBgHexInput] = useState(globalConfig.backgroundColor);

  // Keep input in sync when backgroundColor changes externally (e.g., from color picker)
  useEffect(() => {
    setBgHexInput(globalConfig.backgroundColor);
  }, [globalConfig.backgroundColor]);

  const expandHexShorthand = (hex: string): string => {
    const h = hex.replace('#', '');
    if (h.length === 1) return '#' + h.repeat(6);
    if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
    return hex;
  };

  const applyBgHex = (newHex: string) => {
    const expanded = expandHexShorthand(newHex);
    if (/^#[0-9A-Fa-f]{6}$/.test(expanded)) {
      setBgHexInput(expanded.toUpperCase());
      onUpdateGlobalConfig({ ...globalConfig, backgroundColor: expanded.toUpperCase() });
    } else {
      // Revert to current valid color if invalid
      setBgHexInput(globalConfig.backgroundColor);
    }
  };

  return (
    <div className="top-bar">
      {/* Left side: Undo/Redo + Background Color */}
      <div className="top-bar-left">
        {/* Undo Button (icon only) */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="top-bar-icon-btn"
          title="Undo (Cmd+Z)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10h10a5 5 0 0 1 0 10H9" />
            <path d="M3 10l4-4" />
            <path d="M3 10l4 4" />
          </svg>
        </button>

        {/* Redo Button (icon only) */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="top-bar-icon-btn"
          title="Redo (Cmd+Shift+Z)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10H11a5 5 0 0 0 0 10h4" />
            <path d="M21 10l-4-4" />
            <path d="M21 10l-4 4" />
          </svg>
        </button>

        {/* Background Color Picker */}
        <div className="top-bar-bg-color">
          <span className="color-field-label">Background color</span>
          <div
            className="color-field-swatch"
            style={{ backgroundColor: globalConfig.backgroundColor }}
            onClick={() => setShowBgPicker(!showBgPicker)}
          />
          <input
            type="text"
            className="color-field-hex"
            value={bgHexInput.toUpperCase()}
            onChange={(e) => setBgHexInput(e.target.value)}
            onBlur={(e) => applyBgHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyBgHex((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {showBgPicker && (
            <>
              <div className="popup-backdrop" onClick={() => setShowBgPicker(false)} />
              <div className="bg-color-picker-popup">
                <ColorPickerPopup
                  color={globalConfig.backgroundColor}
                  onChange={(hex) => onUpdateGlobalConfig({ ...globalConfig, backgroundColor: hex })}
                  onClose={() => setShowBgPicker(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right side: Export button */}
      <div className="top-bar-right">
        <button onClick={onExport} className="export-btn">
          export
        </button>
      </div>
    </div>
  );
}

// ============================================
// LEFT PANEL (Groups only)
// ============================================
interface LeftPanelProps {
  globalConfig: GlobalConfig;
  groups: ColorGroup[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onUpdateGroup: (group: ColorGroup) => void;
  onAddGroup: () => void;
  onDeleteGroup: (groupId: string) => void;
}

function LeftPanel({
  globalConfig,
  groups,
  activeGroupId,
  onSelectGroup,
  onUpdateGroup,
  onAddGroup,
  onDeleteGroup
}: LeftPanelProps) {
  return (
    <div className="left-panel">
      {/* Group Accordion */}
      <div className="group-accordion">
        {groups.map(group => (
          <GroupAccordionItem
            key={group.id}
            group={group}
            backgroundColor={globalConfig.backgroundColor}
            isExpanded={group.id === activeGroupId}
            onToggle={() => onSelectGroup(group.id)}
            onUpdate={onUpdateGroup}
            onDelete={() => onDeleteGroup(group.id)}
            canDelete={groups.length > 1}
          />
        ))}

        {/* Add Group Button */}
        <button className="add-group-btn" onClick={onAddGroup}>
          + Add Group
        </button>
      </div>
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
  const initialState: AppState = createInitialAppState();
  const { state, setState, replaceState, undo, redo, canUndo, canRedo } = useHistory(initialState);
  const { globalConfig, groups, activeGroupId } = state;

  // Get the active group
  const activeGroup = activeGroupId
    ? groups.find(g => g.id === activeGroupId)
    : groups[0];

  // Get colors from active group
  const activeGroupColors = activeGroup?.colors ?? [];

  // Track which color's settings panel is open (null = none)
  const [activeSettingsColorId, setActiveSettingsColorId] = useState<string | null>(null);

  // Get the color object for the active settings panel
  const activeSettingsColor = activeSettingsColorId
    ? activeGroupColors.find(c => c.id === activeSettingsColorId)
    : null;

  // Create merged settings that combines group settings with global backgroundColor
  // This allows existing components to use globalSettings.backgroundColor
  const mergedSettings: EffectiveSettings = useMemo(() => {
    if (!activeGroup) return { ...createDefaultGroupSettings(), backgroundColor: globalConfig.backgroundColor };
    return {
      ...activeGroup.settings,
      backgroundColor: globalConfig.backgroundColor
    };
  }, [activeGroup, globalConfig.backgroundColor]);

  // Auto-select first group if none selected
  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) {
      setState({ globalConfig, groups, activeGroupId: groups[0].id });
    }
  }, [groups, activeGroupId, globalConfig, setState]);

  // Auto-select first color in active group when group changes
  useEffect(() => {
    if (activeGroupColors.length > 0 && !activeSettingsColor) {
      setActiveSettingsColorId(activeGroupColors[0].id);
    } else if (activeGroupColors.length === 0) {
      setActiveSettingsColorId(null);
    }
  }, [activeGroup?.id, activeGroupColors.length, activeSettingsColor]);

  // Track whether we've received the initial load response
  const hasLoadedRef = useRef(false);

  // Request saved state when component mounts
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

      // Handle load-state response with migration
      if (msg.type === 'load-state') {
        hasLoadedRef.current = true;
        if (msg.state) {
          // Migrate old format if needed
          const migratedState = migrateState({ version: msg.version ?? 1, state: msg.state });
          replaceState(migratedState);
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
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const timer = setTimeout(() => {
      parent.postMessage({ pluginMessage: { type: 'save-state', state } }, '*');
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  // ============================================
  // GLOBAL CONFIG OPERATIONS
  // ============================================
  const updateGlobalConfig = useCallback((newConfig: GlobalConfig) => {
    setState({ ...state, globalConfig: newConfig });
  }, [setState, state]);

  // ============================================
  // GROUP OPERATIONS
  // ============================================
  const selectGroup = useCallback((groupId: string) => {
    setState({ ...state, activeGroupId: groupId });
    // Clear color selection when switching groups
    setActiveSettingsColorId(null);
  }, [setState, state]);

  const addGroup = useCallback(() => {
    const id = `group-${Date.now()}`;
    const newGroup = createDefaultGroup(id, '');
    setState({
      globalConfig,
      groups: [...groups, newGroup],
      activeGroupId: id  // Switch to the new group
    });
    setActiveSettingsColorId(null);
  }, [setState, groups, globalConfig]);

  const updateGroup = useCallback((updatedGroup: ColorGroup) => {
    setState({
      ...state,
      groups: groups.map(g => g.id === updatedGroup.id ? updatedGroup : g)
    });
  }, [setState, state, groups]);

  const deleteGroup = useCallback((groupId: string) => {
    if (groups.length <= 1) return;  // Don't delete last group
    const newGroups = groups.filter(g => g.id !== groupId);
    const newActiveId = activeGroupId === groupId ? newGroups[0]?.id ?? null : activeGroupId;
    setState({
      globalConfig,
      groups: newGroups,
      activeGroupId: newActiveId
    });
    setActiveSettingsColorId(null);
  }, [setState, groups, activeGroupId, globalConfig]);

  // ============================================
  // COLOR OPERATIONS (within active group)
  // ============================================
  const addColor = useCallback(() => {
    if (!activeGroup) return;
    const id = `color-${Date.now()}`;
    // Count total colors across ALL groups for globally unique naming
    const totalColors = groups.reduce((sum, g) => sum + g.colors.length, 0);
    const label = `Color ${totalColors + 1}`;
    const baseColor = '#0066CC';
    const newColor = createDefaultColor(id, label, baseColor);
    updateGroup({
      ...activeGroup,
      colors: [...activeGroup.colors, newColor]
    });
    setActiveSettingsColorId(id);
  }, [activeGroup, updateGroup, groups]);

  const updateColor = useCallback((colorId: string, updatedColor: Color) => {
    if (!activeGroup) return;
    updateGroup({
      ...activeGroup,
      colors: activeGroup.colors.map(c => c.id === colorId ? updatedColor : c)
    });
  }, [activeGroup, updateGroup]);

  const removeColor = useCallback((colorId: string) => {
    if (!activeGroup) return;
    if (colorId === activeSettingsColorId) {
      setActiveSettingsColorId(null);
    }
    updateGroup({
      ...activeGroup,
      colors: activeGroup.colors.filter(c => c.id !== colorId)
    });
  }, [activeGroup, updateGroup, activeSettingsColorId]);

  // ============================================
  // EXPORT
  // ============================================
  const createVariables = () => {
    parent.postMessage(
      {
        pluginMessage: {
          type: 'create-variables',
          groups,  // Send all groups for export
          globalConfig,  // Send global config for background color
        },
      },
      '*'
    );
  };

  return (
    <div className="app-container">
      {/* Top Bar: Undo/Redo, Background Color, Export */}
      <TopBar
        globalConfig={globalConfig}
        onUpdateGlobalConfig={updateGlobalConfig}
        onExport={createVariables}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* Main Three-Panel Layout */}
      <div className="app-layout">
        {/* Left Panel: Groups only */}
        <LeftPanel
          globalConfig={globalConfig}
          groups={groups}
          activeGroupId={activeGroupId}
          onSelectGroup={selectGroup}
          onUpdateGroup={updateGroup}
          onAddGroup={addGroup}
          onDeleteGroup={deleteGroup}
        />

        {/* Middle Panel: Colors for active group */}
        <div className="middle-panel">
          {!activeGroup ? (
            <p className="empty-state p-4">Select a group to see its colors.</p>
          ) : activeGroupColors.length === 0 ? (
            <p className="empty-state p-4">No colors in this group. Add one to get started.</p>
          ) : (
            activeGroupColors.map((color) => (
              <ColorRow
                key={color.id}
                color={color}
                globalSettings={mergedSettings}
                onUpdate={(c) => updateColor(color.id, c)}
                onRemove={() => removeColor(color.id)}
                onOpenSettings={() => {
                  setActiveSettingsColorId(
                    activeSettingsColorId === color.id ? null : color.id
                  );
                }}
                isSettingsOpen={activeSettingsColorId === color.id}
              />
            ))
          )}

          {/* Add Color Button (only if a group is selected) */}
          {activeGroup && (
            <button onClick={addColor} className="add-color-btn">
              + Add Color
            </button>
          )}
        </div>

        {/* Right Settings Panel (per-color settings) */}
        {activeSettingsColor ? (
          <RightSettingsPanel
            color={activeSettingsColor}
            globalSettings={mergedSettings}
            onUpdate={(updatedColor) => updateColor(updatedColor.id, updatedColor)}
            onDelete={() => removeColor(activeSettingsColorId!)}
            onClose={() => setActiveSettingsColorId(null)}
          />
        ) : (
          <div className="right-panel-empty">
            <p>Add a color to see settings</p>
          </div>
        )}
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
