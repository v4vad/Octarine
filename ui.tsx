import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  Input,
  Label,
  Checkbox,
  Disclosure,
  Icon,
} from 'react-figma-plugin-ds';
import 'react-figma-plugin-ds/figma-plugin-ds.css';

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
      // HSB gradient: X = saturation, Y = brightness (inverted)
      // Create horizontal gradient (white to hue color)
      const hueColor = `hsl(${hue}, 100%, 50%)`;

      // Draw saturation gradient (white to color)
      const satGradient = ctx.createLinearGradient(0, 0, width, 0);
      satGradient.addColorStop(0, 'white');
      satGradient.addColorStop(1, hueColor);
      ctx.fillStyle = satGradient;
      ctx.fillRect(0, 0, width, height);

      // Overlay brightness gradient (transparent to black)
      const brightGradient = ctx.createLinearGradient(0, 0, 0, height);
      brightGradient.addColorStop(0, 'rgba(0,0,0,0)');
      brightGradient.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = brightGradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      // OKLCH gradient: X = chroma, Y = lightness
      // Draw pixel by pixel (slower but accurate for OKLCH)
      const imageData = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const l = 1 - (y / height);  // Lightness: 1 at top, 0 at bottom
          const c = (x / width) * 0.4;  // Chroma: 0 to 0.4
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

    // Draw position indicator circle
    let posX: number, posY: number;
    if (mode === 'hsb') {
      posX = (saturation / 100) * width;
      posY = (1 - brightness / 100) * height;
    } else {
      posX = (saturation / 0.4) * width;  // saturation is actually chroma here
      posY = (1 - brightness) * height;   // brightness is actually lightness here
    }

    // Draw circle with border
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
      onChange(x * 0.4, 1 - y);  // chroma 0-0.4, lightness 0-1
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      style={{
        width: '100%',
        height: '160px',
        borderRadius: '4px',
        cursor: 'crosshair',
        display: 'block',
      }}
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
  hue: number;  // 0-360
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
      style={{
        width: '100%',
        height: '16px',
        borderRadius: '4px',
        background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
        cursor: 'pointer',
        position: 'relative',
        marginTop: '8px',
      }}
      onMouseDown={(e) => { setIsDragging(true); handleMouse(e); }}
      onMouseMove={(e) => { if (isDragging) handleMouse(e); }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      {/* Hue position indicator */}
      <div
        style={{
          position: 'absolute',
          left: `${(hue / 360) * 100}%`,
          top: '-2px',
          width: '4px',
          height: '20px',
          background: 'white',
          border: '1px solid black',
          borderRadius: '2px',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />
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
  onReset?: () => void;  // Optional: shows "Reset to Auto" button when provided
}

function ColorPickerPopup({ color, onChange, onClose, onReset }: ColorPickerPopupProps) {
  const [hex, setHex] = useState(color);
  const [oklch, setOklch] = useState<OKLCH>(hexToOklch(color));
  const [hsb, setHsb] = useState(() => {
    const rgb = hexToRgb(color);
    return rgbToHsb(rgb.r, rgb.g, rgb.b);
  });
  const popupRef = useRef<HTMLDivElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'oklch' | 'hex' | 'hsb'>('hsb');

  // Separate state for input fields to allow free typing
  const [hexInput, setHexInput] = useState(color);
  const [lInput, setLInput] = useState(oklch.l.toFixed(2));
  const [cInput, setCInput] = useState(oklch.c.toFixed(3));
  const [hInput, setHInput] = useState(oklch.h.toFixed(0));
  const [hsbHInput, setHsbHInput] = useState(hsb.h.toFixed(0));
  const [hsbSInput, setHsbSInput] = useState(hsb.s.toFixed(0));
  const [hsbBInput, setHsbBInput] = useState(hsb.b.toFixed(0));

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Listen for selection-color response from plugin
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

  // Expand hex shorthand: #f45 → #ff4455, #3 → #333333
  const expandHexShorthand = (hex: string): string => {
    const h = hex.replace('#', '');
    if (h.length === 1) return '#' + h.repeat(6);
    if (h.length === 3) return '#' + h.split('').map(c => c + c).join('');
    return hex;
  };

  // Apply hex value - called on blur or Enter
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

  // Apply OKLCH value - called on blur or Enter or stepper
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

  // Apply HSB value - called on blur or Enter or stepper
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

  // Handle blur for OKLCH L input
  const handleLBlur = () => {
    const val = parseFloat(lInput);
    if (!isNaN(val)) {
      applyOklch({ ...oklch, l: Math.max(0, Math.min(1, val)) });
    } else {
      setLInput(oklch.l.toFixed(2)); // Reset to current value
    }
  };

  // Handle blur for OKLCH C input
  const handleCBlur = () => {
    const val = parseFloat(cInput);
    if (!isNaN(val)) {
      applyOklch({ ...oklch, c: Math.max(0, val) });
    } else {
      setCInput(oklch.c.toFixed(3));
    }
  };

  // Handle blur for OKLCH H input
  const handleHBlur = () => {
    const val = parseFloat(hInput);
    if (!isNaN(val)) {
      applyOklch({ ...oklch, h: val });
    } else {
      setHInput(oklch.h.toFixed(0));
    }
  };

  // Handle blur for HSB H input
  const handleHsbHBlur = () => {
    const val = parseFloat(hsbHInput);
    if (!isNaN(val)) {
      applyHsb({ ...hsb, h: Math.max(0, Math.min(360, val)) });
    } else {
      setHsbHInput(hsb.h.toFixed(0));
    }
  };

  // Handle blur for HSB S input
  const handleHsbSBlur = () => {
    const val = parseFloat(hsbSInput);
    if (!isNaN(val)) {
      applyHsb({ ...hsb, s: Math.max(0, Math.min(100, val)) });
    } else {
      setHsbSInput(hsb.s.toFixed(0));
    }
  };

  // Handle blur for HSB B input
  const handleHsbBBlur = () => {
    const val = parseFloat(hsbBInput);
    if (!isNaN(val)) {
      applyHsb({ ...hsb, b: Math.max(0, Math.min(100, val)) });
    } else {
      setHsbBInput(hsb.b.toFixed(0));
    }
  };

  return (
    <div
      ref={popupRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 1000,
        background: 'var(--figma-color-bg)',
        border: '1px solid var(--figma-color-border)',
        borderRadius: '4px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        width: '280px',
      }}
    >
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        marginBottom: '12px',
        borderBottom: '1px solid var(--figma-color-border)',
      }}>
        {(['hsb', 'oklch', 'hex'] as const).map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px',
              textAlign: 'center',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--figma-color-text)' : 'var(--figma-color-text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--figma-color-text-brand)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Visual picker - HSB or OKLCH gradient */}
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

      {/* Pick color from selected shape */}
      <button
        onClick={() => parent.postMessage({ pluginMessage: { type: 'get-selection-color' } }, '*')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 8px',
          marginTop: '8px',
          border: '1px solid var(--figma-color-border)',
          borderRadius: '4px',
          background: 'var(--figma-color-bg)',
          color: 'var(--figma-color-text)',
          cursor: 'pointer',
          fontSize: '11px',
          width: '100%',
        }}
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

      {/* Tab-specific inputs */}
      <div style={{ marginTop: '12px' }}>
        {activeTab === 'hex' && (
          <div>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={() => applyHex(hexInput)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyHex(hexInput); }}
              placeholder="#000000"
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid var(--figma-color-border)',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '11px',
                textAlign: 'center',
                background: 'var(--figma-color-bg)',
                color: 'var(--figma-color-text)',
              }}
            />
          </div>
        )}

        {activeTab === 'oklch' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>L</label>
              <input
                type="text"
                value={lInput}
                onChange={(e) => setLInput(e.target.value)}
                onBlur={handleLBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLBlur(); }}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid var(--figma-color-border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: 'var(--figma-color-bg)',
                  color: 'var(--figma-color-text)',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>C</label>
              <input
                type="text"
                value={cInput}
                onChange={(e) => setCInput(e.target.value)}
                onBlur={handleCBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCBlur(); }}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid var(--figma-color-border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: 'var(--figma-color-bg)',
                  color: 'var(--figma-color-text)',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>H</label>
              <input
                type="text"
                value={hInput}
                onChange={(e) => setHInput(e.target.value)}
                onBlur={handleHBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleHBlur(); }}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid var(--figma-color-border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: 'var(--figma-color-bg)',
                  color: 'var(--figma-color-text)',
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'hsb' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>H</label>
              <input
                type="text"
                value={hsbHInput}
                onChange={(e) => setHsbHInput(e.target.value)}
                onBlur={handleHsbHBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleHsbHBlur(); }}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid var(--figma-color-border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: 'var(--figma-color-bg)',
                  color: 'var(--figma-color-text)',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>S</label>
              <input
                type="text"
                value={hsbSInput}
                onChange={(e) => setHsbSInput(e.target.value)}
                onBlur={handleHsbSBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleHsbSBlur(); }}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid var(--figma-color-border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: 'var(--figma-color-bg)',
                  color: 'var(--figma-color-text)',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>B</label>
              <input
                type="text"
                value={hsbBInput}
                onChange={(e) => setHsbBInput(e.target.value)}
                onBlur={handleHsbBBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') handleHsbBBlur(); }}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid var(--figma-color-border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  background: 'var(--figma-color-bg)',
                  color: 'var(--figma-color-text)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Color preview with hex */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '12px',
        padding: '8px',
        background: 'var(--figma-color-bg-secondary)',
        borderRadius: '4px',
      }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            backgroundColor: hex,
            borderRadius: '4px',
            border: '1px solid var(--figma-color-border)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{hex}</span>
      </div>

      {/* Reset button - only shown when onReset is provided */}
      {onReset && (
        <Button
          onClick={() => {
            onReset();
            onClose();
          }}
          isSecondary
          style={{ marginTop: '12px', width: '100%' }}
        >
          Reset to Auto
        </Button>
      )}
    </div>
  );
}

