import { formatPrice, isLargePriceChange, parseMoney } from './format';

/**
 * Works out what one row of the Update Prices screen would save.
 * `draft` holds what the owner typed: { price, mrp } (text). An empty price box
 * means "keep the current price".
 * Returns { error: { key, labelKey?, vars? } } or
 * { sellingPrice, mrp, priceChanged, mrpChanged, hasChanges }.
 * Show an error with describeDraftError(error, t).
 */
export function evaluateDraft(product, draft) {
  const priceInput = parseMoney(draft?.price ?? '');
  if (priceInput.error) return { error: { key: `admin.money.${priceInput.error}`, labelKey: 'admin.label.newPrice' } };
  const mrpInput = parseMoney(draft?.mrp ?? product.mrp ?? '');
  if (mrpInput.error) return { error: { key: `admin.money.${mrpInput.error}`, labelKey: 'admin.label.mrp' } };

  const sellingPrice = priceInput.value ?? product.sellingPrice;
  const mrp = mrpInput.value;
  if (mrp !== null && mrp < sellingPrice) {
    return { error: { key: 'admin.prices.errMrpBelow', vars: { mrp: formatPrice(mrp), price: formatPrice(sellingPrice) } } };
  }
  const priceChanged = sellingPrice !== product.sellingPrice;
  const mrpChanged = mrp !== (product.mrp ?? null);
  return { sellingPrice, mrp, priceChanged, mrpChanged, hasChanges: priceChanged || mrpChanged };
}

export function describeDraftError(error, t) {
  return t(error.key, { ...error.vars, ...(error.labelKey ? { label: t(error.labelKey) } : {}) });
}

/** Asks the owner to double-check unusually big changes (likely typos). Returns true to continue. */
export function confirmLargeChanges(rows, t, nameOf) {
  const large = rows.filter(({ product, plan }) => isLargePriceChange(product.sellingPrice, plan.sellingPrice));
  if (!large.length) return true;
  const lines = large.map(({ product, plan }) => `• ${nameOf(product)}: ${formatPrice(product.sellingPrice)} → ${formatPrice(plan.sellingPrice)}`);
  return window.confirm(t('admin.prices.confirmLarge', { lines: lines.join('\n') }));
}
