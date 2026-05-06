import React, { useState } from 'react';
import { Color } from '../../lib/types';
import { DefaultsTable } from './DefaultsTable';
import { SwatchHexInput } from '../primitives';
import { ColorPickerPopup } from '../color-picker';

interface LeftPanelProps {
  colors: Color[];
  activeColorId: string | null;
  onSelectColor: (colorId: string) => void;
  onUpdateColor: (colorId: string, color: Color) => void;
  onAddColor: () => void;
}

function buildSwatchStyle(hex: string, alpha?: number): React.CSSProperties {
  if (alpha !== undefined && alpha < 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` };
  }
  return { backgroundColor: hex };
}

function LeftPanelComponent({
  colors,
  activeColorId,
  onSelectColor,
  onUpdateColor,
  onAddColor,
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
                      alpha={color.alpha}
                    />
                  </div>
                ) : (
                  /* Collapsed: name + static swatch + hex */
                  <div className="color-header-row">
                    <span className="color-header-name" title={color.label}>{color.label}</span>
                    <div
                      className={`color-header-swatch${color.alpha !== undefined && color.alpha < 1 ? ' swatch-alpha' : ''}`}
                      style={buildSwatchStyle(color.baseColor, color.alpha)}
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
                        alpha={color.alpha}
                        onAlphaChange={(a) => onUpdateColor(color.id, { ...color, alpha: a < 1 ? a : undefined })}
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
