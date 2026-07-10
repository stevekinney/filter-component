import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Application from '@/example/application.tsx';
import '@/styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Application />
  </StrictMode>,
);
