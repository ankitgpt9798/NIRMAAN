/**
 * Printable A4 QR poster, drawn in the browser (no extra libraries):
 * shop name, the Hindi and English instructions, the QR code, phone and address.
 */

export const POSTER_SIZE = Object.freeze({ width: 1240, height: 1754 }); // A4 portrait at 150 dpi
export const INSTRUCTION_HI = 'नवीनतम रेट देखने के लिए स्कैन करें';
export const INSTRUCTION_EN = 'Scan to Check Latest Prices';
export const FALLBACK_TITLE = { hi: 'निर्माण सामग्री की रेट सूची', en: 'Building Material Price List' };
export const TEST_LABEL = 'TEST ONLY – DO NOT PRINT';

const COLORS = { brand: '#265d44', brandDark: '#1f4a37', text: '#0f172a', muted: '#475569', test: '#dc2626' };
const DEVANAGARI_FONT = '"Noto Sans Devanagari", "Kohinoor Devanagari", "Nirmala UI", "Mangal", system-ui, sans-serif';
const LATIN_FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

/** Splits text into lines that fit `maxWidth` with the context's current font. */
export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Poster texts from the QR API response (shop names fall back to a neutral title). */
export function posterTexts({ shop, url, isProductionReady }) {
  const titleHi = shop?.nameHi || (shop?.nameEn ? '' : FALLBACK_TITLE.hi);
  const titleEn = shop?.nameEn || (shop?.nameHi ? '' : FALLBACK_TITLE.en);
  return { titleHi, titleEn, phone: shop?.phone ?? '', url, isTest: !isProductionReady };
}

function centeredLines(ctx, lines, centerX, startY, lineHeight) {
  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, centerX, y);
    y += lineHeight;
  }
  return y;
}

/** Draws the poster onto a 2D canvas context. `qrImage` is a loaded image of the QR code. */
export function drawPoster(ctx, { qrImage, titleHi, titleEn, phone, url, isTest }, { width, height } = POSTER_SIZE) {
  const centerX = width / 2;
  const contentWidth = width - 240;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = COLORS.brand;
  ctx.lineWidth = 16;
  ctx.strokeRect(48, 48, width - 96, height - 96);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = 120;

  if (isTest) {
    ctx.fillStyle = COLORS.test;
    ctx.fillRect(48, 48, width - 96, 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 48px ${LATIN_FONT}`;
    ctx.fillText(TEST_LABEL, centerX, 68);
    y = 190;
  }

  if (titleHi) {
    ctx.fillStyle = COLORS.brandDark;
    ctx.font = `700 84px ${DEVANAGARI_FONT}`;
    y = centeredLines(ctx, wrapText(ctx, titleHi, contentWidth), centerX, y, 112);
  }
  if (titleEn) {
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 56px ${LATIN_FONT}`;
    y = centeredLines(ctx, wrapText(ctx, titleEn, contentWidth), centerX, y + 8, 72);
  }

  // Hindi instruction on a green band (text vertically centred), English below it.
  y += 40;
  ctx.font = `700 62px ${DEVANAGARI_FONT}`;
  const hiLines = wrapText(ctx, INSTRUCTION_HI, contentWidth - 60);
  const lineHeight = 86;
  const bandHeight = hiLines.length * lineHeight + 44;
  ctx.fillStyle = COLORS.brand;
  ctx.fillRect(120, y, width - 240, bandHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  centeredLines(ctx, hiLines, centerX, y + 22 + lineHeight / 2, lineHeight);
  ctx.textBaseline = 'top';
  y += bandHeight + 30;

  ctx.fillStyle = COLORS.text;
  ctx.font = `700 54px ${LATIN_FONT}`;
  y = centeredLines(ctx, wrapText(ctx, INSTRUCTION_EN, contentWidth), centerX, y, 68);

  // QR code: as large as the remaining space allows, kept sharp (no smoothing).
  const footer = (phone ? 80 : 0) + 140;
  const qrSize = Math.max(300, Math.min(width - 320, height - y - footer - 60));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrImage, centerX - qrSize / 2, y + 30, qrSize, qrSize);
  y += qrSize + 60;

  if (phone) {
    ctx.fillStyle = COLORS.text;
    ctx.font = `600 46px ${LATIN_FONT}`;
    ctx.fillText(`Phone / फ़ोन: ${phone}`, centerX, y);
    y += 76;
  }
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 34px ${LATIN_FONT}`;
  centeredLines(ctx, wrapText(ctx, url, contentWidth), centerX, y, 44);

  if (isTest) {
    ctx.save();
    ctx.translate(centerX, height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = COLORS.test;
    ctx.font = `800 120px ${LATIN_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('TEST ONLY', 0, 0);
    ctx.restore();
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Object.assign(new Error('The QR image could not be loaded.'), { i18nKey: 'admin.qr.posterFailed' }));
    image.src = src;
  });
}

/** Builds the poster as a PNG data URL. */
export async function createPosterPng({ qrPngDataUrl, ...texts }) {
  // Built-in fonts are always ready; nothing needs to be downloaded before drawing.
  const qrImage = await loadImage(qrPngDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_SIZE.width;
  canvas.height = POSTER_SIZE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw Object.assign(new Error('This browser cannot create the poster image. Use “Print poster” instead.'), { i18nKey: 'admin.qr.posterCanvas' });
  }
  drawPoster(ctx, { ...texts, qrImage }, POSTER_SIZE);
  return canvas.toDataURL('image/png');
}

/** Starts a file download (on iPhones the image opens and can be saved with a long press). */
export function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
