import React, { useState } from 'react';
import { Color } from '../../lib/types';
import { FrameworkPreset, FRAMEWORK_PRESETS } from '../../lib/framework-presets';
import { DefaultsTable } from './DefaultsTable';
import { SwatchHexInput } from '../primitives';
import { ColorPickerPopup } from '../color-picker';

interface LeftPanelProps {
  colors: Color[];
  activeColorId: string | null;
  onSelectColor: (colorId: string) => void;
  onUpdateColor: (colorId: string, color: Color) => void;
  onAddColor: () => void;
  onLoadPreset: (preset: FrameworkPreset) => void;
}

function LeftPanelComponent({
  colors,
  activeColorId,
  onSelectColor,
  onUpdateColor,
  onAddColor,
  onLoadPreset,
}: LeftPanelProps) {
  const [pickerColorId, setPickerColorId] = useState<string | null>(null);

  const handleSwatchClick = (colorId: string) => {
    if (pickerColorId === colorId) {
      setPickerColorId(null);
      return;
    }
    setPickerColorId(colorId);
  };

  return (
    <div className="left-panel">
      <div className="group-accordion">
        <div className="preset-buttons">
          {FRAMEWORK_PRESETS.map(preset => (
            <button
              key={preset.id}
              className="preset-button"
              onClick={() => onLoadPreset(preset)}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {colors.map(color => {
          const isExpanded = color.id === activeColorId;
          const showPicker = pickerColorId === color.id;
          return (
            <div
              key={color.id}
              className={`group-accordion-item ${isExpanded ? 'expanded' : 'collapsed'}`}
            >
              {/* Header — click to select/expand */}
              <div
                className="group-strip-container"
                style={{ position: 'relative' }}
                onClick={() => {
                  if (!isExpanded) {
                    onSelectColor(color.id);
                  }
                }}
              >
                {isExpanded ? (
                  /* Expanded: name + interactive swatch/hex */
                  <div className="color-header-row">
                    <span className="color-header-name" title={color.label}>{color.label}</span>
                    <SwatchHexInput
                      color={color.baseColor}
                      onChange={(hex) => onUpdateColor(color.id, { ...color, baseColor: hex })}
                      onSwatchClick={() => handleSwatchClick(color.id)}
                    />
                  </div>
                ) : (
                  /* Collapsed: name + static swatch + hex */
                  <div className="color-header-row">
                    <span className="color-header-name" title={color.label}>{color.label}</span>
                    <div
                      className="color-header-swatch"
                      style={{ backgroundColor: color.baseColor }}
                    />
                    <span className="color-header-hex">{color.baseColor.toUpperCase()}</span>
                  </div>
                )}

                {/* Color picker — fixed position to avoid clipping */}
                {isExpanded && showPicker && (
                  <>
                    <div className="popup-backdrop" onClick={() => setPickerColorId(null)} />
                    <div className="left-panel-color-picker-popup">
                      <ColorPickerPopup
                        color={color.baseColor}
                        onChange={(hex) => onUpdateColor(color.id, { ...color, baseColor: hex })}
                        onClose={() => setPickerColorId(null)}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Expanded: defaults table */}
              {isExpanded && (
                <>
                  <div className="group-accordion-separator" />
                  <div className="group-accordion-content">
                    <DefaultsTable
                      color={color}
                      onUpdate={(updates) => onUpdateColor(color.id, { ...color, ...updates })}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Add Color Button */}
        <button className="add-group-btn" onClick={onAddColor}>
          + Add Color
        </button>
      </div>
    </div>
  );
}

export const LeftPanel = React.memo(LeftPanelComponent);
