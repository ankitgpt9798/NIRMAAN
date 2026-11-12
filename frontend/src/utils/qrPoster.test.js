import { describe, expect, it } from 'vitest';
import { FALLBACK_TITLE, INSTRUCTION_EN, INSTRUCTION_HI, POSTER_SIZE, TEST_LABEL, drawPoster, posterTexts, wrapText } from './qrPoster';

/** Records what drawPoster draws; every character is 30px wide. */
function fakeContext() {
  const texts = [];
  const images = [];
  return {
    texts,
    images,
    measureText: (text) => ({ width: text.length * 30 }),
    fillText: (text) => texts.push(text),
    drawImage: (image, x, y, w, h) => images.push({ image, x, y, w, h }),
    fillRect() {},
    strokeRect() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
  };
}

const QR = { id: 'qr-image' };

describe('QR poster', () => {
  it('uses the exact required instructions', () => {
    expect(INSTRUCTION_EN).toBe('Scan to Check Latest Prices');
    expect(INSTRUCTION_HI).toBe('नवीनतम रेट देखने के लिए स्कैन करें');
  });

  it('wraps long text into lines that fit', () => {
    const ctx = fakeContext();
    // "aaaa bbbb" = 9 characters = 270px (fits in 300px); adding " cccc" = 420px does not.
    expect(wrapText(ctx, 'aaaa bbbb cccc', 300)).toEqual(['aaaa bbbb', 'cccc']);
    expect(wrapText(ctx, 'aaaa bbbb cccc', 200)).toEqual(['aaaa', 'bbbb', 'cccc']);
    expect(wrapText(ctx, 'aaaa bbbb cccc', 600)).toEqual(['aaaa bbbb cccc']);
    expect(wrapText(ctx, '', 100)).toEqual([]);
  });

  it('draws shop names, both instructions, the QR code, phone and address', () => {
    const ctx = fakeContext();
    const texts = posterTexts({ shop: { nameHi: 'नमूना ट्रेडर्स', nameEn: 'Sample Traders', phone: '+91 90000 00000' }, url: 'https://myshop.vercel.app/', isProductionReady: true });
    drawPoster(ctx, { ...texts, qrImage: QR }, POSTER_SIZE);

    // Long lines may be wrapped; joined with a space they read as the original text.
    const drawn = ctx.texts.join(' ');
    expect(drawn).toContain('नमूना ट्रेडर्स');
    expect(drawn).toContain('Sample Traders');
    expect(drawn).toContain(INSTRUCTION_HI);
    expect(drawn).toContain(INSTRUCTION_EN);
    expect(drawn).toContain('+91 90000 00000');
    expect(drawn).toContain('https://myshop.vercel.app/');
    expect(drawn).not.toContain('TEST');

    expect(ctx.images).toHaveLength(1);
    const { image, x, y, w, h } = ctx.images[0];
    expect(image).toBe(QR);
    expect(w).toBe(h);
    expect(w).toBeGreaterThanOrEqual(600); // large enough to scan from a distance
    expect(x + w / 2).toBe(POSTER_SIZE.width / 2); // centred
    expect(y + h).toBeLessThan(POSTER_SIZE.height);
  });

  it('marks posters for development addresses as TEST ONLY', () => {
    const ctx = fakeContext();
    drawPoster(ctx, { ...posterTexts({ shop: {}, url: 'http://localhost:5173/', isProductionReady: false }), qrImage: QR }, POSTER_SIZE);
    expect(ctx.texts).toContain(TEST_LABEL);
    expect(ctx.texts).toContain('TEST ONLY');
  });

  it('uses a neutral bilingual title before the shop name is set', () => {
    expect(posterTexts({ shop: { nameEn: '', nameHi: '' }, url: 'https://x.example/', isProductionReady: true })).toMatchObject({
      titleHi: FALLBACK_TITLE.hi,
      titleEn: FALLBACK_TITLE.en,
      isTest: false,
    });
    expect(posterTexts({ shop: { nameEn: 'Only English' }, url: 'u', isProductionReady: true })).toMatchObject({ titleHi: '', titleEn: 'Only English' });
  });
});
