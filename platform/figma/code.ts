// Octarine - Figma Color System Plugin
// This file runs in Figma's sandbox and can access the Figma API

import { createFigmaVariables } from './figma-utils';
import { Color, GlobalConfig, AppState, STORAGE_KEY, STORAGE_VERSION } from '../../lib/types';

// Discriminated union for all messages the UI can send to the plugin
type PluginMessage =
  | { type: 'close' }
  | { type: 'resize'; width: number; height: number }
  | { type: 'notify'; message: string }
  | { type: 'create-variables'; colors: Color[]; globalConfig?: GlobalConfig; collectionName?: string }
  | { type: 'save-state'; state: AppState }
  | { type: 'request-state' }
  | { type: 'get-selection-color' }

// Show the plugin UI
// The size can be adjusted later based on UI needs
figma.showUI(__html__, {
  width: 980,  // Includes always-visible 280px settings panel
  height: 500,
  themeColors: true  // Use Figma's theme colors
});

// Note: We no longer load state immediately on startup.
// Instead, we use a request/response pattern - the UI requests state
// when it's ready (after React mounts), avoiding race conditions.

// Listen for messages from the UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  // Handle different message types
  switch (msg.type) {
    case 'close':
      figma.closePlugin();
      break;

    case 'resize':
      figma.ui.resize(msg.width, msg.height);
      break;

    case 'notify':
      figma.notify(msg.message);
      break;

    case 'create-variables':
      // Create Figma variables from the color data
      // All colors from all groups go into a single "Octarine" collection
      try {
        const { colors, globalConfig, collectionName } = msg;
        const backgroundColor = globalConfig?.backgroundColor ?? '#ffffff';

        // Create all variables in a single collection
        const result = await createFigmaVariables(colors, backgroundColor, collectionName);

        // Show success notification
        const message = result.created > 0
          ? `Created ${result.created} variables, updated ${result.updated}`
          : `Updated ${result.updated} variables`;
        figma.notify(message);

        // Let the UI know it succeeded
        figma.ui.postMessage({
          type: 'variables-created',
          created: result.created,
          updated: result.updated,
        });
      } catch (error) {
        // Show error notification
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        figma.notify(`Error: ${errorMessage}`, { error: true });
      }
      break;

    case 'get-selection-color':
      // Eyedropper: get fill color from selected shape
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        figma.notify('Select a shape first');
        break;
      }
      const node = selection[0];
      if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID') {
          const r = Math.round(fill.color.r * 255);
          const g = Math.round(fill.color.g * 255);
          const b = Math.round(fill.color.b * 255);
          const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
          figma.ui.postMessage({ type: 'selection-color', color: hex });
        } else {
          figma.notify('Selected shape has no solid fill');
        }
      } else {
        figma.notify('Selected shape has no fill');
      }
      break;

    case 'save-state':
      // Save state to document storage
      const toSave = { version: STORAGE_VERSION, state: msg.state };
      figma.root.setPluginData(STORAGE_KEY, JSON.stringify(toSave));
      break;

    case 'request-state':
      // UI is ready and requesting saved state - this avoids race conditions
      // where the old push-based approach sent data before React mounted
      const savedData = figma.root.getPluginData(STORAGE_KEY);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          // Include version for migration support
          figma.ui.postMessage({
            type: 'load-state',
            state: parsed.state,
            version: parsed.version ?? 1  // Default to v1 if no version
          });
        } catch (e) {
          // Invalid data, tell UI there's nothing to load
          figma.ui.postMessage({ type: 'load-state', state: null });
        }
      } else {
        // No saved data exists
        figma.ui.postMessage({ type: 'load-state', state: null });
      }
      break;

  }
};

// Send a message to the UI when plugin loads
figma.ui.postMessage({ type: 'plugin-ready' });
