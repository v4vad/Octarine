import React, { useState } from 'react';
import { GlobalConfig } from '../../lib/types';
import { ColorPickerPopup } from '../color-picker';
import { SwatchHexInput } from '../primitives';

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
          <SwatchHexInput
            color={globalConfig.backgroundColor}
            onChange={(hex) => onUpdateGlobalConfig({ ...globalConfig, backgroundColor: hex })}
            onSwatchClick={() => setShowBgPicker(!showBgPicker)}
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
