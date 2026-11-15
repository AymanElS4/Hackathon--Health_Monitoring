import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
