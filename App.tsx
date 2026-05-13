import React, { useState, useEffect, useRef, useMemo, useCallback, startTransition, useDeferredValue } from 'react';

import {
  Color,
  GlobalConfig,
  ColorSettings,
  AppState,
  createDefaultColor,
  createInitialAppState,
  migrateState,
} from './lib/types';
import { FrameworkPreset } from './lib/framework-presets';

import { TopBar, LeftPanel, ResizeHandle, ViewModeToggle } from './components/panels';
import { RightSettingsPanel } from './components/color-settings';
import { ColorRow } from './components/colors';
import { ExportModal } from './components/export';
import { findClosestCSSColorName } from './lib/color-utils';
import { useHistory } from './lib/useHistory';
import { usePlatform } from './platform/context';

// Pure helper — no closure deps, can be called from inside functional setState
function makeUniqueColorName(colors: Color[], baseName: string, excludeId?: string): string {
  const otherNames = colors.filter(c => c.id !== excludeId).map(c => c.label)
  if (!otherNames.includes(baseName)) return baseName
  let i = 2
  while (otherNames.includes(`${baseName} ${i}`)) i++
  return `${baseName} ${i}`
}

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

  // Track middle panel view mode: show selected color or all colors
  const [viewMode, setViewMode] = useState<'all' | 'selected'>('selected');

  // Get the active color object — memoized so it only changes when colors or selection changes
  const activeColor = useMemo(
    () => (activeColorId ? colors.find(c => c.id === activeColorId) ?? null : null),
    [colors, activeColorId]
  );

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

  // Deferred active color: ColorRow uses this so its expensive palette render
  // is skipped during rapid slider drags (receives stale value → memo bailout)
  const deferredActiveColor = useDeferredValue(activeColor);
  const deferredColorSettings = useDeferredValue(activeColorSettings);

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
    setState(prev => ({ ...prev, globalConfig: newConfig }));
  }, [setState]);

  // ============================================
  // COLOR OPERATIONS
  // ============================================

  const addColor = useCallback(() => {
    const id = `color-${Date.now()}`;
    setState(prev => {
      const baseColor = '#0066CC';
      const cssName = findClosestCSSColorName(baseColor);
      const label = makeUniqueColorName(prev.colors, cssName);
      const newColor: Color = { ...createDefaultColor(id, label, baseColor), autoLabel: true };
      return { ...prev, colors: [...prev.colors, newColor] };
    });
    setActiveColorId(id);
  }, [setState]);

  // Marked as startTransition — the palette recompute is non-urgent so React can
  // interrupt and batch rapid drag events before committing the swatch re-render.
  const updateColor = useCallback((colorId: string, updatedColor: Color) => {
    startTransition(() => {
      setState(prev => {
        const original = prev.colors.find(c => c.id === colorId);
        if (original) {
          if (updatedColor.label !== original.label && original.autoLabel) {
            updatedColor = { ...updatedColor, autoLabel: false };
          }
          if (updatedColor.baseColor !== original.baseColor && updatedColor.autoLabel) {
            const cssName = findClosestCSSColorName(updatedColor.baseColor);
            updatedColor = { ...updatedColor, label: makeUniqueColorName(prev.colors, cssName, colorId) };
          }
        }
        return {
          ...prev,
          colors: prev.colors.map(c => c.id === colorId ? updatedColor : c)
        };
      });
    });
  }, [setState]);

  const removeColor = useCallback((colorId: string) => {
    setState(prev => ({
      ...prev,
      colors: prev.colors.filter(c => c.id !== colorId)
    }));
    // Clear active selection if removing the active color; useEffect will re-select
    setActiveColorId(prev => prev === colorId ? null : prev);
  }, [setState]);

  const duplicateColor = useCallback((colorId: string) => {
    const id = `color-${Date.now()}`;
    setState(prev => {
      const original = prev.colors.find(c => c.id === colorId);
      if (!original) return prev;
      const cssName = findClosestCSSColorName(original.baseColor);
      const label = makeUniqueColorName(prev.colors, cssName, colorId);
      const duplicate: Color = {
        ...JSON.parse(JSON.stringify(original)),
        id,
        label,
        autoLabel: true,
      };
      const index = prev.colors.findIndex(c => c.id === colorId);
      const newColors = [...prev.colors];
      newColors.splice(index + 1, 0, duplicate);
      return { ...prev, colors: newColors };
    });
    setActiveColorId(id);
  }, [setState]);

  // ============================================
  // STABLE CALLBACKS FOR MIDDLE PANEL (ColorRow)
  // These depend on activeColorId (primitive), not activeColor (object).
  // They change only when the user switches which color is selected.
  // ============================================
  const updateActiveColor = useCallback((updatedColor: Color) => {
    updateColor(activeColorId!, updatedColor);
  }, [updateColor, activeColorId]);

  const removeActiveColor = useCallback(() => {
    removeColor(activeColorId!);
  }, [removeColor, activeColorId]);

  const duplicateActiveColor = useCallback(() => {
    duplicateColor(activeColorId!);
  }, [duplicateColor, activeColorId]);

  const loadPreset = useCallback((preset: FrameworkPreset) => {
    const id = `color-${Date.now()}`;
    setState(prev => {
      const colors = preset.colors.map((pc, i) => ({
        ...createDefaultColor(`${id}-${i}`, pc.label, pc.baseColor),
        autoLabel: false,
      }));
      return { ...prev, colors };
    });
    setActiveColorId(`${id}-0`);
  }, [setState]);

  // RightSettingsPanel: color.id comes from the argument, no activeColorId closure needed
  const updateColorById = useCallback((updatedColor: Color) => {
    updateColor(updatedColor.id, updatedColor);
  }, [updateColor]);

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
        onLoadPreset={loadPreset}
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
          backgroundColor={globalConfig.backgroundColor}
        />

        {/* Middle Panel: Swatches — all colors or selected color */}
        <div className="middle-panel">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          {viewMode === 'selected' ? (
            !deferredActiveColor || !deferredColorSettings ? (
              <p className="empty-state p-4">Add a color to get started.</p>
            ) : (
              <ColorRow
                color={deferredActiveColor}
                colorSettings={deferredColorSettings}
                onUpdate={updateActiveColor}
                onRemove={removeActiveColor}
                onDuplicate={duplicateActiveColor}
              />
            )
          ) : (
            colors.length === 0 ? (
              <p className="empty-state p-4">Add a color to get started.</p>
            ) : (
              colors.map(color => {
                const colorSettings: ColorSettings = {
                  method: color.method,
                  defaultLightness: color.defaultLightness,
                  defaultContrast: color.defaultContrast,
                  backgroundColor: globalConfig.backgroundColor,
                };
                return (
                  <ColorRow
                    key={color.id}
                    color={color}
                    colorSettings={colorSettings}
                    onUpdate={(updated) => updateColor(color.id, updated)}
                    onRemove={() => removeColor(color.id)}
                    onDuplicate={() => duplicateColor(color.id)}
                    onActivate={() => setActiveColorId(color.id)}
                  />
                );
              })
            )
          )}
        </div>

        {/* Right Settings Panel (per-color advanced settings) */}
        {activeColor ? (
          <RightSettingsPanel
            color={activeColor}
            onUpdate={updateColorById}
            onDelete={removeActiveColor}
            onDuplicate={duplicateActiveColor}
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
