import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { AnglesEditorPage } from './AnglesEditorPage';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found in angles-editor.html');
}

createRoot(container).render(
  <StrictMode>
    <AnglesEditorPage />
  </StrictMode>,
);
