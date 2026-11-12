import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GalleryPage from './GalleryPage';
import ReviewsPage from './ReviewsPage';
import { addGalleryPhoto, deleteGalleryPhoto, deleteReview, listGallery, listReviews, setReviewStatus, updateGalleryPhoto } from '../../services/adminApi';
import { httpError } from '../../test/fixtures';
import { I18nProvider, setTestLanguage } from '../../test/adminI18n';

vi.mock('../../services/adminApi', async (importOriginal) => ({
  ...(await importOriginal()),
  listGallery: vi.fn(),
  addGalleryPhoto: vi.fn(),
  updateGalleryPhoto: vi.fn(),
  deleteGalleryPhoto: vi.fn(),
  listReviews: vi.fn(),
  setReviewStatus: vi.fn(),
  deleteReview: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

// Sample data for tests only.
const photo = (id, extra = {}) => ({ id, image: { url: `/uploads/gallery/${id}.jpg`, provider: 'local' }, captionEn: '', captionHi: '', createdAt: '2026-11-10T10:00:00.000Z', ...extra });
const file = (name) => new File(['sample'], name, { type: 'image/jpeg' });
const review = (id, extra = {}) => ({ id, name: `Sample Customer ${id}`, rating: 4, comment: 'Good service (sample)', createdAt: '2026-11-10T10:00:00.000Z', status: 'pending', approvedAt: null, ...extra });
const reviewPage = (items, counts) => ({ items, counts, total: items.length, page: 1, limit: 20, totalPages: 1 });

function renderPage(page, lang = 'en') {
  setTestLanguage(lang);
  return render(
    <MemoryRouter>
      <I18nProvider>{page}</I18nProvider>
    </MemoryRouter>,
  );
}

describe('Photo Gallery admin page', () => {
  it('lists the photos with how many more fit', async () => {
    listGallery.mockResolvedValue({ items: [photo('g1', { captionEn: 'Shop front (sample)' }), photo('g2')], max: 40 });
    renderPage(<GalleryPage />);
    expect(await screen.findByText('2 of 40 photos')).toBeInTheDocument();
    expect(screen.getByAltText('Shop front (sample)')).toBeInTheDocument();
    expect(screen.getByAltText('Gallery photo 2')).toBeInTheDocument();
  });

  it('uploads several chosen photos one after another', async () => {
    const user = userEvent.setup();
    listGallery.mockResolvedValue({ items: [], max: 40 });
    addGalleryPhoto.mockImplementation(async (chosen) => photo(chosen.name.replace('.jpg', '')));
    renderPage(<GalleryPage />);
    expect(await screen.findByText('No photos yet')).toBeInTheDocument();

    await user.upload(screen.getByLabelText('Choose photos to add to the gallery'), [file('new1.jpg'), file('new2.jpg')]);
    expect(await screen.findByText('2 photos added.')).toBeInTheDocument();
    expect(addGalleryPhoto).toHaveBeenCalledTimes(2);
    expect(screen.getByText('2 of 40 photos')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('explains which photos could not be added', async () => {
    const user = userEvent.setup();
    listGallery.mockResolvedValue({ items: [photo('g1')], max: 40 });
    const full = httpError(409, 'The gallery is full');
    full.response.data.error.code = 'GALLERY_FULL';
    addGalleryPhoto.mockResolvedValueOnce(photo('ok')).mockRejectedValueOnce(full);
    renderPage(<GalleryPage />);
    await user.upload(await screen.findByLabelText('Choose photos to add to the gallery'), [file('a.jpg'), file('b.jpg')]);
    expect(await screen.findByText('1 of 2 photos could not be added: The gallery is full. Delete a photo first.')).toBeInTheDocument();
  });

  it('only uploads as many photos as still fit, and stops adding when full', async () => {
    const user = userEvent.setup();
    listGallery.mockResolvedValue({ items: [photo('g1')], max: 2 });
    addGalleryPhoto.mockResolvedValue(photo('g2'));
    renderPage(<GalleryPage />);
    await user.upload(await screen.findByLabelText('Choose photos to add to the gallery'), [file('a.jpg'), file('b.jpg')]);
    expect(await screen.findByText(/1 of 2 photos could not be added/)).toBeInTheDocument();
    expect(addGalleryPhoto).toHaveBeenCalledTimes(1);
    expect(screen.getByText('The gallery is full (2 photos). Delete a photo to add a new one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeDisabled();
  });

  it('saves captions in Hindi and English', async () => {
    const user = userEvent.setup();
    listGallery.mockResolvedValue({ items: [photo('g1')], max: 40 });
    updateGalleryPhoto.mockImplementation(async (id, body) => photo(id, body));
    renderPage(<GalleryPage />);
    const save = await screen.findByRole('button', { name: 'Save caption' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('Caption (Hindi, optional)'), 'दुकान (नमूना)');
    await user.click(save);
    expect(await screen.findByText('Caption saved.')).toBeInTheDocument();
    expect(updateGalleryPhoto).toHaveBeenCalledWith('g1', { captionHi: 'दुकान (नमूना)', captionEn: '' });
    expect(screen.getByAltText('दुकान (नमूना)')).toBeInTheDocument();
  });

  it('deletes a photo after confirming', async () => {
    const user = userEvent.setup();
    listGallery.mockResolvedValue({ items: [photo('g1'), photo('g2')], max: 40 });
    deleteGalleryPhoto.mockResolvedValue({ id: 'g1', deleted: true });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderPage(<GalleryPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete photo 1' }));
    expect(deleteGalleryPhoto).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete photo 1' }));
    expect(await screen.findByText('Photo deleted.')).toBeInTheDocument();
    expect(deleteGalleryPhoto).toHaveBeenCalledWith('g1');
    expect(screen.getByText('1 of 40 photos')).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledWith('Delete this photo from the gallery permanently?');
  });
});

describe('Reviews admin page', () => {
  it('shows reviews waiting for approval and approves one', async () => {
    const user = userEvent.setup();
    listReviews.mockResolvedValueOnce(reviewPage([review('1'), review('2', { comment: '' })], { pending: 2, approved: 0 }));
    listReviews.mockResolvedValue(reviewPage([review('2', { comment: '' })], { pending: 1, approved: 1 }));
    setReviewStatus.mockResolvedValue(review('1', { status: 'approved' }));
    renderPage(<ReviewsPage />);

    expect(await screen.findByText('Sample Customer 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Waiting (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('img', { name: '4 out of 5 stars' })).toHaveLength(2);
    expect(screen.getByText('(no comment, only stars)')).toBeInTheDocument();
    expect(listReviews).toHaveBeenCalledWith({ status: 'pending', page: 1, limit: 20 });

    await user.click(screen.getByRole('button', { name: 'Approve and show – Sample Customer 1' }));
    expect(await screen.findByText('The review by "Sample Customer 1" is now shown on the website.')).toBeInTheDocument();
    expect(setReviewStatus).toHaveBeenCalledWith('1', 'approved');
    await waitFor(() => expect(screen.queryByText('Sample Customer 1')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Shown on website (1)' })).toBeInTheDocument();
  });

  it('hides an approved review and deletes after confirming', async () => {
    const user = userEvent.setup();
    listReviews.mockImplementation(async ({ status }) =>
      status === 'approved' ? reviewPage([review('3', { status: 'approved' })], { pending: 0, approved: 1 }) : reviewPage([], { pending: 0, approved: 1 }),
    );
    setReviewStatus.mockResolvedValue(review('3'));
    deleteReview.mockResolvedValue({ id: '3', deleted: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage(<ReviewsPage />);

    expect(await screen.findByText('No reviews waiting')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Shown on website (1)' }));
    const card = (await screen.findByText('Sample Customer 3')).closest('li');
    await user.click(within(card).getByRole('button', { name: 'Hide from website – Sample Customer 3' }));
    expect(await screen.findByText('The review by "Sample Customer 3" is hidden and back in "Waiting".')).toBeInTheDocument();
    expect(setReviewStatus).toHaveBeenCalledWith('3', 'pending');

    await user.click(within(card).getByRole('button', { name: 'Delete – Sample Customer 3' }));
    expect(await screen.findByText('The review by "Sample Customer 3" was deleted.')).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledWith('Delete the review by "Sample Customer 3" permanently?');
  });

  it('is in Hindi by default', async () => {
    listReviews.mockResolvedValue(reviewPage([review('1')], { pending: 1, approved: 0 }));
    listGallery.mockResolvedValue({ items: [], max: 40 });
    window.sessionStorage.clear();
    render(
      <MemoryRouter>
        <I18nProvider>
          <ReviewsPage />
          <GalleryPage />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'इंतज़ार में (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'मंज़ूर करें और दिखाएँ – Sample Customer 1' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '5 में से 4 स्टार' })).toBeInTheDocument();
    expect(await screen.findByText('अभी कोई फ़ोटो नहीं')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'फ़ोटो जोड़ें' })).toBeInTheDocument();
  });
});
