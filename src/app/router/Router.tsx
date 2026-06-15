import DemoPage from '@/pages/DemoPage';

import { BrowserRouter, Route, Routes } from 'react-router';

export default function Router(): React.ReactNode {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DemoPage />} />
      </Routes>
    </BrowserRouter>
  );
}
