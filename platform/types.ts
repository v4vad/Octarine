/**
 * Platform adapter abstraction for Octarine.
 *
 * This interface decouples the React app from Figma's iframe messaging,
 * allowing the same UI to run inside Figma or standalone in a browser.
 */

import type { Color, GlobalConfig, AppState } from '../lib/types';

/** Declares which platform-specific features are available. */
export interface PlatformCapabilities {
  canExportVariables: boolean;
  canPickColor: boolean;
  canResize: boolean;
}

/** Result of exporting colors to the platform's variable system. */
export interface ExportResult {
  created: number;
  updated: number;
}

/**
 * Contract that every platform adapter must implement.
 *
 * The React app calls these methods instead of `parent.postMessage()` directly.
 * Each platform (Figma, web, etc.) provides its own implementation.
 */
export interface PlatformAdapter {
  readonly capabilities: PlatformCapabilities;

  // — State persistence —
  /** Load saved state. Returns null if no state exists or on error. */
  loadState(): Promise<{ version: number; state: unknown } | null>;
  /** Save state. Fire-and-forget — debouncing is the caller's responsibility. */
  saveState(state: AppState): void;

  // — Platform actions —
  /** Show a notification/toast to the user. */
  notify(message: string): void;
  /** Resize the plugin window (no-op on platforms that don't support it). */
  resize(width: number, height: number): void;

  // — Features guarded by capabilities —
  /** Pick a color from the canvas/selection. Returns hex or null. */
  pickColor(): Promise<string | null>;
  /** Export colors as platform variables. */
  exportVariables(
    colors: Color[],
    globalConfig: GlobalConfig,
    collectionName: string
  ): Promise<ExportResult>;

  // — Lifecycle —
  /** Register a callback for when the platform is ready. */
  onReady(callback: () => void): void;
  /** Cleanup listeners, timers, etc. */
  destroy(): void;
}
