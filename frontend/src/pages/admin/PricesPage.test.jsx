import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PricesPage from './PricesPage';
import { listCategories, listProducts, updateProductPrice } from '../../services/adminApi';
import { httpError } from '../../test/fixtures';
import { I18nProvider, setTestLanguage } from '../../test/adminI18n';

vi.mock('../../services/adminApi', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, listProducts: vi.fn(), listCategories: vi.fn(), updateProductPrice: vi.fn() };
});

// Sample admin products (test values only).
const category = { id: 'c1', nameEn: 'Cement', nameHi: 'सीमेंट', isActive: true };
const make = (id, nameEn, sellingPrice, mrp = null) => ({
  id, nameEn, nameHi: '', category, unit: 'bag', unitLabel: { en: 'Per Bag', hi: 'प्रति बोरी' },
  sellingPrice, mrp, isActive: true, availability: 'in_stock', priceUpdatedAt: '2026-11-01T10:00:00.000Z',
});
const ALPHA = make('p1', 'Alpha Cement (sample)', 370, 400);
const BETA = make('p2', 'Beta Cement (sample)', 365.5);
const page = (items) => ({ items, page: 1, limit: 50, total: items.length, totalPages: 1 });

function setup(items = [ALPHA, BETA], lang = 'en') {
  setTestLanguage(lang);
  listCategories.mockResolvedValue({ items: [category] });
  listProducts.mockResolvedValue(page(items));
  updateProductPrice.mockImplementation(async (id, body) => {
    const product = items.find((p) => p.id === id);
    return {
      changed: body.sellingPrice !== product.sellingPrice,
      previousPrice: product.sellingPrice,
      product: { ...product, sellingPrice: body.sellingPrice, mrp: body.mrp === undefined ? product.mrp : body.mrp },
    };
  });
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <I18nProvider>
        <PricesPage />
      </I18nProvider>
    </MemoryRouter>,
  );
  return user;
}

const rowOf = async (name) => (await screen.findByText(name)).closest('li');

