/**
 * React Context for the platform adapter.
 *
 * Wrap your app in <PlatformProvider> and use the usePlatform() hook
 * from any component that needs platform-specific functionality.
 */

import React, { createContext, useContext } from 'react';
import type { PlatformAdapter } from './types';

const PlatformContext = createContext<PlatformAdapter | null>(null);

interface PlatformProviderProps {
  adapter: PlatformAdapter;
  children: React.ReactNode;
}

export function PlatformProvider({ adapter, children }: PlatformProviderProps) {
  return (
    <PlatformContext.Provider value={adapter}>
      {children}
    </PlatformContext.Provider>
  );
}

/** Access the platform adapter from any component. */
export function usePlatform(): PlatformAdapter {
  const adapter = useContext(PlatformContext);
  if (!adapter) {
    throw new Error('usePlatform() must be used within a <PlatformProvider>');
  }
  return adapter;
}
