import React, { useState, useRef } from 'react';
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
}

export function LeftPanel({
  colors,
  activeColorId,
  onSelectColor,
  onUpdateColor,
  onAddColor,
  onDuplicateColor,
}: LeftPanelProps) {
  const [pickerColorId, setPickerColorId] = useState<string | null>(null);
  const [pickerOpenUpward, setPickerOpenUpward] = useState(false);
  const headerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleSwatchClick = (colorId: string) => {
    if (pickerColorId === colorId) {
      setPickerColorId(null);
      return;
    }
    // Calculate if picker should open upward
    const el = headerRefs.current[colorId];
    if (el) {
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setPickerOpenUpward(spaceBelow < 380);
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
                ref={(el) => { headerRefs.current[color.id] = el; }}
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
                    <button
                      className="duplicate-btn"
                      onClick={(e) => { e.stopPropagation(); onDuplicateColor(color.id); }}
                      title="Duplicate color"
                    >&#x29C9;</button>
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
                    <button
                      className="duplicate-btn"
                      onClick={(e) => { e.stopPropagation(); onDuplicateColor(color.id); }}
                      title="Duplicate color"
                    >&#x29C9;</button>
                    <div
                      className="color-header-swatch"
                      style={{ backgroundColor: color.baseColor }}
                    />
                    <span className="color-header-hex">{color.baseColor.toUpperCase()}</span>
                  </div>
                )}

                {/* Color picker — positioned relative to header */}
                {isExpanded && showPicker && (
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
                      onChange={(hex) => onUpdateColor(color.id, { ...color, baseColor: hex })}
                      onClose={() => setPickerColorId(null)}
                    />
                  </div>
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
