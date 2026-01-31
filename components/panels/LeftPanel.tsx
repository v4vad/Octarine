import React from 'react';
import { GlobalConfig, ColorGroup } from '../../lib/types';
import { GroupAccordionItem } from '../groups';

interface LeftPanelProps {
  globalConfig: GlobalConfig;
  groups: ColorGroup[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onUpdateGroup: (group: ColorGroup) => void;
  onAddGroup: () => void;
  onDeleteGroup: (groupId: string) => void;
}

export function LeftPanel({
  globalConfig,
  groups,
  activeGroupId,
  onSelectGroup,
  onUpdateGroup,
  onAddGroup,
  onDeleteGroup
}: LeftPanelProps) {
  return (
    <div className="left-panel">
      {/* Group Accordion */}
      <div className="group-accordion">
        {groups.map(group => (
          <GroupAccordionItem
            key={group.id}
            group={group}
            backgroundColor={globalConfig.backgroundColor}
            isExpanded={group.id === activeGroupId}
            onToggle={() => onSelectGroup(group.id)}
            onUpdate={onUpdateGroup}
            onDelete={() => onDeleteGroup(group.id)}
            canDelete={groups.length > 1}
          />
        ))}

        {/* Add Group Button */}
        <button className="add-group-btn" onClick={onAddGroup}>
          + Add Group
        </button>
      </div>
    </div>
  );
}
