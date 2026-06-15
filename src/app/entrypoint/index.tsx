import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';

import './index.css';

import Router from '@/app/router/Router.tsx';

const root = document.getElementById('root');

if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <Router />
    </StrictMode>,
  );
}
