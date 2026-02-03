import React from 'react';
import { GlobalConfig, ColorGroup } from '../../lib/types';
import { GroupAccordionItem } from '../groups';

interface LeftPanelProps {
  globalConfig: GlobalConfig;
  groups: ColorGroup[];
  activeGroupId: string | null;
  expandedGroupId: string | null;
  onToggleExpansion: (groupId: string) => void;
  onUpdateGroup: (group: ColorGroup) => void;
  onAddGroup: () => void;
  onDeleteGroup: (groupId: string) => void;
}

export function LeftPanel({
  globalConfig,
  groups,
  activeGroupId,
  expandedGroupId,
  onToggleExpansion,
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
            isExpanded={group.id === expandedGroupId}
            isSelected={group.id === activeGroupId}
            onToggle={() => onToggleExpansion(group.id)}
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
