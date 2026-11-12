/** Pure helpers for the customer catalogue (search, filters, contact links). */

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('en-IN')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when every word of the query appears in the product's English or Hindi
 * name, brand or category name, so "ultratech cement" and "सीमेंट" both work.
 */
export function productMatches(product, query) {
  const words = normalizeText(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeText(
    [product.nameEn, product.nameHi, product.brand, product.category?.nameEn, product.category?.nameHi].join(' '),
  );
  return words.every((word) => haystack.includes(word));
}

export function filterProducts(products, { query = '', categoryId = '' } = {}) {
  return products.filter((product) => (!categoryId || product.category?.id === categoryId) && productMatches(product, query));
}

/** Categories that have products, in the catalogue's order, with product counts. */
export function categoriesFromProducts(products) {
  const byId = new Map();
  for (const product of products) {
    const category = product.category;
    if (!category) continue;
    const entry = byId.get(category.id) ?? { ...category, count: 0 };
    entry.count += 1;
    byId.set(category.id, entry);
  }
  return [...byId.values()];
}

export function telHref(phone) {
  const cleaned = String(phone ?? '').replace(/[^\d+]/g, '');
  return cleaned.replace(/\D/g, '').length >= 6 ? `tel:${cleaned}` : '';
}

/** WhatsApp chat link. 10-digit Indian numbers get the +91 country code. */
export function whatsappHref(number, message = '') {
  let digits = String(number ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11) return '';
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

/** Google Maps search link for the shop (a normal link: nothing is loaded until it is tapped). */
export function mapsHref(...parts) {
  const query = parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(', ');
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '';
}
