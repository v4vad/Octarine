import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

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
import { findClosestCSSColorName } from './lib/color-utils';
import { useHistory } from './lib/useHistory';
import { usePlatform } from './platform/context';

// ============================================
// MAIN APP
// ============================================
export default function App() {
  const platform = usePlatform();

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

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('octarine-theme') as 'light' | 'dark') || 'dark';
    } catch { return 'dark'; }
  });
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('octarine-theme', next); } catch {}
      return next;
    });
  }, []);

  // Track whether we've received the initial load response
  const hasLoadedRef = useRef(false);

  // Load saved state via platform adapter when component mounts
  useEffect(() => {
    let cancelled = false;
    platform.loadState().then((result) => {
      if (cancelled) return;
      hasLoadedRef.current = true;
      if (result?.state) {
        const migratedState = migrateState({ version: result.version ?? 1, state: result.state });
        replaceState(migratedState);
      }
    });
    return () => { cancelled = true; };
  }, [platform, replaceState]);

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

  // Auto-save state via platform adapter (debounced 500ms)
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const timer = setTimeout(() => {
      platform.saveState(state);
    }, 500);
    return () => clearTimeout(timer);
  }, [state, platform]);

  // ============================================
  // GLOBAL CONFIG OPERATIONS
  // ============================================
  const updateGlobalConfig = useCallback((newConfig: GlobalConfig) => {
    setState({ ...state, globalConfig: newConfig });
  }, [setState, state]);

  // ============================================
  // COLOR OPERATIONS
  // ============================================

  // Generate a unique color name, appending a number if the name is already taken
  const uniqueColorName = useCallback((baseName: string, excludeId?: string) => {
    const otherNames = colors
      .filter(c => c.id !== excludeId)
      .map(c => c.label);
    if (!otherNames.includes(baseName)) return baseName;
    let i = 2;
    while (otherNames.includes(`${baseName} ${i}`)) i++;
    return `${baseName} ${i}`;
  }, [colors]);

  const addColor = useCallback(() => {
    const id = `color-${Date.now()}`;
    const baseColor = '#0066CC';
    const cssName = findClosestCSSColorName(baseColor);
    const label = uniqueColorName(cssName);
    const newColor: Color = { ...createDefaultColor(id, label, baseColor), autoLabel: true };
    setState({ ...state, colors: [...colors, newColor] });
    setActiveColorId(id);
  }, [setState, state, colors, uniqueColorName]);

  const updateColor = useCallback((colorId: string, updatedColor: Color) => {
    const original = colors.find(c => c.id === colorId);
    if (original) {
      // If user manually edited the label, mark autoLabel as false
      if (updatedColor.label !== original.label && original.autoLabel) {
        updatedColor = { ...updatedColor, autoLabel: false };
      }
      // If base color changed and autoLabel is still true, auto-rename
      if (updatedColor.baseColor !== original.baseColor && updatedColor.autoLabel) {
        const cssName = findClosestCSSColorName(updatedColor.baseColor);
        updatedColor = { ...updatedColor, label: uniqueColorName(cssName, colorId) };
      }
    }
    setState({
      ...state,
      colors: colors.map(c => c.id === colorId ? updatedColor : c)
    });
  }, [setState, state, colors, uniqueColorName]);

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
    const cssName = findClosestCSSColorName(original.baseColor);
    const label = uniqueColorName(cssName, colorId);
    const duplicate: Color = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      label,
      autoLabel: true,
    };
    // Insert after original
    const index = colors.findIndex(c => c.id === colorId);
    const newColors = [...colors];
    newColors.splice(index + 1, 0, duplicate);
    setState({ ...state, colors: newColors });
    setActiveColorId(newId);
  }, [setState, state, colors, uniqueColorName]);

  // ============================================
  // EXPORT
  // ============================================
  const createVariables = useCallback(async (collectionName: string) => {
    try {
      await platform.exportVariables(colors, globalConfig, collectionName);
    } catch (err) {
      platform.notify(err instanceof Error ? err.message : 'Export failed');
    }
  }, [platform, colors, globalConfig]);

  return (
    <div className="app-container" data-theme={theme}>
      {/* Top Bar: Undo/Redo, Background Color, Export */}
      <TopBar
        globalConfig={globalConfig}
        onUpdateGlobalConfig={updateGlobalConfig}
        onOpenExportModal={() => setShowExportModal(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        theme={theme}
        onToggleTheme={toggleTheme}
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
          onDuplicateColor={duplicateColor}
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
            onDuplicate={() => duplicateColor(activeColor.id)}
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
