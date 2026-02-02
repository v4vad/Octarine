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

  // Color strip component - visual preview of colors in the group
  const ColorStrip = () => (
    <div className="group-color-strip">
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

  // Delete button with SVG icon
  const DeleteButton = () => (
    <button
      className="group-delete-btn"
      onClick={(e) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
      }}
      title="Delete group"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  );

  // Collapsed view: just the color strip with delete button overlay
  if (!isExpanded) {
    return (
      <div className="group-accordion-item collapsed" onClick={onToggle}>
        <div className="group-strip-container">
          <ColorStrip />
          {canDelete && <DeleteButton />}
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

  // Expanded view: color strip + separator + content (NO header row)
  return (
    <div className="group-accordion-item expanded">
      <div className="group-strip-container" onClick={onToggle}>
        <ColorStrip />
        {canDelete && <DeleteButton />}
      </div>
      <div className="group-accordion-separator" />
      <div className="group-accordion-content">
        <DefaultsTable
          settings={group.settings}
          onUpdate={handleSettingsChange}
        />
      </div>
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
