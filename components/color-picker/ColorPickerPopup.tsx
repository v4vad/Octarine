import React, { useRef, useState, useEffect } from 'react';
import { useColorPicker } from '../../hooks/useColorPicker';
import { useClickOutside } from '../../hooks/useClickOutside';
import { GradientPicker } from './GradientPicker';
import { HueSlider } from './HueSlider';

interface ColorPickerPopupProps {
  color: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  onReset?: () => void;
}

export function ColorPickerPopup({ color, onChange, onClose, onReset }: ColorPickerPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'oklch' | 'hsb'>('hsb');

  const { state, handlers } = useColorPicker(color, onChange);
  const {
    hex, hexInput, oklch, hsb,
    lInput, cInput, hInput,
    hsbHInput, hsbSInput, hsbBInput
  } = state;

  useClickOutside(popupRef, onClose);

  // Listen for "Pick from selection" messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.pluginMessage?.type === 'selection-color') {
        const colorHex = e.data.pluginMessage.color as string;
        handlers.syncFromExternal(colorHex);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handlers]);

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
            onChange={(c, l) => handlers.applyOklch({ ...oklch, c, l })}
          />
          <HueSlider hue={oklch.h} onChange={(h) => handlers.applyOklch({ ...oklch, h })} />
        </>
      ) : (
        <>
          <GradientPicker
            hue={hsb.h}
            saturation={hsb.s}
            brightness={hsb.b}
            mode="hsb"
            onChange={(s, b) => handlers.applyHsb({ ...hsb, s, b })}
          />
          <HueSlider hue={hsb.h} onChange={(h) => handlers.applyHsb({ ...hsb, h })} />
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
                  onChange={(e) => handlers.setLInput(e.target.value)}
                  onBlur={handlers.handleLBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlers.handleLBlur(); }}
                  className="picker-numeric-input"
                />
              </div>
              <div className="flex-1">
                <label className="form-label-sm">C</label>
                <input
                  type="text"
                  value={cInput}
                  onChange={(e) => handlers.setCInput(e.target.value)}
                  onBlur={handlers.handleCBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlers.handleCBlur(); }}
                  className="picker-numeric-input"
                />
              </div>
              <div className="flex-1">
                <label className="form-label-sm">H</label>
                <input
                  type="text"
                  value={hInput}
                  onChange={(e) => handlers.setHInput(e.target.value)}
                  onBlur={handlers.handleHBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlers.handleHBlur(); }}
                  className="picker-numeric-input"
                />
              </div>
            </div>
            <div className="picker-swatch-hex-row">
              <div className="picker-swatch" style={{ backgroundColor: hex }} />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handlers.setHexInput(e.target.value)}
                onBlur={() => handlers.applyHex(hexInput)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlers.applyHex(hexInput); }}
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
                  onChange={(e) => handlers.setHsbHInput(e.target.value)}
                  onBlur={handlers.handleHsbHBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlers.handleHsbHBlur(); }}
                  className="picker-numeric-input"
                />
              </div>
              <div className="flex-1">
                <label className="form-label-sm">S</label>
                <input
                  type="text"
                  value={hsbSInput}
                  onChange={(e) => handlers.setHsbSInput(e.target.value)}
                  onBlur={handlers.handleHsbSBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlers.handleHsbSBlur(); }}
                  className="picker-numeric-input"
                />
              </div>
              <div className="flex-1">
                <label className="form-label-sm">B</label>
                <input
                  type="text"
                  value={hsbBInput}
                  onChange={(e) => handlers.setHsbBInput(e.target.value)}
                  onBlur={handlers.handleHsbBBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlers.handleHsbBBlur(); }}
                  className="picker-numeric-input"
                />
              </div>
            </div>
            <div className="picker-swatch-hex-row">
              <div className="picker-swatch" style={{ backgroundColor: hex }} />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handlers.setHexInput(e.target.value)}
                onBlur={() => handlers.applyHex(hexInput)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlers.applyHex(hexInput); }}
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
