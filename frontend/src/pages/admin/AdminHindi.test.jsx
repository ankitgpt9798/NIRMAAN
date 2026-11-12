import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LanguageSwitcher from '../../components/public/LanguageSwitcher';
import PricesPage from './PricesPage';
import PriceHistoryPage from './PriceHistoryPage';
import QrCodePage from './QrCodePage';
import SettingsPage from './SettingsPage';
import { getQrCode, getShopSettings, listCategories, listPriceHistory, listProducts, updateProductPrice, updateShopSettings } from '../../services/adminApi';
import { EMPTY_SHOP, httpError, networkError } from '../../test/fixtures';
import { I18nProvider } from '../../test/adminI18n';

vi.mock('../../services/adminApi', async (importOriginal) => ({
  ...(await importOriginal()),
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  updateProductPrice: vi.fn(),
  listPriceHistory: vi.fn(),
  getQrCode: vi.fn(),
  getShopSettings: vi.fn(),
  updateShopSettings: vi.fn(),
}));

// Sample admin data (test values only, not real prices).
const category = { id: 'c1', nameEn: 'Cement', nameHi: 'सीमेंट', isActive: true };
const ALPHA = {
  id: 'p1', nameEn: 'Alpha Cement (sample)', nameHi: 'अल्फा सीमेंट (नमूना)', category, unit: 'bag',
  unitLabel: { en: 'Per Bag', hi: 'प्रति बोरी' }, sellingPrice: 370, mrp: 400, isActive: true,
  availability: 'in_stock', priceUpdatedAt: '2026-11-01T10:00:00.000Z',
};

/** Renders like the admin app, with nothing chosen yet, so it starts in its default language. */
function renderAdmin(page) {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <LanguageSwitcher tone="light" />
        {page}
      </I18nProvider>
    </MemoryRouter>,
  );
}

function setupPrices() {
  listCategories.mockResolvedValue({ items: [category] });
  listProducts.mockResolvedValue({ items: [ALPHA], page: 1, limit: 50, total: 1, totalPages: 1 });
  renderAdmin(<PricesPage />);
  return userEvent.setup();
}

describe('Admin in Hindi (default language)', () => {
  it('opens in Hindi when no language has been chosen', async () => {
    setupPrices();
    expect(await screen.findByRole('heading', { level: 1, name: 'रेट बदलें' })).toBeInTheDocument();
    expect(screen.getByText('अल्फा सीमेंट (नमूना)')).toBeInTheDocument(); // Hindi product name first
    expect(screen.getByLabelText('नया रेट (₹)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'अल्फा सीमेंट (नमूना) का रेट सेव करें' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'हिंदी' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.lang).toBe('hi');
  });

  it('shows typing mistakes in Hindi and re-translates them when the language is switched', async () => {
    const user = setupPrices();
    await user.type(await screen.findByLabelText('नया रेट (₹)'), 'abc');
    expect(screen.getByRole('alert')).toHaveTextContent('नया रेट में केवल अंक लिखें');

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('alert')).toHaveTextContent('New price must be a number');
    expect(screen.getByRole('heading', { level: 1, name: 'Update Prices' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem('nirmaan.lang')).toBe('en');
  });

  it('confirms a saved price in Hindi', async () => {
    updateProductPrice.mockResolvedValue({ changed: true, previousPrice: 370, product: { ...ALPHA, sellingPrice: 380 } });
    const user = setupPrices();
    await user.type(await screen.findByLabelText('नया रेट (₹)'), '380');
    await user.click(screen.getByRole('button', { name: 'अल्फा सीमेंट (नमूना) का रेट सेव करें' }));
    expect(await screen.findByText('सेव हुआ: ₹370 → ₹380')).toBeInTheDocument();
  });

  it('translates server validation messages into Hindi', async () => {
    const error = httpError(400, 'Some fields are invalid');
    error.response.data.error.code = 'VALIDATION_ERROR';
    error.response.data.error.details = [{ field: 'sellingPrice', message: 'Selling price cannot be negative' }];
    updateProductPrice.mockRejectedValue(error);
    const user = setupPrices();
    await user.type(await screen.findByLabelText('नया रेट (₹)'), '380');
    await user.click(screen.getByRole('button', { name: 'अल्फा सीमेंट (नमूना) का रेट सेव करें' }));
    expect(await screen.findByText('बिक्री रेट माइनस (ऋणात्मक) नहीं हो सकता')).toBeInTheDocument();
  });

  it('shows connection problems in Hindi', async () => {
    listPriceHistory.mockRejectedValue(networkError());
    renderAdmin(<PriceHistoryPage />);
    expect(await screen.findByText('सर्वर से जुड़ नहीं पा रहे। कृपया इंटरनेट कनेक्शन जाँचें।')).toBeInTheDocument();
  });

  it('shows the QR code warnings and notes in Hindi (from their codes)', async () => {
    getQrCode.mockResolvedValue({
      url: 'http://localhost:5173/',
      isProductionReady: false,
      warnings: [{ code: 'LOCALHOST', message: 'English text from the server' }],
      notes: [{ code: 'WEBSITE_DIFFERS', website: 'https://old.example.com', message: 'English text from the server' }],
      svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      pngDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      shop: { nameEn: 'Sample Traders (demo)', nameHi: 'नमूना ट्रेडर्स', phone: '+91 90000 00000' },
    });
    renderAdmin(<QrCodePage />);
    expect(await screen.findByText('यह QR कोड अभी न छापें – इसमें टेस्ट (डेवलपमेंट) पता है।')).toBeInTheDocument();
    expect(screen.getByText(/ग्राहकों के फ़ोन इसे नहीं खोल सकते/)).toBeInTheDocument();
    expect(screen.getByText(/\(https:\/\/old\.example\.com\) QR कोड के पते से अलग है/)).toBeInTheDocument();
    expect(screen.queryByText('English text from the server')).not.toBeInTheDocument();
  });

  it('shows the shop settings form and field errors from the server in Hindi', async () => {
    getShopSettings.mockResolvedValue({ ...EMPTY_SHOP, updatedAt: null });
    const error = httpError(400, 'Some fields are invalid');
    error.response.data.error.details = [{ field: 'nameEn', message: 'Shop name (English) must be at most 120 characters' }];
    updateShopSettings.mockRejectedValue(error);
    const user = userEvent.setup();
    renderAdmin(<SettingsPage />);

    await user.type(await screen.findByLabelText('दुकान का नाम (हिंदी)'), 'नमूना ट्रेडर्स');
    await user.click(screen.getByRole('button', { name: 'दुकान की जानकारी सेव करें' }));
    const message = await screen.findByText('दुकान का नाम (अंग्रेज़ी) अधिकतम 120 अक्षरों का हो सकता है');
    const field = screen.getByLabelText('दुकान का नाम (अंग्रेज़ी)');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.getAttribute('aria-describedby')).toContain(message.id);
  });
});
