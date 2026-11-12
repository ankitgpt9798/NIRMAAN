import '../../i18n/admin'; // adds the admin texts (Hindi + English) before anything renders
import { Navigate, Route, Routes } from 'react-router-dom';
import AuthProvider from '../../context/AuthProvider';
import ProtectedRoute from '../../components/ProtectedRoute';
import AdminLayout from '../../layouts/AdminLayout';
import LoginPage from './LoginPage';
import DashboardPage from './DashboardPage';
import ProductsPage from './ProductsPage';
import ProductFormPage from './ProductFormPage';
import CategoriesPage from './CategoriesPage';
import SettingsPage from './SettingsPage';
import PricesPage from './PricesPage';
import PriceHistoryPage from './PriceHistoryPage';
import QrCodePage from './QrCodePage';
import GalleryPage from './GalleryPage';
import ReviewsPage from './ReviewsPage';

/**
 * Entire admin area (/admin/*). Loaded on demand, so customers scanning the QR
 * code never download admin code or texts, and never trigger login checks.
 * The admin opens in Hindi by default and follows the same हिंदी | English
 * choice as the customer website.
 */
export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id/edit" element={<ProductFormPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="prices" element={<PricesPage />} />
            <Route path="price-history" element={<PriceHistoryPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="qr-code" element={<QrCodePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
