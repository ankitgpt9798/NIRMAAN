import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PriceHistoryPage from './PriceHistoryPage';
import { listPriceHistory } from '../../services/adminApi';
import { I18nProvider, setTestLanguage } from '../../test/adminI18n';

vi.mock('../../services/adminApi', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, listPriceHistory: vi.fn() };
});

// Sample history entries (test values only).
const ENTRIES = [
  {
    id: 'h2', product: { id: 'p1', nameEn: 'Alpha Cement (sample)', nameHi: 'अल्फा सीमेंट', deleted: false },
    previousPrice: 370, newPrice: 380, difference: 10, percentChange: 2.7,
    updatedBy: { id: 'a1', name: 'Sample Owner' }, createdAt: '2026-11-09T09:15:00.000Z',
  },
  {
    id: 'h1', product: { id: 'p9', nameEn: 'Old Brick (sample)', nameHi: '', deleted: true },
    previousPrice: 8, newPrice: 7.5, difference: -0.5, percentChange: -6.3,
    updatedBy: { id: 'a1', name: 'Sample Owner' }, createdAt: '2026-11-01T05:00:00.000Z',
  },
];

function renderPage(url = '/admin/price-history', lang = 'en') {
  setTestLanguage(lang);
  return render(
    <MemoryRouter initialEntries={[url]}>
      <I18nProvider>
        <Routes>
          <Route path="/admin/price-history" element={<PriceHistoryPage />} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('Price History page', () => {
  it('shows each change with old and new price, difference, time and who made it', async () => {
    listPriceHistory.mockResolvedValue({ items: ENTRIES, page: 1, limit: 30, total: 2, totalPages: 1 });
    renderPage();

    const alpha = (await screen.findByRole('link', { name: 'Alpha Cement (sample)' })).closest('li');
    expect(within(alpha).getByLabelText('Old price ₹370')).toHaveClass('line-through');
    expect(within(alpha).getByLabelText('New price ₹380')).toBeInTheDocument();
    expect(within(alpha).getByText('+₹10 (+2.7%)')).toBeInTheDocument();
    expect(within(alpha).getByText(/by Sample Owner/)).toBeInTheDocument();
    expect(within(alpha).getByText('अल्फा सीमेंट')).toBeInTheDocument();
    expect(within(alpha).getByText(/9 Nov 2026/)).toBeInTheDocument();

    const brick = screen.getByText('Old Brick (sample)').closest('li');
    expect(within(brick).getByText('Product deleted')).toBeInTheDocument();
    expect(within(brick).getByText('−₹0.50 (−6.3%)')).toBeInTheDocument();
    expect(screen.getByText('2 price changes')).toBeInTheDocument();
  });

  it('searches by product name', async () => {
    const user = userEvent.setup();
    listPriceHistory.mockResolvedValue({ items: ENTRIES, page: 1, limit: 30, total: 2, totalPages: 1 });
    renderPage();
    await screen.findByText('Alpha Cement (sample)');
    await user.type(screen.getByRole('searchbox'), 'सीमेंट');
    await waitFor(() => expect(listPriceHistory).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'सीमेंट', page: 1 })));
  });

  it('shows one product when opened from a product (?product=)', async () => {
    const user = userEvent.setup();
    listPriceHistory.mockResolvedValue({ items: [ENTRIES[0]], page: 1, limit: 30, total: 1, totalPages: 1 });
    renderPage('/admin/price-history?product=p1');
    expect(await screen.findByText(/Showing one product: Alpha Cement \(sample\)/)).toBeInTheDocument();
    expect(listPriceHistory).toHaveBeenCalledWith(expect.objectContaining({ product: 'p1' }));

    await user.click(screen.getByRole('button', { name: /show all products/i }));
    await waitFor(() => expect(listPriceHistory).toHaveBeenLastCalledWith(expect.objectContaining({ product: '' })));
  });

  it('explains when there is no history yet', async () => {
    listPriceHistory.mockResolvedValue({ items: [], page: 1, limit: 30, total: 0, totalPages: 1 });
    renderPage();
    const title = await screen.findByText('No price changes yet');
    const emptyState = title.parentElement;
    expect(within(emptyState).getByRole('link', { name: 'Update Prices' })).toHaveAttribute('href', '/admin/prices');
  });
});
