import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './shell/App';
import { installPalmRejection } from './shell/palmRejection';
import { registerServiceWorker } from './pwa';
import './index.css';

registerServiceWorker();
installPalmRejection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
