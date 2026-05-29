import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { WorkflowEditorPage } from './WorkflowEditorPage';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found in workflow-editor.html');
}

createRoot(container).render(
  <StrictMode>
    <WorkflowEditorPage />
  </StrictMode>,
);
