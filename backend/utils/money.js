/**
 * Prices are stored as Numbers in rupees with at most two decimal places (paise).
 * Values with more decimals are rejected rather than silently rounded, so the
 * owner always sees exactly what was saved.
 */
export function hasAtMostTwoDecimals(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}
