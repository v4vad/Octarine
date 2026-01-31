import React, { useState, useMemo } from 'react';
import { ColorGroup, GroupSettings } from '../../lib/types';
import { ConfirmModal } from '../primitives';
import { DefaultsTable } from './DefaultsTable';

interface GroupAccordionItemProps {
  group: ColorGroup;
  backgroundColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (group: ColorGroup) => void;
  onDelete: () => void;
  canDelete: boolean;
}

export function GroupAccordionItem({
  group,
  backgroundColor,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  canDelete
}: GroupAccordionItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSettingsChange = (newSettings: GroupSettings) => {
    onUpdate({ ...group, settings: newSettings });
  };

  // Generate palette for each color to get base colors for strip
  const colorStripData = useMemo(() => {
    return group.colors.map(color => ({
      id: color.id,
      baseColor: color.baseColor,
      label: color.label
    }));
  }, [group.colors]);

  // Color strip component - used in both collapsed and expanded states
  const ColorStrip = () => (
    <div className="group-color-strip" onClick={onToggle}>
      {colorStripData.length === 0 ? (
        <div className="group-color-strip-empty">No colors</div>
      ) : (
        colorStripData.map(color => (
          <div
            key={color.id}
            className="group-color-segment"
            style={{ backgroundColor: color.baseColor }}
            title={color.label}
          />
        ))
      )}
    </div>
  );

  // Collapsed view: just the color strip with delete button overlay
  if (!isExpanded) {
    return (
      <div className="group-accordion-item collapsed">
        <div className="group-strip-container">
          <ColorStrip />
          {canDelete && (
            <button
              className="group-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              title="Delete group"
            >
              ×
            </button>
          )}
        </div>
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <ConfirmModal
            title="Delete Group"
            message={`Delete "${group.name || 'Untitled Group'}"? This will delete all ${group.colors.length} color(s) in this group.`}
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

  // Expanded view: color strip + separator + content
  return (
    <div className="group-accordion-item expanded">
      {/* Color strip header with delete button overlay */}
      <div className="group-strip-container">
        <ColorStrip />
        {canDelete && (
          <button
            className="group-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            title="Delete group"
          >
            ×
          </button>
        )}
      </div>

      {/* Separator line */}
      <div className="group-accordion-separator" />

      {/* Expanded content: settings only */}
      <div className="group-accordion-content">
        {/* Defaults Table (includes Method Toggle) */}
        <DefaultsTable
          settings={group.settings}
          onUpdate={handleSettingsChange}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Group"
          message={`Delete "${group.name || 'Untitled Group'}"? This will delete all ${group.colors.length} color(s) in this group.`}
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
