import React, { useState } from 'react';
import { GlobalConfig } from '../../lib/types';
import { FrameworkPreset, FRAMEWORK_PRESETS } from '../../lib/framework-presets';
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
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLoadPreset: (preset: FrameworkPreset) => void;
  viewMode: 'all' | 'selected';
  onViewModeChange: (mode: 'all' | 'selected') => void;
}

function TopBarComponent({
  globalConfig,
  onUpdateGlobalConfig,
  onOpenExportModal,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  theme,
  onToggleTheme,
  onLoadPreset,
  viewMode,
  onViewModeChange,
}: TopBarProps) {
  const [showBgPicker, setShowBgPicker] = useState(false);

  return (
    <div className="top-bar">
      {/* Left side: Undo/Redo + Preset + View Mode toggle */}
      <div className="top-bar-left">
        {/* Undo Button */}
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

        {/* Redo Button */}
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

        {/* Preset Dropdown */}
        <select
          className="top-bar-preset-select"
          value=""
          onChange={(e) => {
            const preset = FRAMEWORK_PRESETS.find(p => p.id === e.target.value);
            if (preset) onLoadPreset(preset);
          }}
        >
          <option value="" disabled>Load preset…</option>
          {FRAMEWORK_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* View Mode: All Colors */}
        <button
          onClick={() => onViewModeChange('all')}
          className={`top-bar-icon-btn${viewMode === 'all' ? ' top-bar-icon-btn--active' : ''}`}
          title="Show all colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="8" height="8" rx="1" />
            <rect x="13" y="3" width="8" height="8" rx="1" />
            <rect x="3" y="13" width="8" height="8" rx="1" />
            <rect x="13" y="13" width="8" height="8" rx="1" />
          </svg>
        </button>

        {/* View Mode: Selected Only */}
        <button
          onClick={() => onViewModeChange('selected')}
          className={`top-bar-icon-btn${viewMode === 'selected' ? ' top-bar-icon-btn--active' : ''}`}
          title="Show selected color only"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
            <rect x="16" y="9" width="6" height="6" rx="1" />
          </svg>
        </button>
      </div>

      {/* Right side: Background color + Theme toggle + Export */}
      <div className="top-bar-right">
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

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="top-bar-icon-btn theme-toggle-btn"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Export Button */}
        <button onClick={onOpenExportModal} className="export-btn">
          export
        </button>
      </div>
    </div>
  );
}

export const TopBar = React.memo(TopBarComponent);
