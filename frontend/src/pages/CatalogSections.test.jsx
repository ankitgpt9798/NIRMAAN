import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import I18nProvider from '../i18n/I18nProvider';
import PublicLayout from '../layouts/PublicLayout';
import CatalogPage from './CatalogPage';
import { getCatalog, getGallery, getReviews, getShop, submitReview } from '../services/publicApi';
import { CATALOG, SHOP, httpError, networkError } from '../test/fixtures';

vi.mock('../services/publicApi', () => ({
  getShop: vi.fn(),
  getCatalog: vi.fn(),
  getPublicProduct: vi.fn(),
  getGallery: vi.fn(),
  getReviews: vi.fn(),
  submitReview: vi.fn(),
}));

// Sample data for tests only (not real photos or reviews).
const PHOTO = { url: 'https://res.cloudinary.com/demo/image/upload/c_limit,h_1600,w_1600/shop.jpg', provider: 'cloudinary' };
const GALLERY = {
  items: [
    { id: 'g1', image: { url: '/uploads/gallery/a.jpg', provider: 'local' }, captionEn: 'Cement stock (sample)', captionHi: 'सीमेंट का स्टॉक (नमूना)' },
    { id: 'g2', image: { url: '/uploads/gallery/b.jpg', provider: 'local' }, captionEn: '', captionHi: '' },
  ],
};
const review = (n, rating = 5) => ({ id: `r${n}`, name: `Sample Customer ${n}`, rating, comment: `Comment ${n} (sample)`, createdAt: '2026-11-08T10:00:00.000Z' });
const NO_REVIEWS = { items: [], total: 0, page: 1, limit: 5, totalPages: 1, averageRating: null };

