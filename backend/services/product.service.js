import mongoose from 'mongoose';
import { Category, Product } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../validators/common.js';
import { assertCategoryExists } from './category.service.js';
import { deleteImage, saveImage } from './image.service.js';
import { serializeProduct } from './serializers.js';

const CATEGORY_FIELDS = 'nameEn nameHi isActive showDeliveryNote';

async function findProductOr404(id) {
  const product = mongoose.isValidObjectId(id) ? await Product.findById(id) : null;
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

async function loadSerialized(id) {
  const product = await Product.findById(id).populate('category', CATEGORY_FIELDS).lean();
  return serializeProduct(product);
}

/** Admin list: every product (active and hidden), with search, filters and pages. */
export async function listProducts({ search, category, availability, status, page, limit }) {
  const filter = {};
  if (category) filter.category = category;
  if (availability) filter.availability = availability;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const matchingCategories = await Category.find({ $or: [{ nameEn: pattern }, { nameHi: pattern }] }).distinct('_id');
    filter.$or = [{ nameEn: pattern }, { nameHi: pattern }, { brand: pattern }, { category: { $in: matchingCategories } }];
  }

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ nameEn: 1, nameHi: 1, _id: 1 })
      .collation({ locale: 'en', strength: 2 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', CATEGORY_FIELDS)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return {
    items: items.map(serializeProduct),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getProduct(id) {
  const product = await findProductOr404(id);
  return loadSerialized(product._id);
}

export async function createProduct(data) {
  await assertCategoryExists(data.category);
  const product = await Product.create({ ...data, priceUpdatedAt: new Date() });
  return loadSerialized(product._id);
}

/** Updates product details. The selling price is never changed here (see validators). */
export async function updateProduct(id, data) {
  const product = await findProductOr404(id);
  if (data.category && String(data.category) !== String(product.category)) {
    await assertCategoryExists(data.category);
  }
  product.set(data);
  await product.save(); // runs model validation, e.g. MRP vs current selling price
  return loadSerialized(product._id);
}

/** Permanently deletes a product and its image. Its price history is kept for the records. */
export async function deleteProduct(id) {
  const product = await findProductOr404(id);
  const image = product.image?.toObject?.() ?? product.image;
  await product.deleteOne();
  await deleteImage(image);
}

export async function setProductImage(id, buffer) {
  const product = await findProductOr404(id);
  const previous = product.image?.toObject?.() ?? product.image;
  const stored = await saveImage(buffer, 'products');
  try {
    product.image = stored;
    await product.save();
  } catch (error) {
    await deleteImage(stored); // do not leave an unused upload behind
    throw error;
  }
  await deleteImage(previous);
  return loadSerialized(product._id);
}

export async function removeProductImage(id) {
  const product = await findProductOr404(id);
  const previous = product.image?.toObject?.() ?? product.image;
  product.image = null;
  await product.save();
  await deleteImage(previous);
  return loadSerialized(product._id);
}