// ============================================
// COLOR SWATCH (clickable)
// ============================================
interface ColorSwatchProps {
  color: string;
  onClick: () => void;
  size?: number;
}

function ColorSwatch({ color, onClick, size = 32 }: ColorSwatchProps) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: '4px',
        border: '1px solid var(--figma-color-border)',
        cursor: 'pointer',
      }}
    />
  );
}

// ============================================
// STOP ROW
// ============================================
interface StopRowProps {
  stop: Stop;
  generatedColor: string;
  correctionsEnabled: boolean;             // Whether HK or BB corrections are on globally
  wasNudged?: boolean;                     // Was this color auto-adjusted for uniqueness?
  onOverride: (oklch: OKLCH) => void;      // Called when user picks a new color
  onResetOverride: () => void;             // Called when user wants to reset to auto
  onRemove: () => void;                    // Called when user removes this stop
  onToggleApplyCorrections: () => void;    // Toggle applyCorrectionsToManual
}

function StopRow({ stop, generatedColor, correctionsEnabled, wasNudged, onOverride, onResetOverride, onRemove, onToggleApplyCorrections }: StopRowProps) {
  const [showPicker, setShowPicker] = useState(false);

  const displayColor = stop.manualOverride
    ? oklchToHex(stop.manualOverride)
    : generatedColor;

  const isOverridden = !!stop.manualOverride;
  const showNudgeIndicator = !isOverridden && wasNudged;

  // When user picks a color in the popup, convert hex to OKLCH and call onOverride
  const handleColorChange = (hex: string) => {
    const oklch = hexToOklch(hex);
    onOverride(oklch);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 0',
        position: 'relative',  // For positioning the popup
      }}
    >
      {/* Stop number - shows asterisk if overridden */}
      <span style={{ width: '32px', fontSize: '11px', color: 'var(--figma-color-text-secondary)' }}>
        {stop.number}{isOverridden ? '*' : ''}
      </span>

      {/* Clickable color swatch with override indicator */}
      <div
        onClick={() => setShowPicker(!showPicker)}
        style={{
          position: 'relative',
          width: '24px',
          height: '24px',
          cursor: 'pointer',
        }}
      >
        {/* The color swatch itself */}
        <div
          style={{
            width: '24px',
            height: '24px',
            backgroundColor: displayColor,
            borderRadius: '3px',
            border: isOverridden
              ? '2px solid var(--figma-color-text-brand)'
              : '1px solid var(--figma-color-border)',
          }}
        />
        {/* Small dot indicator for overridden colors */}
        {isOverridden && (
          <div
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 8,
              height: 8,
              backgroundColor: 'var(--figma-color-text-brand)',
              borderRadius: '50%',
              border: '1px solid var(--figma-color-bg)',
            }}
          />
        )}
      </div>

      {/* Hex color value with nudge indicator */}
      <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>
        {displayColor.toUpperCase()}
        {showNudgeIndicator && (
          <span
            style={{ color: 'var(--figma-color-text-warning)', marginLeft: '2px' }}
            title="Auto-adjusted for uniqueness"
          >
            ~
          </span>
        )}
      </span>

      {/* Reset icon - only shown when overridden */}
      {isOverridden && (
        <div
          onClick={(e) => {
            e.stopPropagation();  // Prevent opening picker
            onResetOverride();
          }}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '2px',
            borderRadius: '2px',
          }}
          title="Reset to auto-generated color"
        >
          <Icon name="revert" />
        </div>
      )}

      {/* Apply corrections toggle - only shown when overridden AND global corrections are on */}
      {isOverridden && correctionsEnabled && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleApplyCorrections();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '4px',
            cursor: 'pointer',
          }}
          title="Apply HK/BB corrections to this override"
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              border: '1px solid var(--figma-color-border)',
              background: stop.applyCorrectionsToManual
                ? 'var(--figma-color-text-brand)'
                : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {stop.applyCorrectionsToManual && (
              <span style={{ color: 'white', fontSize: '9px', fontWeight: 'bold' }}>✓</span>
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--figma-color-text-secondary)' }}>
            Correct
          </span>
        </div>
      )}

      {/* Spacer to push remove button to the right */}
      <div style={{ flex: 1 }} />

      {/* Remove stop button */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          padding: '2px',
          borderRadius: '2px',
          opacity: 0.5,
        }}
        title="Remove this stop"
      >
        <Icon name="close" />
      </div>

      {/* Color picker popup */}
      {showPicker && (
        <ColorPickerPopup
          color={displayColor}
          onChange={handleColorChange}
          onClose={() => setShowPicker(false)}
          onReset={isOverridden ? onResetOverride : undefined}  // Only show reset in popup if overridden
        />
      )}
    </div>
  );
}

