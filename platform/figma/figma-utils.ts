// ============================================
// FIGMA UTILITIES
// Functions for creating Figma variables from color data
// ============================================

import { Color, ColorSettings } from '../../lib/types';
import { hexToRgb, generateColorPalette } from '../../lib/color-utils';

// Convert hex color to Figma's RGBA format (values from 0-1)
function hexToFigmaRgba(hex: string, alpha?: number): RGBA {
  const rgb = hexToRgb(hex);
  return {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
    a: alpha ?? 1,
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

// Get or create a color variable using a pre-built map (O(1) lookup, no API call per stop)
function getOrCreateColorVariable(
  collection: VariableCollection,
  name: string,
  variableMap: Map<string, Variable>
): Variable {
  const key = `${collection.id}::${name}`;
  const existing = variableMap.get(key);
  if (existing) return existing;

  const variable = figma.variables.createVariable(name, collection, 'COLOR');
  variableMap.set(key, variable);
  return variable;
}

// Main function: Create Figma variables from color data
export async function createFigmaVariables(
  colors: Color[],
  backgroundColor: string,
  collectionName: string = 'Octarine'
): Promise<{ created: number; updated: number }> {
  const collection = await getOrCreateCollection(collectionName);
  const modeId = collection.modes[0].modeId;  // Use the default mode

  // Fetch all existing COLOR variables once and index by collectionId::name
  const allVariables = await figma.variables.getLocalVariablesAsync('COLOR');
  const variableMap = new Map<string, Variable>(
    allVariables.map(v => [`${v.variableCollectionId}::${v.name}`, v])
  );

  let created = 0;
  let updated = 0;

  // Process each color using its own settings for palette generation
  for (const color of colors) {
    const colorSettings: ColorSettings = {
      method: color.method,
      defaultLightness: color.defaultLightness,
      defaultContrast: color.defaultContrast,
      backgroundColor,
    };
    // Generate all stops at once with expansion and uniqueness
    const paletteResult = generateColorPalette(color, colorSettings);

    // Create variables for each generated stop
    for (const generatedStop of paletteResult.stops) {
      // Find the original stop to get the stop number
      const stop = color.stops.find((s: { number: number }) => s.number === generatedStop.stopNumber);
      if (!stop) continue;

      // Variable name: "ColorLabel/StopNumber" format (no group prefix)
      const variableName = `${color.label}/${stop.number}`;

      // Get or create the variable via the in-memory map (no API call per stop)
      const isNew = !variableMap.has(`${collection.id}::${variableName}`);
      const variable = getOrCreateColorVariable(collection, variableName, variableMap);

      // Set the color value (using the hex from palette generation, with per-color alpha)
      const figmaColor = hexToFigmaRgba(generatedStop.hex, generatedStop.alpha);
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
