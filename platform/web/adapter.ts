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
    const toast = document.createElement('div')
    toast.textContent = message
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:#fff;padding:10px 16px;border-radius:6px;font-size:13px;z-index:9999;pointer-events:none;'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
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
