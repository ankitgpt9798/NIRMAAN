import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import I18nProvider from '../i18n/I18nProvider';
import PublicLayout from '../layouts/PublicLayout';
import ProductDetailPage from './ProductDetailPage';
import { getPublicProduct, getShop } from '../services/publicApi';
import { EMPTY_SHOP, PRODUCTS, SHOP, httpError } from '../test/fixtures';

vi.mock('../services/publicApi', () => ({
  getShop: vi.fn(),
  getCatalog: vi.fn(),
  getPublicProduct: vi.fn(),
  // Sections below the product list: empty unless a test sets them.
  getGallery: vi.fn(async () => ({ items: [] })),
  getReviews: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 5, totalPages: 1, averageRating: null })),
  submitReview: vi.fn(),
}));

function renderProduct(id) {
  return render(
    <MemoryRouter initialEntries={[`/products/${id}`]}>
      <I18nProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<p>Catalogue</p>} />
            <Route path="products/:id" element={<ProductDetailPage />} />
          </Route>
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('Product details page (Hindi, the default)', () => {
  it('shows the details in Hindi with the English name as a subtitle', async () => {
    getShop.mockResolvedValue(SHOP);
    getPublicProduct.mockResolvedValue(PRODUCTS[0]);
    renderProduct('p1');

    expect(await screen.findByRole('heading', { level: 1, name: 'अल्फा सीमेंट' })).toBeInTheDocument();
    expect(screen.getByText('Alpha Cement (sample)')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('रेट')).toBeInTheDocument();
    expect(screen.getByText('स्टॉक में उपलब्ध')).toBeInTheDocument();
    expect(screen.getAllByText('प्रति 50 किलो बोरी').length).toBeGreaterThan(0);
    expect(screen.getByText('ब्रांड')).toBeInTheDocument();
    expect(screen.getByText('सीमेंट')).toBeInTheDocument();
    expect(screen.getByText('रेट अपडेट: 05 नवंबर 2026')).toBeInTheDocument();
    // No Hindi description: the English one is shown instead of nothing.
    expect(screen.getByText('Sample description')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'सभी सामान पर वापस जाएँ' })).toHaveAttribute('href', '/');
  });

  it('asks on WhatsApp in Hindi', async () => {
    getShop.mockResolvedValue(SHOP);
    getPublicProduct.mockResolvedValue(PRODUCTS[0]);
    renderProduct('p1');
    expect(await screen.findByRole('link', { name: 'रेट पक्का करने के लिए कॉल करें' })).toHaveAttribute('href', 'tel:+919000000000');
    const whatsapp = screen.getByRole('link', { name: 'व्हाट्सऐप पर पूछें' });
    expect(decodeURIComponent(whatsapp.getAttribute('href'))).toBe('https://wa.me/919000000000?text=नमस्ते, मुझे अल्फा सीमेंट का नवीनतम रेट जानना है।');
  });

  it('shows the Hindi delivery note for sand', async () => {
    getShop.mockResolvedValue(EMPTY_SHOP);
    getPublicProduct.mockResolvedValue(PRODUCTS[2]);
    renderProduct('p3');
    expect(await screen.findByText(/ढुलाई और डिलीवरी का खर्च/)).toBeInTheDocument();
    expect(screen.getByText('अभी उपलब्ध नहीं')).toBeInTheDocument();
  });
});

describe('Product details page (English)', () => {
  beforeEach(() => window.sessionStorage.setItem('nirmaan.lang', 'en'));

  it('shows full product details with the latest price', async () => {
    getShop.mockResolvedValue(SHOP);
    getPublicProduct.mockResolvedValue(PRODUCTS[0]);
    renderProduct('p1');

    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Cement (sample)' })).toBeInTheDocument();
    expect(getPublicProduct).toHaveBeenCalledWith('p1');
    expect(screen.getByText('अल्फा सीमेंट')).toHaveAttribute('lang', 'hi');
    expect(screen.getByText('₹380')).toBeInTheDocument();
    expect(screen.getAllByText('Per 50 KG Bag').length).toBeGreaterThan(0);
    expect(screen.getByText('₹420')).toHaveClass('line-through');
    expect(screen.getByText('In Stock')).toBeInTheDocument();
    expect(screen.getByText('Demo Brand')).toBeInTheDocument();
    expect(screen.getByText('Cement')).toBeInTheDocument();
    expect(screen.getByText('Sample description')).toBeInTheDocument();
    expect(screen.getByText('Price updated: 05 November 2026')).toBeInTheDocument();
    expect(screen.getByText(/prices may change according to market conditions/i)).toBeInTheDocument();
    expect(screen.queryByText(/transportation and delivery charges/i)).not.toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Alpha Cement (sample) – Sample Traders (demo)'));
  });

  it('offers call and WhatsApp buttons that mention the product', async () => {
    getShop.mockResolvedValue(SHOP);
    getPublicProduct.mockResolvedValue(PRODUCTS[0]);
    renderProduct('p1');

    expect(await screen.findByRole('link', { name: /call to confirm price/i })).toHaveAttribute('href', 'tel:+919000000000');
    const whatsapp = screen.getByRole('link', { name: /ask on whatsapp/i });
    expect(decodeURIComponent(whatsapp.getAttribute('href'))).toBe(
      'https://wa.me/919000000000?text=Hello, I would like to know the latest price of Alpha Cement (sample).',
    );
  });

  it('shows the delivery-charges note for sand and keeps unavailable products visible', async () => {
    getShop.mockResolvedValue(EMPTY_SHOP);
    getPublicProduct.mockResolvedValue(PRODUCTS[2]);
    renderProduct('p3');

    expect(await screen.findByRole('heading', { level: 1, name: 'नमूना नदी रेत' })).toBeInTheDocument();
    expect(screen.getByText('Currently Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/transportation and delivery charges may vary/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /call to confirm/i })).not.toBeInTheDocument();
  });

  it('says so when a product is no longer listed', async () => {
    getShop.mockResolvedValue(EMPTY_SHOP);
    getPublicProduct.mockRejectedValue(httpError(404, 'Product not found'));
    renderProduct('gone');

    expect(await screen.findByRole('heading', { name: /product not available/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /show all products/i })).toHaveAttribute('href', '/');
  });

  it('links back to the price list when opened directly', async () => {
    getShop.mockResolvedValue(EMPTY_SHOP);
    getPublicProduct.mockResolvedValue(PRODUCTS[1]);
    renderProduct('p2');
    expect(await screen.findByRole('link', { name: /back to all products/i })).toHaveAttribute('href', '/');
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });
});
