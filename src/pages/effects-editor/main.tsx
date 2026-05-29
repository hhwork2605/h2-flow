import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { EffectsEditorPage } from './EffectsEditorPage';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found in effects-editor.html');
}

createRoot(container).render(
  <StrictMode>
    <EffectsEditorPage />
  </StrictMode>,
);
