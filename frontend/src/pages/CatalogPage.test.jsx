import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import I18nProvider from '../i18n/I18nProvider';
import PublicLayout from '../layouts/PublicLayout';
import CatalogPage from './CatalogPage';
import NotFoundPage from './NotFoundPage';
import { getCatalog, getShop } from '../services/publicApi';
import { CATALOG, EMPTY_SHOP, SHOP, networkError } from '../test/fixtures';

vi.mock('../services/publicApi', () => ({
  getShop: vi.fn(),
  getCatalog: vi.fn(),
  getPublicProduct: vi.fn(),
  // Sections below the product list: empty unless a test sets them.
  getGallery: vi.fn(async () => ({ items: [] })),
  getReviews: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 5, totalPages: 1, averageRating: null })),
  submitReview: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderCatalog(url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <I18nProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<CatalogPage />} />
            <Route path="products/:id" element={<p>Product page</p>} />
          </Route>
        </Routes>
        <LocationProbe />
      </I18nProvider>
    </MemoryRouter>,
  );
}

const cards = () => screen.getAllByRole('link', { name: /view details|पूरी जानकारी/i });

describe('Customer catalogue page (English)', () => {
  beforeEach(() => window.sessionStorage.setItem('nirmaan.lang', 'en'));

  it('loads the latest prices and shows every product with price, unit and availability', async () => {
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();

    expect(screen.getByText(/loading latest prices/i)).toBeInTheDocument();
    expect(await screen.findByText('Alpha Cement (sample)')).toBeInTheDocument();
    expect(cards()).toHaveLength(3);

    const alpha = cards()[0];
    expect(within(alpha).getByText('₹380')).toBeInTheDocument();
    expect(within(alpha).getByText('Per 50 KG Bag')).toBeInTheDocument();
    expect(within(alpha).getByText('₹420')).toHaveClass('line-through');
    expect(within(alpha).getByText('In Stock')).toBeInTheDocument();
    expect(within(alpha).getByText('Price updated: 05 November 2026')).toBeInTheDocument();

    // Out-of-stock and unavailable products are still listed with their status.
    expect(within(cards()[1]).getByText('Out of Stock')).toBeInTheDocument();
    expect(within(cards()[1]).getByText('₹365.50')).toBeInTheDocument();
    expect(within(cards()[2]).getByText('Currently Unavailable')).toBeInTheDocument();
    // Hindi-only product falls back to its Hindi name.
    expect(within(cards()[2]).getByText('नमूना नदी रेत')).toBeInTheDocument();
    // Sand category shows the delivery-charges note.
    expect(within(cards()[2]).getByText(/delivery charges may vary/i)).toBeInTheDocument();
    expect(within(cards()[0]).queryByText(/delivery charges may vary/i)).not.toBeInTheDocument();

    expect(screen.getByText(/prices may change according to market conditions/i)).toBeInTheDocument();
    expect(screen.getByText('Prices last updated: 05 November 2026')).toBeInTheDocument();
    expect(getCatalog).toHaveBeenCalledTimes(1);
  });

  it('shows the shop name, address, a call button and contact details', async () => {
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();

    expect(await screen.findByRole('link', { name: /sample traders \(demo\)/i })).toBeInTheDocument();
    const callButtons = screen.getAllByRole('link', { name: /call|\+91/i });
    expect(callButtons.every((link) => link.getAttribute('href') === 'tel:+919000000000')).toBe(true);
    expect(screen.getByRole('link', { name: /chat on whatsapp/i })).toHaveAttribute('href', 'https://wa.me/919000000000');
    expect(screen.getAllByText('Sample Address, Demo Village').length).toBeGreaterThan(0);
    await waitFor(() => expect(document.title).toBe('Sample Traders (demo) – Latest prices'));
  });

  it('uses a neutral title and hides empty contact details before the shop is set up', async () => {
    getShop.mockResolvedValue(EMPTY_SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();

    expect(await screen.findByText('Building Material Price List')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^call$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/contact the shop/i)).not.toBeInTheDocument();
  });

  it('searches instantly by English or Hindi text without new requests', async () => {
    const user = userEvent.setup();
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();
    await screen.findByText('Alpha Cement (sample)');

    const search = screen.getByRole('searchbox', { name: /search products/i });
    await user.type(search, 'beta');
    expect(cards()).toHaveLength(1);
    expect(screen.getByText('Beta Cement (sample)')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 3 products')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/?q=beta');

    await user.clear(search);
    await user.type(search, 'रेत');
    expect(cards()).toHaveLength(1);
    expect(screen.getByText('नमूना नदी रेत')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(cards()).toHaveLength(3);
    expect(getCatalog).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly message when nothing matches, with a way back to all products', async () => {
    const user = userEvent.setup();
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();
    await screen.findByText('Alpha Cement (sample)');

    await user.type(screen.getByRole('searchbox'), 'paint');
    expect(screen.getByText('No products found')).toBeInTheDocument();
    expect(screen.getByText('Nothing matches “paint”.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show all products/i }));
    expect(cards()).toHaveLength(3);
  });

  it('filters by category', async () => {
    const user = userEvent.setup();
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();
    await screen.findByText('Alpha Cement (sample)');

    const group = screen.getByRole('group', { name: /filter by category/i });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['All 3', 'Cement 2', 'Sand 1']);

    await user.click(within(group).getByRole('button', { name: /sand/i }));
    expect(within(group).getByRole('button', { name: /sand/i })).toHaveAttribute('aria-pressed', 'true');
    expect(cards()).toHaveLength(1);
    expect(screen.getByTestId('location')).toHaveTextContent('/?category=c2');

    await user.click(within(group).getByRole('button', { name: /all/i }));
    expect(cards()).toHaveLength(3);
  });

  it('keeps search and filter from the address (e.g. after going back from a product)', async () => {
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog('/?category=c1&q=alpha');
    await screen.findByText('Alpha Cement (sample)');
    expect(cards()).toHaveLength(1);
    expect(screen.getByRole('searchbox')).toHaveValue('alpha');
  });

  it('refreshes prices from the server on request', async () => {
    const user = userEvent.setup();
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValueOnce(CATALOG).mockResolvedValueOnce({
      ...CATALOG,
      items: CATALOG.items.map((p) => (p.id === 'p1' ? { ...p, sellingPrice: 390 } : p)),
    });
    renderCatalog();
    expect(await within(await screen.findByRole('link', { name: /alpha cement/i })).findByText('₹380')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /refresh prices/i }));
    expect(await within(screen.getByRole('link', { name: /alpha cement/i })).findByText('₹390')).toBeInTheDocument();
    expect(getCatalog).toHaveBeenCalledTimes(2);
  });

  it('shows an error with a retry button when the server cannot be reached', async () => {
    const user = userEvent.setup();
    getShop.mockResolvedValue(EMPTY_SHOP);
    getCatalog.mockRejectedValueOnce(networkError()).mockResolvedValueOnce(CATALOG);
    renderCatalog();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load prices/i);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Alpha Cement (sample)')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('tells customers to wait when the server is slow to wake up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getShop.mockResolvedValue(EMPTY_SHOP);
      getCatalog.mockReturnValue(new Promise(() => {})); // never answers
      renderCatalog();
      expect(screen.queryByText(/can take up to a minute/i)).not.toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(4500);
      expect(screen.getByText(/can take up to a minute/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('explains when no products are listed yet', async () => {
    getShop.mockResolvedValue(EMPTY_SHOP);
    getCatalog.mockResolvedValue({ ...CATALOG, items: [], total: 0, lastUpdated: null });
    renderCatalog();
    expect(await screen.findByText('No products listed yet')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('opens product details from a card', async () => {
    const user = userEvent.setup();
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();
    await user.click(await screen.findByRole('link', { name: /beta cement/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/products/p2');
  });
});

describe('Customer catalogue page (Hindi, the default)', () => {
  it('opens in Hindi: texts, units, availability, dates and product names', async () => {
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();

    expect(await screen.findByText('अल्फा सीमेंट')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hi');
    expect(screen.getByRole('heading', { level: 1, name: 'नवीनतम रेट' })).toBeInTheDocument();
    expect(screen.getByText('रेट अपडेट किए गए: 05 नवंबर 2026')).toBeInTheDocument();
    expect(screen.getByText(/बाज़ार की स्थिति के अनुसार रेट बदल सकते हैं/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'सामान खोजें' })).toHaveAttribute('placeholder', 'सीमेंट, सरिया, रेत, ब्रांड खोजें…');
    expect(screen.getByRole('button', { name: 'रेट ताज़ा करें' })).toBeInTheDocument();
    expect(screen.getByText('कुल 3 सामान')).toBeInTheDocument();

    const [alpha, beta, sand] = cards();
    expect(within(alpha).getByText('प्रति 50 किलो बोरी')).toBeInTheDocument();
    expect(within(alpha).getByText('स्टॉक में उपलब्ध')).toBeInTheDocument();
    expect(within(alpha).getByText(/एमआरपी/)).toHaveTextContent('एमआरपी ₹420');
    expect(within(alpha).getByText('रेट अपडेट: 05 नवंबर 2026')).toBeInTheDocument();
    expect(within(beta).getByText('स्टॉक में नहीं')).toBeInTheDocument();
    expect(within(sand).getByText('अभी उपलब्ध नहीं')).toBeInTheDocument();
    expect(within(sand).getByText('प्रति ट्रॉली')).toBeInTheDocument();
    expect(within(sand).getByText('ढुलाई खर्च अलग हो सकता है')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Cement (sample)')).not.toBeInTheDocument();

    const group = screen.getByRole('group', { name: 'श्रेणी चुनें' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['सभी 3', 'सीमेंट 2', 'रेत 1']);
  });

  it('shows the shop name, address and contact section in Hindi', async () => {
    getShop.mockResolvedValue({ ...SHOP, addressHi: 'नमूना पता, डेमो गाँव' });
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();

    expect(await screen.findByRole('link', { name: /नमूना ट्रेडर्स/ })).toBeInTheDocument();
    expect(screen.getAllByText('नमूना पता, डेमो गाँव').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /कॉल करें/ })).toHaveAttribute('href', 'tel:+919000000000');
    expect(screen.getByRole('heading', { name: 'दुकान से संपर्क करें' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /व्हाट्सऐप पर बात करें/ })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('नमूना ट्रेडर्स – नवीनतम रेट'));
  });

  it('falls back to English for products without a Hindi name', async () => {
    getShop.mockResolvedValue(EMPTY_SHOP);
    getCatalog.mockResolvedValue({ ...CATALOG, items: [{ ...CATALOG.items[0], nameHi: '', descriptionHi: '' }] });
    renderCatalog();
    expect(await screen.findByText('Alpha Cement (sample)')).toBeInTheDocument();
    expect(screen.getByText('निर्माण सामग्री की रेट सूची')).toBeInTheDocument();
  });

  it('switches to English and back instantly, without reloading prices or losing the search', async () => {
    const user = userEvent.setup();
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();
    await screen.findByText('अल्फा सीमेंट');

    const search = screen.getByRole('searchbox');
    await user.type(search, 'सीमेंट');
    expect(cards()).toHaveLength(2);

    const switcher = screen.getByRole('group', { name: /भाषा \/ Language/ });
    expect(within(switcher).getByRole('button', { name: 'हिंदी' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(switcher).getByRole('button', { name: 'English' }));

    expect(within(switcher).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Alpha Cement (sample)')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 3 products')).toBeInTheDocument();
    expect(screen.getAllByText('In Stock').length).toBeGreaterThan(0);
    expect(screen.getByRole('searchbox')).toHaveValue('सीमेंट');
    expect(document.documentElement.lang).toBe('en');
    expect(window.sessionStorage.getItem('nirmaan.lang')).toBe('en');

    await user.click(within(switcher).getByRole('button', { name: 'हिंदी' }));
    expect(screen.getByText('अल्फा सीमेंट')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hi');

    expect(getCatalog).toHaveBeenCalledTimes(1);
    expect(getShop).toHaveBeenCalledTimes(1);
  });

  it('keeps the chosen language when the page is opened again in the same session', async () => {
    const user = userEvent.setup();
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    const first = renderCatalog();
    await screen.findByText('अल्फा सीमेंट');
    await user.click(screen.getByRole('button', { name: 'English' }));
    first.unmount();

    renderCatalog();
    expect(await screen.findByText('Alpha Cement (sample)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Page not found', () => {
  function renderUnknown(url) {
    return render(
      <MemoryRouter initialEntries={[url]}>
        <I18nProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<CatalogPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </I18nProvider>
      </MemoryRouter>,
    );
  }

  it('is shown in Hindi inside the normal page, with a way back to the price list', async () => {
    getShop.mockResolvedValue(SHOP);
    renderUnknown('/no-such-page');
    expect(await screen.findByRole('heading', { level: 1, name: 'यह पेज नहीं मिला' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'सभी सामान देखें' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('group', { name: /भाषा \/ Language/ })).toBeInTheDocument();
  });

  it('follows the language switch', async () => {
    const user = userEvent.setup();
    getShop.mockResolvedValue(SHOP);
    renderUnknown('/no-such-page');
    await user.click(await screen.findByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('Admin button in the customer header', () => {
  const adminLink = () => screen.queryByRole('link', { name: /एडमिन|admin/i });

  it('is not shown to customers', async () => {
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();
    await screen.findByText('अल्फा सीमेंट');
    expect(adminLink()).not.toBeInTheDocument();
    // The language label stays visible for customers.
    expect(screen.getByText('भाषा / Language')).not.toHaveClass('sr-only');
  });

  it('is shown on the owner’s device and opens the admin pages', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('nirmaan.adminDevice', '1');
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();
    await screen.findByText('अल्फा सीमेंट');

    const link = screen.getByRole('link', { name: 'एडमिन' });
    expect(link).toHaveAttribute('href', '/admin');
    await user.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent('/admin');
  });

  it('is shown while the owner is logged in, in the chosen language', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('nirmaan.adminToken', 'a-login-token');
    getShop.mockResolvedValue(SHOP);
    getCatalog.mockResolvedValue(CATALOG);
    renderCatalog();
    await screen.findByText('अल्फा सीमेंट');
    expect(screen.getByRole('link', { name: 'एडमिन' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });
});
