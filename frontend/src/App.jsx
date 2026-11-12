import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import CatalogPage from './pages/CatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import FullPageLoader from './components/FullPageLoader';

// The admin area is a separate download, so the customer catalogue stays small.
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<CatalogPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<FullPageLoader />}>
            <AdminApp />
          </Suspense>
        }
      />
    </Routes>
  );
}
