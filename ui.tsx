import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import 'react-figma-plugin-ds/figma-plugin-ds.css';
import './styles.css';

import {
  Color,
  GlobalConfig,
  EffectiveSettings,
  ColorGroup,
  AppState,
  createDefaultColor,
  createDefaultGroupSettings,
  createDefaultGroup,
  createInitialAppState,
  migrateState,
} from './lib/types';

import { TopBar, LeftPanel, ResizeHandle } from './components/panels';
import { RightSettingsPanel } from './components/color-settings';
import { ColorRow } from './components/colors';
import { ExportModal } from './components/export';

import { useHistory } from './lib/useHistory';

// ============================================
// MAIN APP
// ============================================
function App() {
  // Use history hook for undo/redo support
  const initialState: AppState = createInitialAppState();
  const { state, setState, replaceState, undo, redo, canUndo, canRedo } = useHistory(initialState);
  const { globalConfig, groups, activeGroupId } = state;

  // Get the active group
  const activeGroup = activeGroupId
    ? groups.find(g => g.id === activeGroupId)
    : groups[0];

  // Get colors from active group
  const activeGroupColors = activeGroup?.colors ?? [];

  // Track which color's settings panel is open (null = none)
  const [activeSettingsColorId, setActiveSettingsColorId] = useState<string | null>(null);

  // Track export modal visibility
  const [showExportModal, setShowExportModal] = useState(false);

  // Get the color object for the active settings panel
  const activeSettingsColor = activeSettingsColorId
    ? activeGroupColors.find(c => c.id === activeSettingsColorId)
    : null;

  // Create merged settings that combines group settings with global backgroundColor
  // This allows existing components to use globalSettings.backgroundColor
  const mergedSettings: EffectiveSettings = useMemo(() => {
    if (!activeGroup) return { ...createDefaultGroupSettings(), backgroundColor: globalConfig.backgroundColor };
    return {
      ...activeGroup.settings,
      backgroundColor: globalConfig.backgroundColor
    };
  }, [activeGroup, globalConfig.backgroundColor]);

  // Auto-select first group if none selected
  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) {
      setState({ globalConfig, groups, activeGroupId: groups[0].id });
    }
  }, [groups, activeGroupId, globalConfig, setState]);

  // Auto-select first color in active group when group changes
  useEffect(() => {
    if (activeGroupColors.length > 0 && !activeSettingsColor) {
      setActiveSettingsColorId(activeGroupColors[0].id);
    } else if (activeGroupColors.length === 0) {
      setActiveSettingsColorId(null);
    }
  }, [activeGroup?.id, activeGroupColors.length, activeSettingsColor]);

  // Track whether we've received the initial load response
  const hasLoadedRef = useRef(false);

  // Request saved state when component mounts
  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'request-state' } }, '*');
  }, []);

  // Listen for messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'plugin-ready') {
        console.log('Plugin ready');
      }

      // Handle load-state response with migration
      if (msg.type === 'load-state') {
        hasLoadedRef.current = true;
        if (msg.state) {
          // Migrate old format if needed
          const migratedState = migrateState({ version: msg.version ?? 1, state: msg.state });
          replaceState(migratedState);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [replaceState]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Auto-save state to document storage (debounced)
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const timer = setTimeout(() => {
      parent.postMessage({ pluginMessage: { type: 'save-state', state } }, '*');
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  // ============================================
  // GLOBAL CONFIG OPERATIONS
  // ============================================
  const updateGlobalConfig = useCallback((newConfig: GlobalConfig) => {
    setState({ ...state, globalConfig: newConfig });
  }, [setState, state]);

  // ============================================
  // GROUP OPERATIONS
  // ============================================
  const selectGroup = useCallback((groupId: string) => {
    setState({ ...state, activeGroupId: groupId });
    // Clear color selection when switching groups
    setActiveSettingsColorId(null);
  }, [setState, state]);

  const addGroup = useCallback(() => {
    const id = `group-${Date.now()}`;
    const newGroup = createDefaultGroup(id, '');
    setState({
      globalConfig,
      groups: [...groups, newGroup],
      activeGroupId: id  // Switch to the new group
    });
    setActiveSettingsColorId(null);
  }, [setState, groups, globalConfig]);

  const updateGroup = useCallback((updatedGroup: ColorGroup) => {
    setState({
      ...state,
      groups: groups.map(g => g.id === updatedGroup.id ? updatedGroup : g)
    });
  }, [setState, state, groups]);

  const deleteGroup = useCallback((groupId: string) => {
    if (groups.length <= 1) return;  // Don't delete last group
    const newGroups = groups.filter(g => g.id !== groupId);
    const newActiveId = activeGroupId === groupId ? newGroups[0]?.id ?? null : activeGroupId;
    setState({
      globalConfig,
      groups: newGroups,
      activeGroupId: newActiveId
    });
    setActiveSettingsColorId(null);
  }, [setState, groups, activeGroupId, globalConfig]);

  // ============================================
  // COLOR OPERATIONS (within active group)
  // ============================================
  const addColor = useCallback(() => {
    if (!activeGroup) return;
    const id = `color-${Date.now()}`;
    // Count total colors across ALL groups for globally unique naming
    const totalColors = groups.reduce((sum, g) => sum + g.colors.length, 0);
    const label = `Color ${totalColors + 1}`;
    const baseColor = '#0066CC';
    const newColor = createDefaultColor(id, label, baseColor);
    updateGroup({
      ...activeGroup,
      colors: [...activeGroup.colors, newColor]
    });
    setActiveSettingsColorId(id);
  }, [activeGroup, updateGroup, groups]);

  const updateColor = useCallback((colorId: string, updatedColor: Color) => {
    if (!activeGroup) return;
    updateGroup({
      ...activeGroup,
      colors: activeGroup.colors.map(c => c.id === colorId ? updatedColor : c)
    });
  }, [activeGroup, updateGroup]);

  const removeColor = useCallback((colorId: string) => {
    if (!activeGroup) return;
    if (colorId === activeSettingsColorId) {
      setActiveSettingsColorId(null);
    }
    updateGroup({
      ...activeGroup,
      colors: activeGroup.colors.filter(c => c.id !== colorId)
    });
  }, [activeGroup, updateGroup, activeSettingsColorId]);

  // ============================================
  // EXPORT
  // ============================================
  const createVariables = (collectionName: string) => {
    parent.postMessage(
      {
        pluginMessage: {
          type: 'create-variables',
          groups,  // Send all groups for export
          globalConfig,  // Send global config for background color
          collectionName,  // Custom collection name
        },
      },
      '*'
    );
  };

  return (
    <div className="app-container">
      {/* Top Bar: Undo/Redo, Background Color, Export */}
      <TopBar
        globalConfig={globalConfig}
        onUpdateGlobalConfig={updateGlobalConfig}
        onOpenExportModal={() => setShowExportModal(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* Main Three-Panel Layout */}
      <div className="app-layout">
        {/* Left Panel: Groups only */}
        <LeftPanel
          globalConfig={globalConfig}
          groups={groups}
          activeGroupId={activeGroupId}
          onSelectGroup={selectGroup}
          onUpdateGroup={updateGroup}
          onAddGroup={addGroup}
          onDeleteGroup={deleteGroup}
        />

        {/* Middle Panel: Colors for active group */}
        <div className="middle-panel">
          {!activeGroup ? (
            <p className="empty-state p-4">Select a group to see its colors.</p>
          ) : activeGroupColors.length === 0 ? (
            <p className="empty-state p-4">No colors in this group. Add one to get started.</p>
          ) : (
            activeGroupColors.map((color) => (
              <ColorRow
                key={color.id}
                color={color}
                globalSettings={mergedSettings}
                onUpdate={(c) => updateColor(color.id, c)}
                onRemove={() => removeColor(color.id)}
                onOpenSettings={() => {
                  setActiveSettingsColorId(
                    activeSettingsColorId === color.id ? null : color.id
                  );
                }}
                isSettingsOpen={activeSettingsColorId === color.id}
              />
            ))
          )}

          {/* Add Color Button (only if a group is selected) */}
          {activeGroup && (
            <button onClick={addColor} className="add-color-btn">
              + Add Color
            </button>
          )}
        </div>

        {/* Right Settings Panel (per-color settings) */}
        {activeSettingsColor ? (
          <RightSettingsPanel
            color={activeSettingsColor}
            globalSettings={mergedSettings}
            onUpdate={(updatedColor) => updateColor(updatedColor.id, updatedColor)}
            onDelete={() => removeColor(activeSettingsColorId!)}
            onClose={() => setActiveSettingsColorId(null)}
          />
        ) : (
          <div className="right-panel-empty">
            <p>Add a color to see settings</p>
          </div>
        )}
      </div>

      {/* Resize handle for plugin window */}
      <ResizeHandle />

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          groups={groups}
          globalConfig={globalConfig}
          onExportToFigma={createVariables}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
