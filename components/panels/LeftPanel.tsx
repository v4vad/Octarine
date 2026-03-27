import React, { useState } from 'react';
import { Color } from '../../lib/types';
import { DefaultsTable } from '../groups';
import { SwatchHexInput } from '../primitives';
import { ColorPickerPopup } from '../color-picker';

interface LeftPanelProps {
  colors: Color[];
  activeColorId: string | null;
  onSelectColor: (colorId: string) => void;
  onUpdateColor: (colorId: string, color: Color) => void;
  onAddColor: () => void;
  onDuplicateColor: (colorId: string) => void;
  onDeleteColor: (colorId: string) => void;
}

export function LeftPanel({
  colors,
  activeColorId,
  onSelectColor,
  onUpdateColor,
  onAddColor,
  onDuplicateColor,
  onDeleteColor,
}: LeftPanelProps) {
  const [pickerColorId, setPickerColorId] = useState<string | null>(null);
  const [menuColorId, setMenuColorId] = useState<string | null>(null);

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
          const showMenu = menuColorId === color.id;
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
                  /* Expanded: name + interactive swatch/hex + overflow menu */
                  <div className="color-header-row">
                    <span className="color-header-name" title={color.label}>{color.label}</span>
                    <SwatchHexInput
                      color={color.baseColor}
                      onChange={(hex) => onUpdateColor(color.id, { ...color, baseColor: hex })}
                      onSwatchClick={() => handleSwatchClick(color.id)}
                    />
                    <button
                      className="overflow-menu-btn"
                      onClick={(e) => { e.stopPropagation(); setMenuColorId(showMenu ? null : color.id); }}
                      title="More actions"
                    >&#x22EE;</button>
                  </div>
                ) : (
                  /* Collapsed: name + static swatch + hex + overflow menu */
                  <div className="color-header-row">
                    <span className="color-header-name" title={color.label}>{color.label}</span>
                    <div
                      className="color-header-swatch"
                      style={{ backgroundColor: color.baseColor }}
                    />
                    <span className="color-header-hex">{color.baseColor.toUpperCase()}</span>
                    <button
                      className="overflow-menu-btn"
                      onClick={(e) => { e.stopPropagation(); setMenuColorId(showMenu ? null : color.id); }}
                      title="More actions"
                    >&#x22EE;</button>
                  </div>
                )}

                {/* Overflow menu dropdown */}
                {showMenu && (
                  <>
                    <div className="popup-backdrop" onClick={() => setMenuColorId(null)} />
                    <div className="overflow-menu-dropdown">
                      <button
                        className="overflow-menu-item"
                        onClick={(e) => { e.stopPropagation(); onDuplicateColor(color.id); setMenuColorId(null); }}
                      >Duplicate</button>
                      <button
                        className="overflow-menu-item overflow-menu-item-danger"
                        onClick={(e) => { e.stopPropagation(); onDeleteColor(color.id); setMenuColorId(null); }}
                      >Delete</button>
                    </div>
                  </>
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
