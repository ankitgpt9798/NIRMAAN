import mongoose from 'mongoose';
import { Category, Product, Shop } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../validators/common.js';
import { serializePublicCategory, serializePublicProduct, serializeShop } from './serializers.js';

/**
 * Customer-facing data. A product is visible only when it is active AND its
 * category is active. Out-of-stock and unavailable products stay visible with
 * their status. Prices always come straight from the database.
 */

const PUBLIC_CATEGORY_FIELDS = 'nameEn nameHi sortOrder showDeliveryNote';
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

const activeCategoryIds = () => Category.find({ isActive: true }).distinct('_id');

/** Category display order, then product name (English, or Hindi when there is no English name). */
function compareProducts(a, b) {
  const order = (a.category?.sortOrder ?? 0) - (b.category?.sortOrder ?? 0);
  if (order !== 0) return order;
  const byCategory = collator.compare(a.category?.nameEn || a.category?.nameHi || '', b.category?.nameEn || b.category?.nameHi || '');
  if (byCategory !== 0) return byCategory;
  return collator.compare(a.nameEn || a.nameHi, b.nameEn || b.nameHi) || String(a._id).localeCompare(String(b._id));
}

export async function listPublicProducts({ search, category, page, limit }) {
  const visibleCategories = await activeCategoryIds();
  const visible = { isActive: true, category: { $in: visibleCategories } };

  const filter = { ...visible };
  if (category) {
    // A hidden or unknown category simply has no visible products.
    filter.category = visibleCategories.some((id) => String(id) === category) ? category : { $in: [] };
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const matchingCategories = await Category.find({
      _id: { $in: visibleCategories },
      $or: [{ nameEn: pattern }, { nameHi: pattern }],
    }).distinct('_id');
    filter.$or = [{ nameEn: pattern }, { nameHi: pattern }, { brand: pattern }, { category: { $in: matchingCategories } }];
  }

  const [products, latest] = await Promise.all([
    Product.find(filter).populate('category', PUBLIC_CATEGORY_FIELDS).lean(),
    Product.findOne(visible).sort({ priceUpdatedAt: -1 }).select('priceUpdatedAt').lean(),
  ]);

  products.sort(compareProducts);
  const start = (page - 1) * limit;
  return {
    items: products.slice(start, start + limit).map(serializePublicProduct),
    total: products.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(products.length / limit)),
    lastUpdated: latest?.priceUpdatedAt ?? null,
  };
}

export async function getPublicProduct(id) {
  const product = mongoose.isValidObjectId(id)
    ? await Product.findOne({ _id: id, isActive: true }).populate('category', `${PUBLIC_CATEGORY_FIELDS} isActive`).lean()
    : null;
  if (!product || !product.category?.isActive) throw ApiError.notFound('Product not found');
  return serializePublicProduct(product);
}

export async function listPublicCategories() {
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, nameEn: 1 }).collation({ locale: 'en', strength: 2 }).lean();
  const counts = await Product.aggregate([
    { $match: { isActive: true, category: { $in: categories.map((c) => c._id) } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((row) => [String(row._id), row.count]));
  return categories.map((category) => serializePublicCategory(category, countById.get(String(category._id)) ?? 0));
}

/** Read-only: never creates the shop document (that happens when the owner saves settings). */
export async function getPublicShop() {
  return serializeShop(await Shop.findOne({ key: 'default' }).lean());
}
