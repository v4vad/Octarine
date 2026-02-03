import React, { useState } from 'react';
import { ColorGroup, GroupSettings } from '../../lib/types';
import { ConfirmModal } from '../primitives';
import { DefaultsTable } from './DefaultsTable';

interface GroupAccordionItemProps {
  group: ColorGroup;
  backgroundColor: string;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onUpdate: (group: ColorGroup) => void;
  onDelete: () => void;
  canDelete: boolean;
}

export function GroupAccordionItem({
  group,
  backgroundColor,
  isExpanded,
  isSelected,
  onToggle,
  onUpdate,
  onDelete,
  canDelete
}: GroupAccordionItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSettingsChange = (newSettings: GroupSettings) => {
    onUpdate({ ...group, settings: newSettings });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  // Build class names based on state
  const classNames = [
    'group-accordion-item',
    isExpanded ? 'expanded' : 'collapsed',
    isSelected && !isExpanded ? 'selected' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      {/* Color strip - always visible, always clickable */}
      <div className="group-strip-container" onClick={onToggle}>
        <div className="group-color-strip">
          {group.colors.length === 0 ? (
            <div className="group-color-strip-empty">No colors</div>
          ) : (
            group.colors.map(color => (
              <div
                key={color.id}
                className="group-color-segment"
                style={{ backgroundColor: color.baseColor }}
                title={color.label}
              />
            ))
          )}
        </div>
        {canDelete && (
          <button
            className="group-delete-btn"
            onClick={handleDeleteClick}
            title="Delete group"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Content - only when expanded */}
      {isExpanded && (
        <>
          <div className="group-accordion-separator" />
          <div className="group-accordion-content">
            <DefaultsTable
              settings={group.settings}
              onUpdate={handleSettingsChange}
            />
          </div>
        </>
      )}

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
