import mongoose from 'mongoose';
import { Category, Product } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeCategory } from './serializers.js';

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

async function findCategoryOr404(id) {
  const category = mongoose.isValidObjectId(id) ? await Category.findById(id) : null;
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

/** Rejects a name already used by another category (ignoring letter case). */
async function assertUniqueNames({ nameEn, nameHi }, excludeId) {
  const conditions = [];
  if (nameEn?.trim()) conditions.push({ nameEn: nameEn.trim() });
  if (nameHi?.trim()) conditions.push({ nameHi: nameHi.trim() });
  if (!conditions.length) return;

  const filter = { $or: conditions, ...(excludeId ? { _id: { $ne: excludeId } } : {}) };
  const duplicate = await Category.findOne(filter).collation(CASE_INSENSITIVE).lean();
  if (duplicate) {
    const englishClash = Boolean(nameEn?.trim()) && duplicate.nameEn.toLowerCase() === nameEn.trim().toLowerCase();
    throw ApiError.conflict('A category with this name already exists', [
      { field: englishClash ? 'nameEn' : 'nameHi', message: 'Name already used by another category' },
    ]);
  }
}

async function productCounts() {
  const rows = await Product.aggregate([
    { $group: { _id: '$category', total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

export async function listCategories() {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ sortOrder: 1, nameEn: 1 }).collation(CASE_INSENSITIVE).lean(),
    productCounts(),
  ]);
  return categories.map((category) => {
    const count = counts.get(String(category._id));
    return serializeCategory(category, { productCount: count?.total ?? 0, activeProductCount: count?.active ?? 0 });
  });
}

export async function createCategory(data) {
  await assertUniqueNames(data);
  const category = await Category.create(data);
  return serializeCategory(category.toObject(), { productCount: 0, activeProductCount: 0 });
}

export async function updateCategory(id, data) {
  const category = await findCategoryOr404(id);
  const merged = { nameEn: data.nameEn ?? category.nameEn, nameHi: data.nameHi ?? category.nameHi };
  await assertUniqueNames(merged, category._id);
  category.set(data);
  await category.save();
  const [total, active] = await Promise.all([
    Product.countDocuments({ category: category._id }),
    Product.countDocuments({ category: category._id, isActive: true }),
  ]);
  return serializeCategory(category.toObject(), { productCount: total, activeProductCount: active });
}

/** Only empty categories can be deleted; otherwise the owner should move products or deactivate it. */
export async function deleteCategory(id) {
  const category = await findCategoryOr404(id);
  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    throw ApiError.conflict(
      `This category still has ${productCount} product${productCount === 1 ? '' : 's'}. Move or delete them first, or deactivate the category instead.`,
    );
  }
  await category.deleteOne();
}

export async function assertCategoryExists(id) {
  if (!mongoose.isValidObjectId(id) || !(await Category.exists({ _id: id }))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid', [{ field: 'category', message: 'Category not found' }]);
  }
}
