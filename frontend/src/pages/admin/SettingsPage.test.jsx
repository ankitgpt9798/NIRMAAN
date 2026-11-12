import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import { deleteShopLogo, deleteShopPhoto, getShopSettings, updateShopSettings, uploadShopLogo, uploadShopPhoto } from '../../services/adminApi';
import { EMPTY_SHOP, httpError } from '../../test/fixtures';
import { I18nProvider, setTestLanguage } from '../../test/adminI18n';

vi.mock('../../services/adminApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getShopSettings: vi.fn(),
    updateShopSettings: vi.fn(),
    uploadShopLogo: vi.fn(),
    deleteShopLogo: vi.fn(),
    uploadShopPhoto: vi.fn(),
    deleteShopPhoto: vi.fn(),
  };
});

const SAVED = {
  ...EMPTY_SHOP,
  nameEn: 'Sample Traders (demo)',
  nameHi: 'नमूना ट्रेडर्स',
  phone: '+91 90000 00000',
  addressHi: 'नमूना पता',
  logo: { url: 'https://res.cloudinary.com/demo/logo.png', provider: 'cloudinary' },
  updatedAt: '2026-11-10T08:00:00.000Z',
};

const renderPage = (lang = 'en') => {
  setTestLanguage(lang);
  return render(
    <MemoryRouter>
      <I18nProvider>
        <SettingsPage />
      </I18nProvider>
    </MemoryRouter>,
  );
};

