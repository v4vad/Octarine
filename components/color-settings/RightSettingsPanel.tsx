import React, { useState } from 'react';
import { Color, EffectiveSettings } from '../../lib/types';
import { ConfirmModal } from '../primitives';
import { ColorSettingsContent } from './ColorSettingsContent';

interface RightSettingsPanelProps {
  color: Color;
  globalSettings: EffectiveSettings;
  onUpdate: (color: Color) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function RightSettingsPanel({
  color,
  globalSettings,
  onUpdate,
  onDelete,
  onClose
}: RightSettingsPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="right-settings-panel">
      <div className="right-settings-header">
        <span className="right-settings-title">{color.label} Settings</span>
        <div className="right-settings-actions">
          <button
            className="right-settings-delete"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete this color"
          >
            Delete
          </button>
        </div>
      </div>

      <ColorSettingsContent
        color={color}
        globalSettings={globalSettings}
        onUpdate={onUpdate}
      />

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Color"
          message={`Are you sure you want to delete "${color.label}"?`}
          onConfirm={() => {
            onDelete();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
