import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QrCodePage from './QrCodePage';
import { getQrCode } from '../../services/adminApi';
import { createPosterPng, downloadDataUrl } from '../../utils/qrPoster';
import { I18nProvider, setTestLanguage } from '../../test/adminI18n';

vi.mock('../../services/adminApi', async (importOriginal) => ({ ...(await importOriginal()), getQrCode: vi.fn() }));
vi.mock('../../utils/qrPoster', async (importOriginal) => ({
  ...(await importOriginal()),
  createPosterPng: vi.fn(),
  downloadDataUrl: vi.fn(),
}));

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const PRODUCTION = {
  url: 'https://myshop.vercel.app/',
  isProductionReady: true,
  warnings: [],
  notes: [],
  svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  pngDataUrl: PNG,
  shop: { nameEn: 'Sample Traders (demo)', nameHi: 'नमूना ट्रेडर्स', phone: '+91 90000 00000' },
};
const DEVELOPMENT = {
  ...PRODUCTION,
  url: 'http://localhost:5173/',
  isProductionReady: false,
  warnings: [
    { code: 'LOCALHOST', message: 'This is this computer’s own address (localhost). Customers’ phones cannot open it.' },
    { code: 'NOT_HTTPS', message: 'The address starts with http:// instead of https://.' },
  ],
};

function renderPage(data, lang = 'en') {
  getQrCode.mockResolvedValue(data);
  setTestLanguage(lang);
  return render(
    <MemoryRouter>
      <I18nProvider>
        <QrCodePage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('QR Code page', () => {
  it('shows the QR code, the address it opens and "ready to print" for a production address', async () => {
    renderPage(PRODUCTION);
    expect(await screen.findByText('Ready to print.')).toBeInTheDocument();
    const images = screen.getAllByAltText('QR code that opens https://myshop.vercel.app/');
    expect(images.length).toBe(2); // QR card + poster
    images.forEach((img) => expect(img).toHaveAttribute('src', PNG));
    expect(screen.getByRole('link', { name: /open website/i })).toHaveAttribute('href', 'https://myshop.vercel.app/');
    expect(screen.queryByText(/TEST ONLY/)).not.toBeInTheDocument();
  });

  it('offers the QR code as PNG and SVG downloads', async () => {
    renderPage(PRODUCTION);
    const png = await screen.findByRole('link', { name: /download qr \(png\)/i });
    expect(png).toHaveAttribute('href', PNG);
    expect(png).toHaveAttribute('download', 'shop-qr-code.png');
    const svg = screen.getByRole('link', { name: /download qr \(svg\)/i });
    expect(svg).toHaveAttribute('download', 'shop-qr-code.svg');
    expect(decodeURIComponent(svg.getAttribute('href'))).toBe(`data:image/svg+xml;charset=utf-8,${PRODUCTION.svg}`);
  });

  it('shows a print-ready poster with shop name, both instructions and phone', async () => {
    renderPage(PRODUCTION);
    const poster = await screen.findByTestId('qr-poster');
    expect(within(poster).getByText('नमूना ट्रेडर्स')).toHaveAttribute('lang', 'hi');
    expect(within(poster).getByText('Sample Traders (demo)')).toBeInTheDocument();
    expect(within(poster).getByText('नवीनतम रेट देखने के लिए स्कैन करें')).toBeInTheDocument();
    expect(within(poster).getByText('Scan to Check Latest Prices')).toBeInTheDocument();
    expect(within(poster).getByText('+91 90000 00000')).toBeInTheDocument();
    expect(within(poster).getByText('https://myshop.vercel.app/')).toBeInTheDocument();
    expect(poster).toHaveClass('qr-print-area');
  });

  it('downloads the poster as a PNG image', async () => {
    const user = userEvent.setup();
    createPosterPng.mockResolvedValue('data:image/png;base64,POSTER');
    renderPage(PRODUCTION);
    await user.click(await screen.findByRole('button', { name: /download poster/i }));

    await waitFor(() => expect(downloadDataUrl).toHaveBeenCalledWith('data:image/png;base64,POSTER', 'shop-qr-poster.png'));
    expect(createPosterPng).toHaveBeenCalledWith({
      qrPngDataUrl: PNG,
      titleHi: 'नमूना ट्रेडर्स',
      titleEn: 'Sample Traders (demo)',
      phone: '+91 90000 00000',
      url: 'https://myshop.vercel.app/',
      isTest: false,
    });
    expect(await screen.findByText('Poster downloaded.')).toBeInTheDocument();
  });

  it('explains when the poster image cannot be created', async () => {
    const user = userEvent.setup();
    createPosterPng.mockRejectedValue(new Error('This browser cannot create the poster image. Use “Print poster” instead.'));
    renderPage(PRODUCTION);
    await user.click(await screen.findByRole('button', { name: /download poster/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Use “Print poster” instead/);
  });

  it('prints only the poster', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPage(PRODUCTION);
    await user.click(await screen.findByRole('button', { name: /print poster/i }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('copies the address', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPage(PRODUCTION);
    await user.click(await screen.findByRole('button', { name: /copy address/i }));
    expect(writeText).toHaveBeenCalledWith('https://myshop.vercel.app/');
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();
  });

  it('warns not to print a development address and marks everything as TEST', async () => {
    const user = userEvent.setup();
    createPosterPng.mockResolvedValue('data:image/png;base64,POSTER');
    renderPage(DEVELOPMENT);

    expect(await screen.findByText(/do not print this qr code yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Customers’ phones cannot open it/)).toBeInTheDocument();
    expect(screen.getAllByText('PUBLIC_SITE_URL').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('qr-poster')).getByText('TEST ONLY – DO NOT PRINT')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download qr \(png\)/i })).toHaveAttribute('download', 'TEST-shop-qr-code.png');

    await user.click(screen.getByRole('button', { name: /download poster/i }));
    await waitFor(() => expect(downloadDataUrl).toHaveBeenCalledWith(expect.any(String), 'TEST-shop-qr-poster.png'));
    expect(createPosterPng.mock.calls[0][0].isTest).toBe(true);
  });

  it('shows a note when the Shop Settings website differs', async () => {
    renderPage({ ...PRODUCTION, notes: ['The website address in Shop Settings (https://old.example.com) is different from the QR code address.'] });
    expect(await screen.findByText(/is different from the QR code address/)).toBeInTheDocument();
  });

  it('uses a neutral bilingual title before the shop name is set', async () => {
    renderPage({ ...PRODUCTION, shop: { nameEn: '', nameHi: '', phone: '' } });
    const poster = await screen.findByTestId('qr-poster');
    expect(within(poster).getByText('निर्माण सामग्री की रेट सूची')).toBeInTheDocument();
    expect(within(poster).getByText('Building Material Price List')).toBeInTheDocument();
  });
});
