// ============================================
// FIGMA UTILITIES
// Functions for creating Figma variables from color data
// ============================================

import { Color, GlobalSettings } from './types';
import { hexToRgb, generateColorPalette } from './color-utils';

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

  // Process each color using palette generation (ensures expansion + uniqueness)
  for (const color of colors) {
    // Generate all stops at once with expansion and uniqueness
    const paletteResult = generateColorPalette(color, globalSettings);

    // Create variables for each generated stop
    for (const generatedStop of paletteResult.stops) {
      // Find the original stop to get the stop number
      const stop = color.stops.find(s => s.number === generatedStop.stopNumber);
      if (!stop) continue;

      // Variable name: "Primary/500" format
      const variableName = `${color.label}/${stop.number}`;

      // Get or create the variable
      const variable = await getOrCreateColorVariable(collection, variableName);

      // Check if this is a new variable or update
      const isNew = variable.name === variableName &&
        Object.keys(variable.valuesByMode).length === 0;

      // Set the color value (using the hex from palette generation)
      const figmaColor = hexToFigmaRgba(generatedStop.hex);
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
