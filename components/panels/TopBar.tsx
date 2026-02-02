import React, { useState, useEffect } from 'react';
import { GlobalConfig } from '../../lib/types';
import { ColorPickerPopup } from '../color-picker';

interface TopBarProps {
  globalConfig: GlobalConfig;
  onUpdateGlobalConfig: (config: GlobalConfig) => void;
  onOpenExportModal: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function TopBar({
  globalConfig,
  onUpdateGlobalConfig,
  onOpenExportModal,
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
        <button onClick={onOpenExportModal} className="export-btn">
          export
        </button>
      </div>
    </div>
  );
}
