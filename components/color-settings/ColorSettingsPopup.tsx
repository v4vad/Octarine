import React, { useRef, useEffect } from 'react';
import { Color, EffectiveSettings } from '../../lib/types';
import { ColorSettingsContent } from './ColorSettingsContent';

interface ColorSettingsPopupProps {
  color: Color;
  globalSettings: EffectiveSettings;
  position: { x: number; y: number };
  onUpdate: (color: Color) => void;
  onClose: () => void;
}

export function ColorSettingsPopup({
  color,
  globalSettings,
  position,
  onUpdate,
  onClose
}: ColorSettingsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <>
      <div className="popup-backdrop" onClick={onClose} />
      <div
        ref={popupRef}
        className="color-settings-popup"
        style={{
          left: Math.min(position.x, window.innerWidth - 300),
          top: Math.min(position.y, window.innerHeight - 500),
        }}
      >
        <div className="stop-popup-header">
          <span className="stop-popup-title">{color.label} Settings</span>
          <span className="stop-popup-close" onClick={onClose}>×</span>
        </div>

        <ColorSettingsContent
          color={color}
          globalSettings={globalSettings}
          onUpdate={onUpdate}
        />
      </div>
    </>
  );
}
