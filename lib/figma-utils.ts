// ============================================
// FIGMA UTILITIES
// Functions for creating Figma variables from color data
// ============================================

import { Color, EffectiveSettings } from './types';
import { hexToRgb, generateColorPalette } from './color-utils';

// Structured error for better user feedback
export interface FigmaError {
  code: string;
  message: string;
  suggestion?: string;
}

// Error codes for common Figma API issues
export const FigmaErrorCodes = {
  NO_COLORS: 'NO_COLORS',
  COLLECTION_ERROR: 'COLLECTION_ERROR',
  VARIABLE_ERROR: 'VARIABLE_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

// Create a structured error with helpful message
function createFigmaError(code: string, originalError?: unknown): FigmaError {
  const errorMessage = originalError instanceof Error ? originalError.message : String(originalError);

  switch (code) {
    case FigmaErrorCodes.NO_COLORS:
      return {
        code,
        message: 'No colors to export',
        suggestion: 'Add at least one color to a group before exporting.',
      };

    case FigmaErrorCodes.COLLECTION_ERROR:
      if (errorMessage.includes('already exists')) {
        return {
          code,
          message: 'Could not create variable collection',
          suggestion: 'A collection with this name may already exist. Try renaming it in Figma.',
        };
      }
      return {
        code,
        message: 'Could not access variable collection',
        suggestion: 'Make sure you have edit access to this file.',
      };

    case FigmaErrorCodes.VARIABLE_ERROR:
      if (errorMessage.includes('name')) {
        return {
          code,
          message: 'Invalid variable name',
          suggestion: 'Check that color names don\'t contain special characters.',
        };
      }
      return {
        code,
        message: 'Could not create variable',
        suggestion: 'Try renaming the color or check for duplicate names.',
      };

    case FigmaErrorCodes.PERMISSION_ERROR:
      return {
        code,
        message: 'No permission to create variables',
        suggestion: 'You need edit access to this file. Check if the file is read-only.',
      };

    default:
      return {
        code: FigmaErrorCodes.UNKNOWN,
        message: errorMessage || 'An unexpected error occurred',
        suggestion: 'Try closing and reopening the plugin.',
      };
  }
}

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

// Result type for createFigmaVariables
export type CreateVariablesResult =
  | { success: true; created: number; updated: number }
  | { success: false; error: FigmaError };

// Main function: Create Figma variables from color data
// All colors go into a single "Octarine" collection
export async function createFigmaVariables(
  colorsWithSettings: Array<{ color: Color; settings: EffectiveSettings }>
): Promise<CreateVariablesResult> {
  // Check if there are any colors to export
  if (colorsWithSettings.length === 0) {
    return { success: false, error: createFigmaError(FigmaErrorCodes.NO_COLORS) };
  }

  let collection: VariableCollection;
  try {
    // Always use "Octarine" as the single collection name
    collection = await getOrCreateCollection('Octarine');
  } catch (error) {
    return { success: false, error: createFigmaError(FigmaErrorCodes.COLLECTION_ERROR, error) };
  }

  const modeId = collection.modes[0].modeId;  // Use the default mode

  let created = 0;
  let updated = 0;

  // Process each color using its group's settings for palette generation
  for (const { color, settings } of colorsWithSettings) {
    // Generate all stops at once with expansion and uniqueness
    const paletteResult = generateColorPalette(color, settings);

    // Create variables for each generated stop
    for (const generatedStop of paletteResult.stops) {
      // Find the original stop to get the stop number
      const stop = color.stops.find(s => s.number === generatedStop.stopNumber);
      if (!stop) continue;

      // Variable name: "ColorLabel/StopNumber" format (no group prefix)
      const variableName = `${color.label}/${stop.number}`;

      try {
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
      } catch (error) {
        return { success: false, error: createFigmaError(FigmaErrorCodes.VARIABLE_ERROR, error) };
      }
    }
  }

  return { success: true, created, updated };
}
