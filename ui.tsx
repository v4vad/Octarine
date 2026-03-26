import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import 'react-figma-plugin-ds/figma-plugin-ds.css';
import './styles.css';

import {
  Color,
  GlobalConfig,
  ColorSettings,
  AppState,
  createDefaultColor,
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
  const { globalConfig, colors } = state;

  // Track which color is selected (local state, not part of undo history)
  const [activeColorId, setActiveColorId] = useState<string | null>(null);

  // Track export modal visibility
  const [showExportModal, setShowExportModal] = useState(false);

  // Get the active color object
  const activeColor = activeColorId
    ? colors.find(c => c.id === activeColorId) ?? null
    : null;

  // Build ColorSettings for the active color (for palette generation)
  const activeColorSettings: ColorSettings | null = useMemo(() => {
    if (!activeColor) return null;
    return {
      method: activeColor.method,
      defaultLightness: activeColor.defaultLightness,
      defaultContrast: activeColor.defaultContrast,
      backgroundColor: globalConfig.backgroundColor,
    };
  }, [activeColor, globalConfig.backgroundColor]);

  // Auto-select first color if none selected or selection is invalid
  useEffect(() => {
    if (colors.length > 0 && (!activeColorId || !colors.find(c => c.id === activeColorId))) {
      setActiveColorId(colors[0].id);
    } else if (colors.length === 0) {
      setActiveColorId(null);
    }
  }, [colors, activeColorId]);

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
  // COLOR OPERATIONS
  // ============================================
  const addColor = useCallback(() => {
    const id = `color-${Date.now()}`;
    const label = `Color ${colors.length + 1}`;
    const baseColor = '#0066CC';
    const newColor = createDefaultColor(id, label, baseColor);
    setState({ ...state, colors: [...colors, newColor] });
    setActiveColorId(id);
  }, [setState, state, colors]);

  const updateColor = useCallback((colorId: string, updatedColor: Color) => {
    setState({
      ...state,
      colors: colors.map(c => c.id === colorId ? updatedColor : c)
    });
  }, [setState, state, colors]);

  const removeColor = useCallback((colorId: string) => {
    const newColors = colors.filter(c => c.id !== colorId);
    setState({ ...state, colors: newColors });
    // Auto-select adjacent color
    if (colorId === activeColorId) {
      const oldIndex = colors.findIndex(c => c.id === colorId);
      const newActiveId = newColors[Math.min(oldIndex, newColors.length - 1)]?.id ?? null;
      setActiveColorId(newActiveId);
    }
  }, [setState, state, colors, activeColorId]);

  const duplicateColor = useCallback((colorId: string) => {
    const original = colors.find(c => c.id === colorId);
    if (!original) return;
    const newId = `color-${Date.now()}`;
    const duplicate: Color = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      label: `${original.label} copy`,
    };
    // Insert after original
    const index = colors.findIndex(c => c.id === colorId);
    const newColors = [...colors];
    newColors.splice(index + 1, 0, duplicate);
    setState({ ...state, colors: newColors });
    setActiveColorId(newId);
  }, [setState, state, colors]);

  // ============================================
  // EXPORT
  // ============================================
  const createVariables = (collectionName: string) => {
    parent.postMessage(
      {
        pluginMessage: {
          type: 'create-variables',
          colors,
          globalConfig,
          collectionName,
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
        {/* Left Panel: Color list + settings for selected color */}
        <LeftPanel
          colors={colors}
          activeColorId={activeColorId}
          onSelectColor={setActiveColorId}
          onUpdateColor={updateColor}
          onAddColor={addColor}
        />

        {/* Middle Panel: Swatches for selected color */}
        <div className="middle-panel">
          {!activeColor || !activeColorSettings ? (
            <p className="empty-state p-4">Add a color to get started.</p>
          ) : (
            <ColorRow
              color={activeColor}
              colorSettings={activeColorSettings}
              onUpdate={(updatedColor) => updateColor(activeColor.id, updatedColor)}
              onRemove={() => removeColor(activeColor.id)}
              onDuplicate={() => duplicateColor(activeColor.id)}
            />
          )}
        </div>

        {/* Right Settings Panel (per-color advanced settings) */}
        {activeColor ? (
          <RightSettingsPanel
            color={activeColor}
            onUpdate={(updatedColor) => updateColor(updatedColor.id, updatedColor)}
            onDelete={() => removeColor(activeColor.id)}
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
          colors={colors}
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
