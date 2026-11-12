import { describe, expect, it } from 'vitest';
import { dictionaries } from '../i18n/dictionaries';
import '../i18n/admin';
import { formatPriceChange, isLargePriceChange, parseMoney } from './format';
import { describeDraftError, evaluateDraft } from './priceDraft';

const product = { sellingPrice: 370, mrp: 400 };
// Minimal t() over the real dictionaries (same lookup as I18nProvider).
const translator = (lang) => (key, vars = {}) =>
  (dictionaries[lang][key] ?? key).replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
const errorText = (draft, lang = 'en') => {
  const { error } = evaluateDraft(product, draft);
  return error ? describeDraftError(error, translator(lang)) : '';
};

describe('Update Prices row logic', () => {
  it('an empty box keeps the current price', () => {
    expect(evaluateDraft(product, { price: '' })).toMatchObject({ sellingPrice: 370, mrp: 400, hasChanges: false });
    expect(evaluateDraft(product, undefined)).toMatchObject({ hasChanges: false });
  });

  it('detects a price change and accepts typed formats', () => {
    expect(evaluateDraft(product, { price: '380' })).toMatchObject({ sellingPrice: 380, priceChanged: true, mrpChanged: false });
    expect(errorText({ price: '₹ 1,380' })).toMatch(/MRP/); // above MRP 400
    expect(evaluateDraft(product, { price: '385.50' })).toMatchObject({ sellingPrice: 385.5 });
  });

  it('rejects text, negative numbers and more than 2 decimals', () => {
    for (const price of ['abc', '-5', '10.555', '1e5']) {
      expect(evaluateDraft(product, { price }).error, price).toEqual({ key: 'admin.money.format', labelKey: 'admin.label.newPrice' });
      expect(errorText({ price }), price).toMatch(/New price must be a number/);
    }
  });

  it('checks the MRP against the new price, and allows clearing or raising it', () => {
    expect(errorText({ price: '450' })).toBe('MRP (₹400) cannot be lower than the selling price (₹450). Raise the MRP too, or clear it.');
    expect(evaluateDraft(product, { price: '450', mrp: '460' })).toMatchObject({ sellingPrice: 450, mrp: 460, mrpChanged: true });
    expect(evaluateDraft(product, { price: '450', mrp: '' })).toMatchObject({ mrp: null, mrpChanged: true });
    expect(evaluateDraft({ sellingPrice: 8, mrp: null }, { price: '9' })).toMatchObject({ mrp: null, mrpChanged: false });
  });

  it('flags big changes that may be typos', () => {
    expect(isLargePriceChange(380, 3800)).toBe(true);
    expect(isLargePriceChange(380, 38)).toBe(true);
    expect(isLargePriceChange(380, 400)).toBe(false);
    expect(isLargePriceChange(380, 380)).toBe(false);
  });

  it('formats price differences', () => {
    expect(formatPriceChange(10, 2.7)).toBe('+₹10 (+2.7%)');
    expect(formatPriceChange(-5.5, -1.4)).toBe('−₹5.50 (−1.4%)');
    expect(formatPriceChange(0, 0)).toBe('No change');
    expect(formatPriceChange(0, 0, 'कोई बदलाव नहीं')).toBe('कोई बदलाव नहीं');
  });

  it('returns error codes for typed amounts (translated when shown)', () => {
    expect(parseMoney('')).toEqual({ value: null, error: '' });
    expect(parseMoney('₹ 1,250.50')).toEqual({ value: 1250.5, error: '' });
    expect(parseMoney('12a')).toEqual({ value: null, error: 'format' });
    expect(parseMoney('99999999')).toEqual({ value: null, error: 'tooLarge' });
    expect(errorText({ price: '99999999' })).toBe('New price looks too large; please check the amount');
  });

  it('describes the same errors in Hindi', () => {
    for (const draft of [{ price: 'abc' }, { price: '450' }, { price: '99999999' }, { price: '380', mrp: 'x' }]) {
      const text = errorText(draft, 'hi');
      expect(text, JSON.stringify(draft)).toMatch(/[ऀ-ॿ]/);
      expect(text, JSON.stringify(draft)).not.toMatch(/\{\w+\}/);
    }
    expect(errorText({ price: '450' }, 'hi')).toContain('₹400');
  });
});