// ============================================
// REF-BASED NUMERIC INPUT
// Uses refs instead of state to be immune to React re-renders while typing
// ============================================
interface RefBasedNumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: number;
  style?: React.CSSProperties;
}

function RefBasedNumericInput({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  decimals = 1,
  style
}: RefBasedNumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  // Only sync value from props when NOT focused
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
        // Invalid input - reset to prop value
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
    />
  );
}

// ============================================
// GLOBAL SETTINGS PANEL
// ============================================
interface GlobalSettingsProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
}

function GlobalSettingsPanel({ settings, onUpdate }: GlobalSettingsProps) {
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);

  // Get all unique stop numbers from default lightness keys (memoized to prevent re-creation)
  const stopNumbers = useMemo(
    () => Object.keys(settings.defaultLightness)
      .map(Number)
      .sort((a, b) => a - b),
    [settings.defaultLightness]
  );

  return (
    <div
      style={{
        border: '1px solid var(--figma-color-border)',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '16px',
        background: 'var(--figma-color-bg-secondary)',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
        Global Settings
      </div>

      {/* Background Color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', position: 'relative' }}>
        <Label style={{ minWidth: '80px' }}>Background:</Label>
        <ColorSwatch
          color={settings.backgroundColor}
          onClick={() => setShowBgPicker(!showBgPicker)}
          size={24}
        />
        <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
          {settings.backgroundColor.toUpperCase()}
        </span>
        {showBgPicker && (
          <ColorPickerPopup
            color={settings.backgroundColor}
            onChange={(hex) => onUpdate({ ...settings, backgroundColor: hex })}
            onClose={() => setShowBgPicker(false)}
          />
        )}
      </div>

      {/* Target Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Label style={{ minWidth: '80px' }}>Target:</Label>
        <select
          value={settings.mode}
          onChange={(e) => onUpdate({ ...settings, mode: e.target.value as 'lightness' | 'contrast' })}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid var(--figma-color-border)',
            background: 'var(--figma-color-bg)',
            color: 'var(--figma-color-text)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <option value="lightness">Lightness</option>
          <option value="contrast">Contrast</option>
        </select>
        <span style={{ fontSize: '10px', color: 'var(--figma-color-text-tertiary)' }}>
          {settings.mode === 'lightness' ? '(OKLCH L value)' : '(WCAG ratio)'}
        </span>
      </div>

      {/* HK/BB Corrections */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
        <Label style={{ minWidth: '80px' }}>Corrections:</Label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.hkCorrection}
            onChange={(e) => onUpdate({ ...settings, hkCorrection: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '11px' }}>HK</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.bbCorrection}
            onChange={(e) => onUpdate({ ...settings, bbCorrection: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '11px' }}>BB</span>
        </label>
        <span style={{ fontSize: '10px', color: 'var(--figma-color-text-tertiary)' }}>
          (perceptual adjustments)
        </span>
      </div>

      {/* Lightness Expansion */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Label style={{ minWidth: '80px' }}>L Expansion:</Label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.05"
          value={settings.lightnessExpansion}
          onChange={(e) => onUpdate({ ...settings, lightnessExpansion: parseFloat(e.target.value) })}
          style={{ flex: 1, cursor: 'pointer' }}
        />
        <RefBasedNumericInput
          value={settings.lightnessExpansion}
          onChange={(val) => onUpdate({ ...settings, lightnessExpansion: val })}
          min={0.5}
          max={2}
          decimals={2}
          style={{
            width: '50px',
            padding: '4px',
            border: '1px solid var(--figma-color-border)',
            borderRadius: '3px',
            fontSize: '10px',
            background: 'var(--figma-color-bg)',
            color: 'var(--figma-color-text)',
          }}
        />
        <span style={{ fontSize: '9px', color: 'var(--figma-color-text-tertiary)', minWidth: '60px' }}>
          {settings.lightnessExpansion < 0.95 ? 'Compress' : settings.lightnessExpansion > 1.05 ? 'Spread' : 'Normal'}
        </span>
      </div>

      {/* Default Values (expandable) */}
      <Disclosure
        label="Default Stop Values"
        isExpanded={showDefaults}
        onExpandedChange={setShowDefaults}
      >
        <div style={{ marginTop: '8px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '50px 1fr 1fr',
            gap: '4px',
            fontSize: '10px',
            fontWeight: 600,
            marginBottom: '4px',
            color: 'var(--figma-color-text-secondary)',
          }}>
            <span>Stop</span>
            <span>Lightness</span>
            <span>Contrast</span>
          </div>
          {stopNumbers.map((num) => (
            <div
              key={num}
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr',
                gap: '4px',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--figma-color-text-secondary)' }}>
                {num}
              </span>
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
                style={{
                  width: '100%',
                  padding: '4px',
                  border: '1px solid var(--figma-color-border)',
                  borderRadius: '3px',
                  fontSize: '10px',
                  background: 'var(--figma-color-bg)',
                  color: 'var(--figma-color-text)',
                }}
              />
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
                style={{
                  width: '100%',
                  padding: '4px',
                  border: '1px solid var(--figma-color-border)',
                  borderRadius: '3px',
                  fontSize: '10px',
                  background: 'var(--figma-color-bg)',
                  color: 'var(--figma-color-text)',
                }}
              />
            </div>
          ))}
        </div>
      </Disclosure>
    </div>
  );
}

// ============================================
// COLOR CARD
// ============================================
interface ColorCardProps {
  color: Color;
  globalSettings: GlobalSettings;
  onUpdate: (color: Color) => void;
  onRemove: () => void;
}

function ColorCard({ color, globalSettings, onUpdate, onRemove }: ColorCardProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [stopsExpanded, setStopsExpanded] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(false);  // Color-level settings
  const [newStopNumber, setNewStopNumber] = useState('');  // For "Add Stop" input

  // Determine effective settings (color-level overrides global)
  const effectiveMode = color.modeOverride ?? globalSettings.mode;
  const effectiveHK = color.hkCorrectionOverride !== undefined
    ? color.hkCorrectionOverride
    : globalSettings.hkCorrection;
  const effectiveBB = color.bbCorrectionOverride !== undefined
    ? color.bbCorrectionOverride
    : globalSettings.bbCorrection;

  // Generate all colors using palette generation (handles expansion + uniqueness)
  const paletteResult = useMemo(() => {
    return generateColorPalette(color, globalSettings);
  }, [color, globalSettings]);

  // Map palette results to hex strings for backward compatibility
  const generatedColors = paletteResult.stops.map(s => s.hex);

  // Handler: when user manually overrides a stop's color
  const handleStopOverride = (stopIndex: number, newOklch: OKLCH) => {
    const newStops = [...color.stops];
    newStops[stopIndex] = {
      ...newStops[stopIndex],
      manualOverride: newOklch,
    };
    onUpdate({ ...color, stops: newStops });
  };

  // Handler: when user resets a stop back to auto-generated
  const handleResetOverride = (stopIndex: number) => {
    const newStops = [...color.stops];
    newStops[stopIndex] = {
      ...newStops[stopIndex],
      manualOverride: undefined,
    };
    onUpdate({ ...color, stops: newStops });
  };

  // Handler: add a new stop with the given number
  const handleAddStop = () => {
    const num = parseInt(newStopNumber, 10);

    // Validate: must be a positive number
    if (isNaN(num) || num <= 0) {
      return;
    }

    // Check if stop already exists
    if (color.stops.some(s => s.number === num)) {
      return;  // Stop already exists, don't add duplicate
    }

    // Create new stop with just the number (no overrides)
    const newStop: Stop = { number: num };

    // Add to stops array and sort by number (auto-sort)
    const newStops = [...color.stops, newStop].sort((a, b) => a.number - b.number);

    onUpdate({ ...color, stops: newStops });
    setNewStopNumber('');  // Clear input
  };

  // Handler: remove a stop by its index
  const handleRemoveStop = (stopIndex: number) => {
    const newStops = color.stops.filter((_, i) => i !== stopIndex);
    onUpdate({ ...color, stops: newStops });
  };

  // Handler: toggle applyCorrectionsToManual for a stop
  const handleToggleApplyCorrections = (stopIndex: number) => {
    const newStops = [...color.stops];
    newStops[stopIndex] = {
      ...newStops[stopIndex],
      applyCorrectionsToManual: !newStops[stopIndex].applyCorrectionsToManual,
    };
    onUpdate({ ...color, stops: newStops });
  };

  // Are corrections enabled (using effective values for this color)?
  const correctionsEnabled = effectiveHK || effectiveBB;

  return (
    <div
      style={{
        border: '1px solid var(--figma-color-border)',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '8px',
      }}
    >
      {/* Header: Label + Remove */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <Input
          value={color.label}
          onChange={(val) => onUpdate({ ...color, label: val })}
          style={{ flex: 1 }}
        />
        <Button onClick={onRemove} isDestructive>
          Remove
        </Button>
      </div>

      {/* Base color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', position: 'relative' }}>
        <Label>Base:</Label>
        <ColorSwatch color={color.baseColor} onClick={() => setShowPicker(!showPicker)} />
        <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
          {color.baseColor.toUpperCase()}
        </span>
        {showPicker && (
          <ColorPickerPopup
            color={color.baseColor}
            onChange={(hex) => onUpdate({ ...color, baseColor: hex })}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      {/* Color-level Settings */}
      <Disclosure
        label="Settings"
        isExpanded={settingsExpanded}
        onExpandedChange={setSettingsExpanded}
      >
        <div style={{ padding: '8px', background: 'var(--figma-color-bg-secondary)', borderRadius: '4px', marginTop: '4px' }}>
          {/* Mode Override */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', minWidth: '60px' }}>Mode:</span>
            <select
              value={color.modeOverride ?? 'global'}
              onChange={(e) => {
                const val = e.target.value;
                onUpdate({
                  ...color,
                  modeOverride: val === 'global' ? undefined : val as 'lightness' | 'contrast',
                });
              }}
              style={{
                padding: '4px 6px',
                borderRadius: '3px',
                border: '1px solid var(--figma-color-border)',
                background: 'var(--figma-color-bg)',
                color: 'var(--figma-color-text)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <option value="global">Use Global ({globalSettings.mode})</option>
              <option value="lightness">Lightness</option>
              <option value="contrast">Contrast</option>
            </select>
          </div>

          {/* HK Correction Override */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', minWidth: '60px' }}>HK:</span>
            <select
              value={color.hkCorrectionOverride === undefined ? 'global' : color.hkCorrectionOverride ? 'on' : 'off'}
              onChange={(e) => {
                const val = e.target.value;
                onUpdate({
                  ...color,
                  hkCorrectionOverride: val === 'global' ? undefined : val === 'on',
                });
              }}
              style={{
                padding: '4px 6px',
                borderRadius: '3px',
                border: '1px solid var(--figma-color-border)',
                background: 'var(--figma-color-bg)',
                color: 'var(--figma-color-text)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <option value="global">Use Global ({globalSettings.hkCorrection ? 'On' : 'Off'})</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>

          {/* BB Correction Override */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', minWidth: '60px' }}>BB:</span>
            <select
              value={color.bbCorrectionOverride === undefined ? 'global' : color.bbCorrectionOverride ? 'on' : 'off'}
              onChange={(e) => {
                const val = e.target.value;
                onUpdate({
                  ...color,
                  bbCorrectionOverride: val === 'global' ? undefined : val === 'on',
                });
              }}
              style={{
                padding: '4px 6px',
                borderRadius: '3px',
                border: '1px solid var(--figma-color-border)',
                background: 'var(--figma-color-bg)',
                color: 'var(--figma-color-text)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <option value="global">Use Global ({globalSettings.bbCorrection ? 'On' : 'Off'})</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>

          {/* L Expansion Override */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', minWidth: '60px' }}>L Expand:</span>
            <select
              value={color.lightnessExpansionOverride === undefined ? 'global' : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'global') {
                  onUpdate({ ...color, lightnessExpansionOverride: undefined });
                } else {
                  onUpdate({ ...color, lightnessExpansionOverride: globalSettings.lightnessExpansion });
                }
              }}
              style={{
                padding: '4px 6px',
                borderRadius: '3px',
                border: '1px solid var(--figma-color-border)',
                background: 'var(--figma-color-bg)',
                color: 'var(--figma-color-text)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <option value="global">Use Global ({globalSettings.lightnessExpansion.toFixed(2)})</option>
              <option value="custom">Custom</option>
            </select>
            {color.lightnessExpansionOverride !== undefined && (
              <RefBasedNumericInput
                value={color.lightnessExpansionOverride}
                onChange={(val) => onUpdate({ ...color, lightnessExpansionOverride: val })}
                min={0.5}
                max={2}
                decimals={2}
                style={{
                  width: '50px',
                  padding: '4px',
                  border: '1px solid var(--figma-color-border)',
                  borderRadius: '3px',
                  fontSize: '10px',
                  background: 'var(--figma-color-bg)',
                  color: 'var(--figma-color-text)',
                }}
              />
            )}
          </div>

          {/* Divider */}
          <div style={{
            borderTop: '1px solid var(--figma-color-border)',
            marginBottom: '12px',
            paddingTop: '4px',
          }}>
            <span style={{ fontSize: '10px', color: 'var(--figma-color-text-tertiary)' }}>
              Artistic Shifts
            </span>
          </div>

          {/* Hue Shift Slider */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px' }}>Hue Shift</span>
              <span style={{ fontSize: '10px', color: 'var(--figma-color-text-secondary)' }}>
                {color.hueShift ?? 0}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={color.hueShift ?? 0}
              onChange={(e) => onUpdate({ ...color, hueShift: parseInt(e.target.value) })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`hue-dir-${color.id}`}
                  checked={(color.hueShiftDirection ?? 'warm-cool') === 'warm-cool'}
                  onChange={() => onUpdate({ ...color, hueShiftDirection: 'warm-cool' })}
                />
                <span style={{ fontSize: '10px' }}>Warm→Cool</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`hue-dir-${color.id}`}
                  checked={color.hueShiftDirection === 'cool-warm'}
                  onChange={() => onUpdate({ ...color, hueShiftDirection: 'cool-warm' })}
                />
                <span style={{ fontSize: '10px' }}>Cool→Warm</span>
              </label>
            </div>
          </div>

          {/* Saturation Shift Slider */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px' }}>Saturation Shift</span>
              <span style={{ fontSize: '10px', color: 'var(--figma-color-text-secondary)' }}>
                {color.saturationShift ?? 0}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={color.saturationShift ?? 0}
              onChange={(e) => onUpdate({ ...color, saturationShift: parseInt(e.target.value) })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`sat-dir-${color.id}`}
                  checked={(color.saturationShiftDirection ?? 'vivid-muted') === 'vivid-muted'}
                  onChange={() => onUpdate({ ...color, saturationShiftDirection: 'vivid-muted' })}
                />
                <span style={{ fontSize: '10px' }}>Vivid→Muted</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`sat-dir-${color.id}`}
                  checked={color.saturationShiftDirection === 'muted-vivid'}
                  onChange={() => onUpdate({ ...color, saturationShiftDirection: 'muted-vivid' })}
                />
                <span style={{ fontSize: '10px' }}>Muted→Vivid</span>
              </label>
            </div>
          </div>
        </div>
      </Disclosure>

      {/* Warning banner when duplicates were auto-fixed */}
      {paletteResult.hadDuplicates && (
        <div
          style={{
            backgroundColor: 'var(--figma-color-bg-warning)',
            color: 'var(--figma-color-text-warning)',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '10px',
            marginBottom: '8px',
          }}
        >
          Some colors were auto-adjusted for uniqueness. Look for ~ markers.
        </div>
      )}

      {/* Stops */}
      <Disclosure
        label={`Stops (${color.stops.length})`}
        isExpanded={stopsExpanded}
        onExpandedChange={setStopsExpanded}
      >
        <div style={{ paddingLeft: '8px' }}>
          {color.stops.map((stop, i) => (
            <StopRow
              key={stop.number}
              stop={stop}
              generatedColor={generatedColors[i]}
              correctionsEnabled={correctionsEnabled}
              wasNudged={paletteResult.stops[i]?.wasNudged}
              onOverride={(oklch) => handleStopOverride(i, oklch)}
              onResetOverride={() => handleResetOverride(i)}
              onRemove={() => handleRemoveStop(i)}
              onToggleApplyCorrections={() => handleToggleApplyCorrections(i)}
            />
          ))}

          {/* Add Stop: input + button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <Input
              value={newStopNumber}
              onChange={setNewStopNumber}
              placeholder="e.g. 150"
              style={{ width: '80px' }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter') handleAddStop();
              }}
            />
            <Button onClick={handleAddStop} isSecondary>
              + Add Stop
            </Button>
          </div>
        </div>
      </Disclosure>
    </div>
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

  return (
    <div style={{ padding: '12px' }}>
      <h2 style={{ marginBottom: '12px', fontSize: '14px' }}>Octarine</h2>

      {/* Global Settings */}
      <GlobalSettingsPanel
        settings={globalSettings}
        onUpdate={setGlobalSettings}
      />

      {/* Colors list */}
      {colors.length === 0 ? (
        <p style={{ color: 'var(--figma-color-text-secondary)', marginBottom: '12px' }}>
          No colors yet. Add one to get started.
        </p>
      ) : (
        colors.map((color, i) => (
          <ColorCard
            key={color.id}
            color={color}
            globalSettings={globalSettings}
            onUpdate={(c) => updateColor(i, c)}
            onRemove={() => removeColor(i)}
          />
        ))
      )}

      {/* Add color button */}
      <Button onClick={addColor} style={{ marginBottom: '16px' }}>
        + Add Color
      </Button>

      {/* Create variables button */}
      {colors.length > 0 && (
        <Button onClick={createVariables} isSecondary>
          Create Figma Variables
        </Button>
      )}
    </div>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
