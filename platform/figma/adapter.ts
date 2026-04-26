/**
 * Figma platform adapter.
 *
 * Wraps Figma's parent.postMessage / window.addEventListener('message')
 * pattern into the PlatformAdapter interface. Each request/response pair
 * becomes a promise with a timeout to prevent hangs.
 */

import type { PlatformAdapter, PlatformCapabilities, ExportResult } from '../types';
import type { Color, GlobalConfig, AppState } from '../../lib/types';

export class FigmaAdapter implements PlatformAdapter {
  readonly capabilities: PlatformCapabilities = {
    canExportVariables: true,
    canPickColor: true,
    canResize: true,
  };

  private listeners: Array<() => void> = [];

  /**
   * Wrap a postMessage request/response pair in a promise with timeout.
   * On timeout, resolves with null so the app can degrade gracefully.
   */
  private requestFromPlugin<T>(
    sendType: string,
    responseType: string,
    payload?: Record<string, unknown>,
    timeoutMs = 5000
  ): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, timeoutMs);

      const handler = (event: MessageEvent) => {
        if (event.data.pluginMessage?.type === responseType) {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve(event.data.pluginMessage);
        }
      };
      window.addEventListener('message', handler);
      parent.postMessage({ pluginMessage: { type: sendType, ...payload } }, '*');
    });
  }

  async loadState(): Promise<{ version: number; state: unknown } | null> {
    return this.requestFromPlugin('request-state', 'load-state');
  }

  saveState(state: AppState): void {
    parent.postMessage({ pluginMessage: { type: 'save-state', state } }, '*');
  }

  notify(message: string): void {
    parent.postMessage({ pluginMessage: { type: 'notify', message } }, '*');
  }

  resize(width: number, height: number): void {
    parent.postMessage({ pluginMessage: { type: 'resize', width, height } }, '*');
  }

  async pickColor(): Promise<string | null> {
    const result = await this.requestFromPlugin<{ color: string }>(
      'get-selection-color',
      'selection-color'
    );
    return result?.color ?? null;
  }

  async exportVariables(
    colors: Color[],
    globalConfig: GlobalConfig,
    collectionName: string
  ): Promise<ExportResult> {
    const result = await this.requestFromPlugin<ExportResult>(
      'create-variables',
      'variables-created',
      { colors, globalConfig, collectionName },
      30000 // longer timeout for potentially slow variable creation
    );
    if (!result) throw new Error('Export timed out');
    return result;
  }

  onReady(callback: () => void): void {
    const handler = (event: MessageEvent) => {
      if (event.data.pluginMessage?.type === 'plugin-ready') {
        window.removeEventListener('message', handler);
        callback();
      }
    };
    window.addEventListener('message', handler);
    this.listeners.push(() => window.removeEventListener('message', handler));
  }

  destroy(): void {
    for (const cleanup of this.listeners) {
      cleanup();
    }
    this.listeners = [];
  }
}