function renderHome({ lang = 'en', shop = SHOP, gallery = { items: [] }, reviews = NO_REVIEWS } = {}) {
  window.sessionStorage.setItem('nirmaan.lang', lang);
  getShop.mockResolvedValue(shop);
  getCatalog.mockResolvedValue(CATALOG);
  getGallery.mockResolvedValue(gallery);
  if (reviews) getReviews.mockResolvedValue(reviews); // null: keep the test's own mock
  return render(
    <MemoryRouter>
      <I18nProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<CatalogPage />} />
          </Route>
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('Shop photo, gallery and reviews below the products', () => {
  it('shows the big shop photo below the product list', async () => {
    renderHome({ shop: { ...SHOP, photo: PHOTO } });
    const photo = await screen.findByAltText('Photo of Sample Traders (demo)');
    expect(photo).toHaveAttribute('loading', 'lazy');
    expect(photo.getAttribute('srcset')).toContain('c_limit,h_800,w_800');
    expect(screen.getByRole('heading', { name: 'Our shop' })).toBeInTheDocument();
    // Below the products in the page order.
    const lastProduct = screen.getAllByRole('link', { name: /view details/i }).at(-1);
    expect(lastProduct.compareDocumentPosition(photo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows nothing for the shop photo or gallery until the owner adds them', async () => {
    renderHome();
    expect(await screen.findByText('Alpha Cement (sample)')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Customer reviews' });
    expect(screen.queryByRole('heading', { name: 'Our shop' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Photo gallery' })).not.toBeInTheDocument();
    expect(screen.getByText('No reviews yet. Be the first to share your experience.')).toBeInTheDocument();
  });

  it('opens gallery photos full screen and moves between them', async () => {
    const user = userEvent.setup();
    renderHome({ gallery: GALLERY });
    const first = await screen.findByRole('button', { name: /^Cement stock \(sample\),? ?open full size$/ });
    expect(first.querySelector('img')).toHaveAttribute('alt', ''); // caption is shown as text, not repeated
    expect(screen.getByRole('button', { name: /^Shop photo 2,? ?open full size$/ })).toBeInTheDocument();

    await user.click(first);
    const viewer = screen.getByRole('dialog', { name: 'Photo viewer' });
    expect(within(viewer).getByText('1 of 2')).toBeInTheDocument();
    expect(within(viewer).getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(within(viewer).getAllByRole('button', { name: 'Next photo' })[0]);
    expect(within(viewer).getByText('2 of 2')).toBeInTheDocument();
    expect(within(viewer).getByAltText('Shop photo 2')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(within(viewer).getByText('1 of 2')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(first).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('shows approved reviews with the average rating and loads more on request', async () => {
    const user = userEvent.setup();
    getReviews.mockImplementation(async (page) =>
      page === 1
        ? { items: [1, 2, 3, 4, 5].map((n) => review(n, n === 5 ? 3 : 5)), total: 6, page: 1, limit: 5, totalPages: 2, averageRating: 4.7 }
        : { items: [review(6, 4)], total: 6, page: 2, limit: 5, totalPages: 2, averageRating: 4.7 },
    );
    renderHome({ reviews: null });
    await screen.findByText('Sample Customer 1');
    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '4.7 out of 5' })).toBeInTheDocument();
    expect(screen.getByText('6 reviews')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: '5 out of 5 stars' })).toHaveLength(4);
    expect(screen.getByText('Comment 1 (sample)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show more reviews' }));
    expect(await screen.findByText('Sample Customer 6')).toBeInTheDocument();
    expect(getReviews).toHaveBeenLastCalledWith(2, 5);
    expect(screen.queryByRole('button', { name: 'Show more reviews' })).not.toBeInTheDocument();
  });

  it('checks the review form before sending', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: 'Send review' }));
    expect(screen.getByText('Please enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Please choose 1 to 5 stars.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toHaveFocus();
    expect(submitReview).not.toHaveBeenCalled();
  });

  it('sends a review and explains that it appears after the shop checks it', async () => {
    const user = userEvent.setup();
    submitReview.mockResolvedValue({ status: 'pending' });
    renderHome();
    await user.type(await screen.findByLabelText('Your name'), '  Sample Customer ');
    await user.click(screen.getByLabelText('4 stars'));
    await user.type(screen.getByLabelText('Your review (optional)'), 'Good service (sample)');
    expect(screen.getByText('479 characters left')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send review' }));

    expect(await screen.findByText('Thank you! Your review will appear on this page after the shop checks it.')).toBeInTheDocument();
    expect(submitReview).toHaveBeenCalledWith({ name: 'Sample Customer', rating: 4, comment: 'Good service (sample)', website: '' });
    expect(screen.getByLabelText('Your name')).toHaveValue('');
    expect(screen.getByLabelText('4 stars')).not.toBeChecked();
  });

  it('explains when a review cannot be sent', async () => {
    const user = userEvent.setup();
    const tooMany = httpError(429, 'Too many reviews');
    submitReview.mockRejectedValueOnce(tooMany).mockRejectedValueOnce(networkError());
    renderHome();
    await user.type(await screen.findByLabelText('Your name'), 'Sample');
    await user.click(screen.getByLabelText('5 stars'));
    await user.click(screen.getByRole('button', { name: 'Send review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You have already sent several reviews. Please try again later.');
    await user.click(screen.getByRole('button', { name: 'Send review' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not send. Please check your internet connection'));
    expect(screen.getByLabelText('Your name')).toHaveValue('Sample'); // nothing typed is lost
  });

  it('shows everything in Hindi by default', async () => {
    const user = userEvent.setup();
    renderHome({ lang: 'hi', shop: { ...SHOP, photo: PHOTO }, gallery: GALLERY, reviews: { ...NO_REVIEWS, items: [review(1)], total: 1, averageRating: 5 } });
    expect(await screen.findByRole('heading', { name: 'हमारी दुकान' })).toBeInTheDocument();
    expect(screen.getByAltText('नमूना ट्रेडर्स की फ़ोटो')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'फ़ोटो गैलरी' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^सीमेंट का स्टॉक \(नमूना\),? ?बड़ा करके देखें$/ })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'ग्राहकों की राय' })).toBeInTheDocument();
    expect(screen.getByText('1 समीक्षा')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '5 में से 5 स्टार' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'राय भेजें' }));
    expect(screen.getByText('कृपया अपना नाम लिखें।')).toBeInTheDocument();
  });
});

describe('Product cards and footer', () => {
  it('shows the price panel with MRP and the saving worked out from it', async () => {
    renderHome();
    const [alpha, beta] = await screen.findAllByRole('link', { name: /view details/i });
    expect(within(alpha).getByText('₹420')).toHaveClass('line-through');
    expect(within(alpha).getByText('Save ₹40')).toBeInTheDocument(); // MRP ₹420 − price ₹380
    expect(within(alpha).getByText('Cement')).toBeInTheDocument();
    expect(within(beta).queryByText(/^Save/)).not.toBeInTheDocument(); // no MRP
  });

  it('shows the saving and the trolley unit in Hindi', async () => {
    renderHome({ lang: 'hi' });
    const cards = await screen.findAllByRole('link', { name: /पूरी जानकारी/ });
    expect(within(cards[0]).getByText('₹40 की बचत')).toBeInTheDocument();
    expect(within(cards[2]).getByText('प्रति ट्रॉली')).toBeInTheDocument();
  });

  it('footer: call and WhatsApp buttons, address with a Google Maps link, and back to top', async () => {
    const user = userEvent.setup();
    renderHome({ shop: { ...SHOP, descriptionEn: 'Cement and sand (sample)' } });
    const footer = (await screen.findByRole('heading', { name: 'Contact the shop' })).closest('footer');
    expect(within(footer).getByRole('link', { name: 'Call +91 90000 00000' })).toHaveAttribute('href', 'tel:+919000000000');
    expect(within(footer).getByRole('link', { name: 'Chat on WhatsApp' })).toHaveAttribute('href', 'https://wa.me/919000000000');
    expect(within(footer).getByText('Cement and sand (sample)')).toBeInTheDocument();
    const map = within(footer).getByRole('link', { name: 'Open in Google Maps' });
    expect(map).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Sample%20Traders%20(demo)%2C%20Sample%20Address%2C%20Demo%20Village');
    expect(map).toHaveAttribute('target', '_blank');
    expect(within(footer).getByText(`© ${new Date().getFullYear()} Sample Traders (demo)`)).toBeInTheDocument();

    await user.click(within(footer).getByRole('button', { name: 'Back to top' }));
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('footer has no map link without an address', async () => {
    renderHome({ shop: { ...SHOP, addressEn: '' } });
    await screen.findByRole('heading', { name: 'Contact the shop' });
    expect(screen.queryByRole('link', { name: 'Open in Google Maps' })).not.toBeInTheDocument();
  });
});

describe('Keeping the page short: gallery row and review box', () => {
  it('cards do not repeat the description (it is on the product page)', async () => {
    renderHome();
    await screen.findAllByRole('link', { name: /view details/i });
    expect(screen.queryByText('Sample description')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /description/i })).not.toBeInTheDocument();
  });

  it('shows the gallery as one sideways-scrolling row with arrow buttons when it overflows', async () => {
    const user = userEvent.setup();
    const many = { items: [1, 2, 3, 4, 5].map((n) => ({ id: `g${n}`, image: { url: `/uploads/gallery/${n}.jpg`, provider: 'local' }, captionEn: '', captionHi: '' })) };
    renderHome({ gallery: many });
    expect(await screen.findByText('5 photos – swipe to see all')).toBeInTheDocument();
    const list = screen.getByRole('button', { name: /^Shop photo 1/ }).closest('ul');
    expect(list).toHaveClass('overflow-x-auto', 'snap-x');
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);

    // jsdom has no layout: pretend the row is wider than the screen, then scroll it.
    Object.defineProperty(list, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 1200 });
    list.scrollBy = vi.fn();
    act(() => fireEvent.scroll(list));
    expect(screen.queryByRole('button', { name: 'Show previous photos' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show more photos' }));
    expect(list.scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' });

    list.scrollLeft = 900;
    act(() => fireEvent.scroll(list));
    expect(screen.getByRole('button', { name: 'Show previous photos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more photos' })).not.toBeInTheDocument();
  });

  it('does not show the swipe hint when two photos fit', async () => {
    renderHome({ gallery: GALLERY });
    await screen.findByRole('heading', { name: 'Photo gallery' });
    expect(screen.queryByText(/swipe to see all/)).not.toBeInTheDocument();
  });

  it('keeps reviews in a scrollable box with "Show more" inside it', async () => {
    getReviews.mockResolvedValue({ items: [1, 2, 3, 4, 5].map((n) => review(n)), total: 8, page: 1, limit: 5, totalPages: 2, averageRating: 5 });
    renderHome({ reviews: null });
    const box = await screen.findByRole('region', { name: 'Customer reviews (scroll to read more)' });
    expect(box).toHaveAttribute('tabindex', '0'); // keyboard users can scroll it
    expect(box).toHaveClass('overflow-y-auto');
    expect(within(box).getAllByRole('listitem')).toHaveLength(5);
    expect(within(box).getByRole('button', { name: 'Show more reviews' })).toBeInTheDocument();
  });
});

describe('Header and footer redesign', () => {
  it('nothing is pinned to the top: header and search bar scroll with the page', async () => {
    renderHome();
    const search = await screen.findByRole('searchbox');
    const header = screen.getByRole('banner');
    const searchBar = search.closest('div.space-y-2');
    expect(searchBar).not.toBeNull();
    for (const element of [header, searchBar]) {
      const classes = element.className.split(' ');
      expect(classes).not.toContain('sticky');
      expect(classes).not.toContain('fixed');
    }
  });

  it('footer shows the shop name in both languages with the short description', async () => {
    renderHome({ shop: { ...SHOP, descriptionEn: 'We provide cement and sand (sample).' } });
    const footer = (await screen.findByRole('heading', { name: 'Contact the shop' })).closest('footer');
    expect(within(footer).getByText('Sample Traders (demo)', { selector: 'p' })).toBeInTheDocument();
    expect(within(footer).getByText('नमूना ट्रेडर्स')).toHaveAttribute('lang', 'hi');
    expect(within(footer).getByText('We provide cement and sand (sample).')).toBeInTheDocument();
    expect(within(footer).getByRole('heading', { name: 'Call or message us' })).toBeInTheDocument();
    expect(within(footer).getByRole('heading', { name: 'Address' })).toBeInTheDocument();
  });
});