describe('Update Prices page', () => {
  it('lists products with their current price, MRP and an empty new-price box', async () => {
    setup();
    const alpha = await rowOf('Alpha Cement (sample)');
    expect(within(alpha).getByText('₹370')).toBeInTheDocument();
    expect(within(alpha).getByText(/MRP ₹400/)).toBeInTheDocument();
    expect(within(alpha).getByLabelText('New price (₹)')).toHaveValue('');
    expect(within(alpha).getByLabelText('New price (₹)')).toHaveAttribute('placeholder', '370');
    expect(within(alpha).getByLabelText('MRP (₹, optional)')).toHaveValue('400');
    expect(within(alpha).getByRole('button', { name: /save price/i })).toBeDisabled();
  });

  it('saves a new price with the price that was on screen, and confirms', async () => {
    const user = setup();
    const alpha = await rowOf('Alpha Cement (sample)');
    await user.type(within(alpha).getByLabelText('New price (₹)'), '380');
    expect(within(alpha).getByText(/₹370 →/)).toHaveTextContent('₹370 → ₹380');
    await user.click(within(alpha).getByRole('button', { name: /save price/i }));

    expect(updateProductPrice).toHaveBeenCalledWith('p1', { sellingPrice: 380, expectedPrice: 370 });
    expect(await within(alpha).findByText('Saved: ₹370 → ₹380')).toBeInTheDocument();
    expect(within(alpha).getByText('₹380')).toBeInTheDocument();
    expect(within(alpha).getByLabelText('New price (₹)')).toHaveValue('');
  });

  it('sends the MRP only when it was changed', async () => {
    const user = setup();
    const alpha = await rowOf('Alpha Cement (sample)');
    await user.type(within(alpha).getByLabelText('New price (₹)'), '410');
    expect(within(alpha).getByRole('alert')).toHaveTextContent(/cannot be lower than the selling price/);
    expect(within(alpha).getByRole('button', { name: /save price/i })).toBeDisabled();

    const mrp = within(alpha).getByLabelText('MRP (₹, optional)');
    await user.clear(mrp);
    await user.type(mrp, '420');
    await user.click(within(alpha).getByRole('button', { name: /save price/i }));
    expect(updateProductPrice).toHaveBeenCalledWith('p1', { sellingPrice: 410, expectedPrice: 370, mrp: 420 });
  });

  it('does not save invalid prices', async () => {
    const user = setup();
    const beta = await rowOf('Beta Cement (sample)');
    await user.type(within(beta).getByLabelText('New price (₹)'), '12.345');
    expect(within(beta).getByRole('alert')).toHaveTextContent(/at most 2 decimal places/);
    expect(within(beta).getByRole('button', { name: /save price/i })).toBeDisabled();
    expect(updateProductPrice).not.toHaveBeenCalled();
  });

  it('asks before saving a very big change (possible typo)', async () => {
    const user = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const beta = await rowOf('Beta Cement (sample)');
    await user.type(within(beta).getByLabelText('New price (₹)'), '3655');
    expect(within(beta).getByText(/big change/)).toBeInTheDocument();

    await user.click(within(beta).getByRole('button', { name: /save price/i }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toMatch(/₹365.50 → ₹3,655/);
    expect(updateProductPrice).not.toHaveBeenCalled();

    await user.click(within(beta).getByRole('button', { name: /save price/i }));
    expect(updateProductPrice).toHaveBeenCalledWith('p2', { sellingPrice: 3655, expectedPrice: 365.5 });
  });

  it('explains when the price was changed meanwhile and reloads the list', async () => {
    const user = setup();
    const error = httpError(409, 'Price changed');
    error.response.data.error.details = [{ field: 'sellingPrice', currentPrice: 375 }];
    updateProductPrice.mockRejectedValueOnce(error);
    const alpha = await rowOf('Alpha Cement (sample)');
    await user.type(within(alpha).getByLabelText('New price (₹)'), '380');
    await user.click(within(alpha).getByRole('button', { name: /save price/i }));

    expect(await within(alpha).findByRole('alert')).toHaveTextContent('This price was changed meanwhile to ₹375');
    await waitFor(() => expect(listProducts).toHaveBeenCalledTimes(2));
  });

  it('saves several changed rows with "Save all changes"', async () => {
    const user = setup();
    const alpha = await rowOf('Alpha Cement (sample)');
    const beta = await rowOf('Beta Cement (sample)');
    await user.type(within(alpha).getByLabelText('New price (₹)'), '375');
    await user.type(within(beta).getByLabelText('New price (₹)'), '360');
    expect(screen.getByText(/unsaved change/)).toHaveTextContent('2 unsaved changes');

    await user.click(screen.getByRole('button', { name: 'Save all changes (2)' }));
    expect(await screen.findByText('2 prices saved.')).toBeInTheDocument();
    expect(updateProductPrice).toHaveBeenCalledTimes(2);
    expect(updateProductPrice).toHaveBeenCalledWith('p1', { sellingPrice: 375, expectedPrice: 370 });
    expect(updateProductPrice).toHaveBeenCalledWith('p2', { sellingPrice: 360, expectedPrice: 365.5 });
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
  });

  it('reports rows that could not be saved', async () => {
    const user = setup();
    updateProductPrice.mockRejectedValueOnce(httpError(500, 'Something went wrong. Please try again.'));
    const alpha = await rowOf('Alpha Cement (sample)');
    const beta = await rowOf('Beta Cement (sample)');
    await user.type(within(alpha).getByLabelText('New price (₹)'), '375');
    await user.type(within(beta).getByLabelText('New price (₹)'), '360');
    await user.click(screen.getByRole('button', { name: 'Save all changes (2)' }));

    expect(await screen.findByText('1 saved, 1 not saved. See the messages on those rows.')).toBeInTheDocument();
    expect(within(alpha).getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(within(beta).getByText('Saved: ₹365.50 → ₹360')).toBeInTheDocument();
  });

  it('opens pre-filtered from a product link (?q=)', async () => {
    listCategories.mockResolvedValue({ items: [category] });
    listProducts.mockResolvedValue(page([ALPHA]));
    setTestLanguage('en');
    render(
      <MemoryRouter initialEntries={['/admin/prices?q=Alpha']}>
        <I18nProvider>
          <PricesPage />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('searchbox')).toHaveValue('Alpha');
    await waitFor(() => expect(listProducts).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Alpha' })));
  });
});
