/**
 * Web platform adapter.
 *
 * Uses localStorage for state persistence and no-ops/fallbacks for
 * Figma-specific features. This validates the platform abstraction
 * works outside of Figma.
 */

import type { PlatformAdapter, PlatformCapabilities, ExportResult } from '../types';
import type { Color, GlobalConfig, AppState } from '../../lib/types';
import { STORAGE_VERSION } from '../../lib/types';

const WEB_STORAGE_KEY = 'octarine-state';

export class WebAdapter implements PlatformAdapter {
  readonly capabilities: PlatformCapabilities = {
    canExportVariables: false,
    canPickColor: false,
    canResize: false,
  };

  async loadState(): Promise<{ version: number; state: unknown } | null> {
    const raw = localStorage.getItem(WEB_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null; // Corrupted data — start fresh
    }
  }

  saveState(state: AppState): void {
    localStorage.setItem(
      WEB_STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, state })
    );
  }

  notify(message: string): void {
    console.log('[Octarine]', message);
  }

  resize(_width: number, _height: number): void {
    // No-op on web
  }

  async pickColor(): Promise<string | null> {
    return null;
  }

  async exportVariables(
    _colors: Color[],
    _globalConfig: GlobalConfig,
    _collectionName: string
  ): Promise<ExportResult> {
    // Defensive failsafe — UI should hide the button via capabilities
    throw new Error('Variable export is not supported on web');
  }

  onReady(callback: () => void): void {
    // Web is immediately ready
    callback();
  }

  destroy(): void {
    // Nothing to clean up
  }
}