describe('Shop Settings page', () => {
  it('loads the saved shop details into the form', async () => {
    getShopSettings.mockResolvedValue(SAVED);
    renderPage();
    expect(await screen.findByLabelText('Shop name (Hindi)')).toHaveValue('नमूना ट्रेडर्स');
    expect(screen.getByLabelText('Shop name (English)')).toHaveValue('Sample Traders (demo)');
    expect(screen.getByLabelText('Phone number')).toHaveValue('+91 90000 00000');
    expect(screen.getByLabelText('Address (Hindi)')).toHaveValue('नमूना पता');
    expect(screen.getByAltText('Shop logo (optional) preview')).toHaveAttribute('src', SAVED.logo.url);
  });

  it('saves bilingual details and confirms', async () => {
    const user = userEvent.setup();
    getShopSettings.mockResolvedValue({ ...EMPTY_SHOP, updatedAt: null });
    updateShopSettings.mockImplementation(async (body) => ({ ...EMPTY_SHOP, ...body, updatedAt: '2026-11-10T09:00:00.000Z' }));
    renderPage();

    await user.type(await screen.findByLabelText('Shop name (Hindi)'), 'नमूना ट्रेडर्स');
    await user.type(screen.getByLabelText('Shop name (English)'), 'Sample Traders (demo)');
    await user.type(screen.getByLabelText('Phone number'), '9000000000');
    await user.type(screen.getByLabelText('Address (Hindi)'), 'नमूना पता');
    await user.click(screen.getByRole('button', { name: /save shop details/i }));

    expect(await screen.findByText(/shop details saved/i)).toBeInTheDocument();
    expect(updateShopSettings).toHaveBeenCalledWith(
      expect.objectContaining({ nameHi: 'नमूना ट्रेडर्स', nameEn: 'Sample Traders (demo)', phone: '9000000000', addressHi: 'नमूना पता', whatsapp: '' }),
    );
    expect(uploadShopLogo).not.toHaveBeenCalled();
    expect(deleteShopLogo).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Shop name (Hindi)')).toHaveValue('नमूना ट्रेडर्स');
  });

  it('checks phone numbers and the website address before saving', async () => {
    const user = userEvent.setup();
    getShopSettings.mockResolvedValue({ ...EMPTY_SHOP, updatedAt: null });
    renderPage();

    await user.type(await screen.findByLabelText('Phone number'), 'call me');
    await user.type(screen.getByLabelText('Website address (optional)'), 'yourshop.com');
    await user.click(screen.getByRole('button', { name: /save shop details/i }));

    expect(screen.getByText('Please correct the highlighted fields.')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/start with https:\/\//i)).toBeInTheDocument();
    expect(updateShopSettings).not.toHaveBeenCalled();
  });

  it('shows errors returned by the server next to the field', async () => {
    const user = userEvent.setup();
    getShopSettings.mockResolvedValue({ ...EMPTY_SHOP, updatedAt: null });
    const error = httpError(400, 'Some fields are invalid');
    error.response.data.error.details = [{ field: 'nameEn', message: 'Shop name (English) must be at most 120 characters' }];
    updateShopSettings.mockRejectedValue(error);
    renderPage();

    await user.type(await screen.findByLabelText('Shop name (English)'), 'Too long name');
    await user.click(screen.getByRole('button', { name: /save shop details/i }));
    expect(await screen.findByText('Shop name (English) must be at most 120 characters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save shop details/i })).toBeEnabled();
  });

  it('uploads a new logo after saving the details', async () => {
    const user = userEvent.setup();
    getShopSettings.mockResolvedValue({ ...EMPTY_SHOP, updatedAt: null });
    updateShopSettings.mockResolvedValue({ ...EMPTY_SHOP, updatedAt: '2026-11-10T09:00:00.000Z' });
    uploadShopLogo.mockResolvedValue({ ...EMPTY_SHOP, logo: { url: 'https://res.cloudinary.com/demo/new.png', provider: 'cloudinary' }, updatedAt: '2026-11-10T09:00:01.000Z' });
    renderPage();

    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('Choose shop logo'), file);
    expect(await screen.findByText(/new photo will be uploaded when you save/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save shop details/i }));

    await waitFor(() => expect(uploadShopLogo).toHaveBeenCalledTimes(1));
    expect(uploadShopLogo.mock.calls[0][0].name).toBe('logo.png');
    expect(await screen.findByAltText('Shop logo (optional) preview')).toHaveAttribute('src', 'https://res.cloudinary.com/demo/new.png');
  });

  it('removes the logo', async () => {
    const user = userEvent.setup();
    getShopSettings.mockResolvedValue(SAVED);
    updateShopSettings.mockResolvedValue(SAVED);
    deleteShopLogo.mockResolvedValue({ ...SAVED, logo: null, updatedAt: '2026-11-10T09:30:00.000Z' });
    renderPage();

    await user.click(await screen.findByRole('button', { name: /remove/i }));
    await user.click(screen.getByRole('button', { name: /save shop details/i }));
    await waitFor(() => expect(deleteShopLogo).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/shop details saved/i)).toBeInTheDocument();
    expect(screen.queryByAltText('Shop logo (optional) preview')).not.toBeInTheDocument();
  });

  it('uploads the big shop photo after saving the details', async () => {
    const user = userEvent.setup();
    const photoUrl = 'https://res.cloudinary.com/demo/image/upload/c_limit,h_1600,w_1600/shop.jpg';
    getShopSettings.mockResolvedValue({ ...EMPTY_SHOP, updatedAt: null });
    updateShopSettings.mockResolvedValue({ ...EMPTY_SHOP, updatedAt: '2026-11-11T09:00:00.000Z' });
    uploadShopPhoto.mockResolvedValue({ ...EMPTY_SHOP, photo: { url: photoUrl, provider: 'cloudinary' }, updatedAt: '2026-11-11T09:00:01.000Z' });
    renderPage();

    await user.upload(await screen.findByLabelText('Choose shop photo'), new File(['sample'], 'front.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /save shop details/i }));
    await waitFor(() => expect(uploadShopPhoto).toHaveBeenCalledTimes(1));
    expect(uploadShopLogo).not.toHaveBeenCalled();
    expect(await screen.findByText(/shop details saved/i)).toBeInTheDocument();
    expect(screen.getByAltText('Big shop photo (optional) preview')).toHaveAttribute('src', photoUrl);
  });

  it('saves the details even when the shop photo cannot be uploaded, and says so', async () => {
    const user = userEvent.setup();
    getShopSettings.mockResolvedValue({ ...EMPTY_SHOP, updatedAt: null });
    updateShopSettings.mockResolvedValue({ ...EMPTY_SHOP, nameEn: 'Sample Traders (demo)', updatedAt: '2026-11-11T09:00:00.000Z' });
    const failed = httpError(502, 'The image could not be uploaded. Please try again.');
    failed.response.data.error.code = 'IMAGE_UPLOAD_FAILED';
    uploadShopPhoto.mockRejectedValue(failed);
    renderPage();

    await user.upload(await screen.findByLabelText('Choose shop photo'), new File(['sample'], 'front.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /save shop details/i }));
    expect(
      await screen.findByText('Shop details were saved, but the shop photo could not be updated: The image could not be uploaded. Please try again. Please try the photo again.'),
    ).toBeInTheDocument();
    expect(updateShopSettings).toHaveBeenCalledTimes(1);
  });

  it('removes the shop photo without touching the logo', async () => {
    const user = userEvent.setup();
    const withPhoto = { ...SAVED, logo: null, photo: { url: '/uploads/shop/photo.jpg', provider: 'local' } };
    getShopSettings.mockResolvedValue(withPhoto);
    updateShopSettings.mockResolvedValue(withPhoto);
    deleteShopPhoto.mockResolvedValue({ ...withPhoto, photo: null, updatedAt: '2026-11-11T09:30:00.000Z' });
    renderPage();

    await user.click(await screen.findByRole('button', { name: /remove/i }));
    await user.click(screen.getByRole('button', { name: /save shop details/i }));
    await waitFor(() => expect(deleteShopPhoto).toHaveBeenCalledTimes(1));
    expect(deleteShopLogo).not.toHaveBeenCalled();
    expect(await screen.findByText(/shop details saved/i)).toBeInTheDocument();
  });
});
