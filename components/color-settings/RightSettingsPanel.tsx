import React, { useState } from 'react';
import { Color } from '../../lib/types';
import { ConfirmModal } from '../primitives';
import { ColorSettingsContent } from './ColorSettingsContent';

interface RightSettingsPanelProps {
  color: Color;
  onUpdate: (color: Color) => void;
  onDelete: () => void;
}

export function RightSettingsPanel({
  color,
  onUpdate,
  onDelete,
}: RightSettingsPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="right-settings-panel">
      <div className="right-settings-header">
        <span className="right-settings-title">{color.label} Settings</span>
      </div>

      <ColorSettingsContent
        color={color}
        onUpdate={onUpdate}
      />

      <div className="right-settings-footer">
        <button
          className="right-settings-delete"
          onClick={() => setShowDeleteConfirm(true)}
          title="Delete this color"
        >
          Delete
        </button>
      </div>

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
