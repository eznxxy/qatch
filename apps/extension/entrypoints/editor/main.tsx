import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@/assets/theme.css';
import './style.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Editor root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
