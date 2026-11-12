import { AVAILABILITY } from '../constants/catalog.js';
import { Category, PriceHistory, Product } from '../models/index.js';
import { countPendingReviews } from './review.service.js';

/**
 * Summary numbers for the admin dashboard. Stock counts include only active
 * (visible) products, because those are what customers see.
 */
export async function getDashboardStats() {
  const [productRows, categoryRows, recent, pendingReviews] = await Promise.all([
    Product.aggregate([{ $group: { _id: { isActive: '$isActive', availability: '$availability' }, count: { $sum: 1 } } }]),
    Category.aggregate([{ $group: { _id: '$isActive', count: { $sum: 1 } } }]),
    PriceHistory.find().sort({ createdAt: -1 }).limit(5).populate('updatedBy', 'name').lean(),
    countPendingReviews(),
  ]);

  const products = { total: 0, active: 0, inactive: 0, inStock: 0, outOfStock: 0, unavailable: 0 };
  for (const { _id, count } of productRows) {
    products.total += count;
    if (!_id.isActive) {
      products.inactive += count;
      continue;
    }
    products.active += count;
    if (_id.availability === AVAILABILITY.IN_STOCK) products.inStock += count;
    if (_id.availability === AVAILABILITY.OUT_OF_STOCK) products.outOfStock += count;
    if (_id.availability === AVAILABILITY.UNAVAILABLE) products.unavailable += count;
  }

  const categories = { total: 0, active: 0 };
  for (const { _id, count } of categoryRows) {
    categories.total += count;
    if (_id) categories.active += count;
  }

  return {
    products,
    categories,
    pendingReviews,
    recentPriceUpdates: recent.map((entry) => ({
      id: String(entry._id),
      productId: String(entry.product),
      productNameEn: entry.productNameEn,
      productNameHi: entry.productNameHi,
      previousPrice: entry.previousPrice,
      newPrice: entry.newPrice,
      updatedBy: entry.updatedBy?.name ?? 'Unknown',
      createdAt: entry.createdAt,
    })),
  };
}
