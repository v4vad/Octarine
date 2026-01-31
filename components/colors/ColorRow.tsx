import React, { useState, useMemo } from 'react';
import { Color, EffectiveSettings, Stop } from '../../lib/types';
import {
  hexToOklch,
  oklchToHex,
  generateColorPalette,
  getContrastRatio
} from '../../lib/color-utils';
import { ColorPickerPopup } from '../color-picker';

interface ColorRowProps {
  color: Color;
  globalSettings: EffectiveSettings;
  onUpdate: (color: Color) => void;
  onRemove: () => void;
  onOpenSettings: () => void;
  isSettingsOpen: boolean;
}

export function ColorRow({
  color,
  globalSettings,
  onUpdate,
  onRemove,
  onOpenSettings,
  isSettingsOpen
}: ColorRowProps) {
  const [selectedStop, setSelectedStop] = useState<{
    index: number;
    position: { x: number; y: number };
  } | null>(null);

  // Generate palette
  const paletteResult = useMemo(() => {
    return generateColorPalette(color, globalSettings);
  }, [color, globalSettings]);

  const handleStopClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setSelectedStop({
      index,
      position: { x: rect.left, y: rect.bottom + 8 },
    });
  };

  const handleRowClick = () => {
    setSelectedStop(null);
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
                title={isTooSimilar && i > 0 ? `This color looks very similar to stop ${color.stops[i - 1].number} — they may be hard to tell apart` : undefined}
              >
                {isTooSimilar && (
                  <span className="similarity-warning" title={i > 0 ? `This color looks very similar to stop ${color.stops[i - 1].number} — they may be hard to tell apart` : undefined}>
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
