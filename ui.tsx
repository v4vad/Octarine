/**
 * Figma entry point.
 *
 * Creates a FigmaAdapter and wraps the App in PlatformProvider
 * so all components can access platform features via usePlatform().
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

import App from './App';
import { FigmaAdapter } from './platform/figma/adapter';
import { PlatformProvider } from './platform/context';

const adapter = new FigmaAdapter();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <PlatformProvider adapter={adapter}>
      <App />
    </PlatformProvider>
  );
}
