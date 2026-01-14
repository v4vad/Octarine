// Octarine - Figma Color System Plugin
// This file runs in Figma's sandbox and can access the Figma API

import { createFigmaVariables } from './lib/figma-utils';
import { Color, GlobalSettings } from './lib/types';

// Show the plugin UI
// The size can be adjusted later based on UI needs
figma.showUI(__html__, {
  width: 700,
  height: 500,
  themeColors: true  // Use Figma's theme colors
});

// Listen for messages from the UI
figma.ui.onmessage = async (msg: { type: string; [key: string]: unknown }) => {
  // Handle different message types
  switch (msg.type) {
    case 'close':
      figma.closePlugin();
      break;

    case 'resize':
      // Resize the plugin window (UI can request this)
      figma.ui.resize(msg.width as number, msg.height as number);
      break;

    case 'notify':
      // Show a notification in Figma
      figma.notify(msg.message as string);
      break;

    case 'create-variables':
      // Create Figma variables from the color data
      try {
        const colors = msg.colors as Color[];
        const globalSettings = msg.globalSettings as GlobalSettings;

        const result = await createFigmaVariables(colors, globalSettings);

        // Show success notification
        const message = result.created > 0
          ? `Created ${result.created} variables, updated ${result.updated}`
          : `Updated ${result.updated} variables`;
        figma.notify(message);

        // Let the UI know it succeeded
        figma.ui.postMessage({
          type: 'variables-created',
          ...result,
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

    default:
      console.log('Unknown message type:', msg.type);
  }
};

// Send a message to the UI when plugin loads
figma.ui.postMessage({ type: 'plugin-ready' });
