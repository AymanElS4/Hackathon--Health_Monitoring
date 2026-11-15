import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LEVEL_COLORS, SENSOR_COLORS } from './config/constants';
import './index.css';

const theme = document.documentElement.style;
Object.entries(SENSOR_COLORS).forEach(([sensor, color]) => {
  theme.setProperty(`--sensor-${sensor}`, color);
});
theme.setProperty('--status-green', LEVEL_COLORS.green.label);
theme.setProperty('--status-green-bg', LEVEL_COLORS.green.bg ?? '#EEF2F6');
theme.setProperty('--status-amber', LEVEL_COLORS.amber.ring ?? '#F2A93B');
theme.setProperty('--status-red', LEVEL_COLORS.red.ring ?? '#E5484D');
theme.setProperty('--status-in-doubt', LEVEL_COLORS.in_doubt.ring ?? '#9AA5B1');
theme.setProperty('--status-unknown', LEVEL_COLORS.unknown.fill ?? '#C9D2DC');

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
