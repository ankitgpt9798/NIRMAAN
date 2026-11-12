const wholeRupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rupeesAndPaise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,250 for whole amounts, ₹65.50 when there are paise. */
export function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  const amount = Number(value);
  return Number.isInteger(amount) ? wholeRupees.format(amount) : rupeesAndPaise.format(amount);
}

// Dates and product names in the chosen language: formatDate / formatDateTime / pick from useI18n().

/**
 * Parses a price typed by the owner ("1,250", "₹ 380.50"). Returns
 * { value: number|null, error: '' | 'format' | 'tooLarge' } - value is null for an
 * empty field. Show an error with t(`admin.money.${error}`, { label }).
 */
export function parseMoney(input) {
  const cleaned = String(input ?? '').replace(/[₹,\s]/g, '');
  if (cleaned === '') return { value: null, error: '' };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { value: null, error: 'format' };
  const value = Number(cleaned);
  if (value > 10_000_000) return { value: null, error: 'tooLarge' };
  return { value, error: '' };
}

/** "+₹10 (+2.7%)" / "−₹5.50 (−1.4%)" for a price change. */
export function formatPriceChange(difference, percentChange, noChangeText = 'No change') {
  if (!difference) return noChangeText;
  const sign = difference > 0 ? '+' : '−';
  const percent = typeof percentChange === 'number' ? ` (${sign}${Math.abs(percentChange)}%)` : '';
  return `${sign}${formatPrice(Math.abs(difference))}${percent}`;
}

/** True for changes big enough to double-check (a missing or extra zero is a common typo). */
export function isLargePriceChange(oldPrice, newPrice, threshold = 0.5) {
  if (typeof oldPrice !== 'number' || typeof newPrice !== 'number' || oldPrice === newPrice) return false;
  if (oldPrice === 0) return newPrice > 0;
  return Math.abs(newPrice - oldPrice) / oldPrice > threshold;
}

