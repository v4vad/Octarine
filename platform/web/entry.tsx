/**
 * Web entry point.
 *
 * Bootstraps the React app with the WebAdapter for standalone browser use.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';

import App from '../../App';
import { WebAdapter } from './adapter';
import { PlatformProvider } from '../context';

const adapter = new WebAdapter();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <PlatformProvider adapter={adapter}>
      <App />
    </PlatformProvider>
  );
}
