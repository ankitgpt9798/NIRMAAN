import { describe, expect, it } from 'vitest';
import adminEn from './admin.en';
import adminHi from './admin.hi';
import en from './en';
import hi from './hi';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const DEVANAGARI = /[ऀ-ॿ]/;

describe('translations', () => {
  it('Hindi and English have exactly the same keys', () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it('no translation is empty', () => {
    for (const [lang, dictionary] of Object.entries({ en, hi })) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(typeof value === 'string' && value.trim().length > 0, `${lang}: ${key}`).toBe(true);
      }
    }
  });

  it('every text uses the same {placeholders} in both languages', () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(hi[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('Hindi texts are written in Devanagari (not left in English by mistake)', () => {
    for (const [key, value] of Object.entries(hi)) {
      expect(DEVANAGARI.test(value), `${key}: "${value}"`).toBe(true);
    }
  });

  it('contains the required customer messages', () => {
    expect(en['notice.prices']).toBe(
      'Prices may change according to market conditions. Please confirm the latest price with the shop before purchasing.',
    );
    expect(hi['notice.prices']).toMatch(/रेट बदल सकते हैं/);
    expect(hi['notice.delivery']).toMatch(/ढुलाई/);
    expect([hi['availability.in_stock'], hi['availability.out_of_stock'], hi['availability.unavailable']]).toEqual([
      'स्टॉक में उपलब्ध',
      'स्टॉक में नहीं',
      'अभी उपलब्ध नहीं',
    ]);
  });
});

describe('admin translations', () => {
  it('Hindi and English have exactly the same keys', () => {
    expect(Object.keys(adminHi).sort()).toEqual(Object.keys(adminEn).sort());
  });

  it('all admin keys are under "admin." and never clash with the customer texts', () => {
    for (const key of Object.keys(adminEn)) {
      expect(key.startsWith('admin.'), key).toBe(true);
      expect(en[key], key).toBeUndefined();
    }
  });

  it('no translation is empty and placeholders match', () => {
    for (const [key, value] of Object.entries(adminEn)) {
      expect(value.trim().length > 0, `en: ${key}`).toBe(true);
      expect(adminHi[key].trim().length > 0, `hi: ${key}`).toBe(true);
      expect(placeholders(adminHi[key]), key).toEqual(placeholders(value));
    }
  });

  it('Hindi admin texts are written in Devanagari', () => {
    for (const [key, value] of Object.entries(adminHi)) {
      expect(DEVANAGARI.test(value), `${key}: "${value}"`).toBe(true);
    }
  });
});
