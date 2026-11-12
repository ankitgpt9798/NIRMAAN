import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { Shop } from '../models/index.js';
import { analyseSiteUrl } from '../utils/siteUrl.js';

export { analyseSiteUrl };

/**
 * The permanent shop QR code.
 *
 * It encodes ONLY the website address from PUBLIC_SITE_URL – never prices,
 * products or shop details – so it never needs to be reprinted when those change.
 * The same address always produces exactly the same image.
 */

// Highest error correction: still scans if up to ~30% of a printed code is dirty or torn.
// A 4-module white border is the standard "quiet zone" scanners need.
const QR_OPTIONS = Object.freeze({ errorCorrectionLevel: 'H', margin: 4, color: { dark: '#000000', light: '#ffffff' } });
export const QR_PNG_SIZE = 1024;

/** QR images for an address: SVG (vector, best for print shops) and a 1024px PNG data URL. */
export async function generateQrImages(text) {
  const [svg, pngDataUrl] = await Promise.all([
    QRCode.toString(text, { ...QR_OPTIONS, type: 'svg' }),
    QRCode.toDataURL(text, { ...QR_OPTIONS, type: 'image/png', width: QR_PNG_SIZE }),
  ]);
  return { svg, pngDataUrl };
}

const normalise = (address) => {
  try {
    return new URL(address).href;
  } catch {
    return address;
  }
};

/** Everything the admin QR page needs. */
export async function getShopQrCode() {
  const analysis = analyseSiteUrl(env.PUBLIC_SITE_URL);
  const [images, shop] = await Promise.all([generateQrImages(analysis.url), Shop.findOne({ key: 'default' }).lean()]);

  // Same shape as the warnings: a code the admin page translates, plus an English message.
  const notes = [];
  if (shop?.websiteUrl && normalise(shop.websiteUrl) !== analysis.url) {
    notes.push({
      code: 'WEBSITE_DIFFERS',
      website: shop.websiteUrl,
      message: `The website address in Shop Settings (${shop.websiteUrl}) is different from the QR code address. The QR code always uses the server setting PUBLIC_SITE_URL.`,
    });
  }

  return {
    ...analysis,
    notes,
    ...images,
    shop: {
      nameEn: shop?.nameEn ?? '',
      nameHi: shop?.nameHi ?? '',
      phone: shop?.phone ?? '',
    },
  };
}
