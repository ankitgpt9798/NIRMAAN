import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../test/fixtures';
import { categoriesFromProducts, filterProducts, productMatches, telHref, whatsappHref, mapsHref } from './catalog';

describe('catalogue search', () => {
  it('matches English name, Hindi name, brand and category, ignoring case and extra spaces', () => {
    const [alpha, , sand] = PRODUCTS;
    expect(productMatches(alpha, 'ALPHA')).toBe(true);
    expect(productMatches(alpha, 'अल्फा')).toBe(true);
    expect(productMatches(alpha, 'demo brand')).toBe(true);
    expect(productMatches(alpha, '  cement  ')).toBe(true);
    expect(productMatches(alpha, 'सीमेंट')).toBe(true);
    expect(productMatches(sand, 'रेत')).toBe(true);
    expect(productMatches(sand, 'cement')).toBe(false);
  });

  it('requires every word of the query to match', () => {
    expect(productMatches(PRODUCTS[0], 'alpha cement')).toBe(true);
    expect(productMatches(PRODUCTS[0], 'alpha sand')).toBe(false);
  });

  it('treats an empty query as "show everything"', () => {
    expect(filterProducts(PRODUCTS, { query: '   ' })).toHaveLength(3);
  });

  it('filters by category and query together', () => {
    expect(filterProducts(PRODUCTS, { categoryId: 'c1' }).map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(filterProducts(PRODUCTS, { categoryId: 'c1', query: 'beta' }).map((p) => p.id)).toEqual(['p2']);
    expect(filterProducts(PRODUCTS, { categoryId: 'c2', query: 'beta' })).toEqual([]);
  });

  it('builds category buttons in catalogue order with counts', () => {
    expect(categoriesFromProducts(PRODUCTS).map((c) => [c.nameEn, c.count])).toEqual([
      ['Cement', 2],
      ['Sand', 1],
    ]);
  });
});

describe('contact links', () => {
  it('builds tap-to-call links', () => {
    expect(telHref('+91 90000-00000')).toBe('tel:+919000000000');
    expect(telHref('')).toBe('');
    expect(telHref('abc')).toBe('');
  });

  it('builds WhatsApp links with the Indian country code', () => {
    expect(whatsappHref('9000000000')).toBe('https://wa.me/919000000000');
    expect(whatsappHref('09000000000')).toBe('https://wa.me/919000000000');
    expect(whatsappHref('+91 90000 00000', 'Price of cement?')).toBe('https://wa.me/919000000000?text=Price%20of%20cement%3F');
    expect(whatsappHref('12345')).toBe('');
    expect(whatsappHref('')).toBe('');
  });
});

describe('Google Maps link', () => {
  it('searches for the shop name and address', () => {
    expect(mapsHref('Sample Traders', 'Sample Road, Demo Village')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Sample%20Traders%2C%20Sample%20Road%2C%20Demo%20Village',
    );
    expect(mapsHref('', '  नमूना रोड  ')).toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('नमूना रोड')}`);
    expect(mapsHref('', null)).toBe('');
  });
});
