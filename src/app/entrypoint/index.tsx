import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';

import './index.css';

import DemoPage from '@/pages/DemoPage.tsx';

const root = document.getElementById('root');

if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <DemoPage />
    </StrictMode>,
  );
}
