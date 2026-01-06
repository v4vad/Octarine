// ============================================
// FIGMA UTILITIES
// Functions for creating Figma variables from color data
// ============================================

import { Color, GlobalSettings } from './types';
import { hexToRgb, generateColor } from './color-utils';

// Convert hex color to Figma's RGBA format (values from 0-1)
function hexToFigmaRgba(hex: string): RGBA {
  const rgb = hexToRgb(hex);
  return {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
    a: 1,
  };
}

// Get or create a variable collection with the given name
async function getOrCreateCollection(name: string): Promise<VariableCollection> {
  // Check if collection already exists
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const existing = collections.find(c => c.name === name);

  if (existing) {
    return existing;
  }

  // Create new collection
  return figma.variables.createVariableCollection(name);
}

// Get or create a color variable in a collection
async function getOrCreateColorVariable(
  collection: VariableCollection,
  name: string
): Promise<Variable> {
  // Check if variable already exists in this collection
  const existingVariables = await figma.variables.getLocalVariablesAsync('COLOR');
  const existing = existingVariables.find(
    v => v.name === name && v.variableCollectionId === collection.id
  );

  if (existing) {
    return existing;
  }

  // Create new variable
  return figma.variables.createVariable(name, collection, 'COLOR');
}

// Main function: Create Figma variables from color data
export async function createFigmaVariables(
  colors: Color[],
  globalSettings: GlobalSettings
): Promise<{ created: number; updated: number }> {
  // Get or create the collection
  const collection = await getOrCreateCollection('Octarine Colors');
  const modeId = collection.modes[0].modeId;  // Use the default mode

  let created = 0;
  let updated = 0;

  // Process each color
  for (const color of colors) {
    // Process each stop in the color
    for (const stop of color.stops) {
      // Generate the actual color value for this stop
      const mode = color.modeOverride || globalSettings.mode;
      const lightness = globalSettings.defaultLightness;
      const contrast = globalSettings.defaultContrast;

      const hexColor = generateColor(
        color.baseColor,
        String(stop.number),
        {
          lightness: stop.lightnessOverride ?? lightness[stop.number],
          contrast: stop.contrastOverride ?? contrast[stop.number],
          manualOverride: stop.manualOverride,
        },
        mode,
        lightness,
        contrast,
        globalSettings.backgroundColor
      );

      // Variable name: "Primary/500" format
      const variableName = `${color.label}/${stop.number}`;

      // Get or create the variable
      const variable = await getOrCreateColorVariable(collection, variableName);

      // Check if this is a new variable or update
      const isNew = variable.name === variableName &&
        Object.keys(variable.valuesByMode).length === 0;

      // Set the color value
      const figmaColor = hexToFigmaRgba(hexColor);
      variable.setValueForMode(modeId, figmaColor);

      if (isNew) {
        created++;
      } else {
        updated++;
      }
    }
  }

  return { created, updated };
}
