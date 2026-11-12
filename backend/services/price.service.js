import mongoose from 'mongoose';
import { PriceHistory, Product } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../validators/common.js';
import { serializeProduct } from './serializers.js';

/**
 * Manual price management. Prices only ever change here, by the owner's action;
 * nothing in the application fetches or adjusts prices automatically.
 */

const roundMoney = (value) => Math.round(value * 100) / 100;

/**
 * Changes a product's selling price (and optionally its MRP).
 * The product update and its price history entry are saved in one database
 * transaction, so there is never a price change without a history entry (or the
 * other way round). History is written only when the selling price actually changes.
 */
export async function updatePrice(productId, { sellingPrice, mrp, expectedPrice }, adminId) {
  if (!mongoose.isValidObjectId(productId)) throw ApiError.notFound('Product not found');

  const result = await mongoose.connection.transaction(async (session) => {
    const product = await Product.findById(productId).session(session);
    if (!product) throw ApiError.notFound('Product not found');

    if (expectedPrice !== undefined && product.sellingPrice !== expectedPrice) {
      throw new ApiError(409, 'PRICE_CHANGED', 'This price was changed meanwhile (for example from another phone). Please check the new price and try again.', [
        { field: 'sellingPrice', message: 'Price changed meanwhile', currentPrice: product.sellingPrice },
      ]);
    }

    const previousPrice = product.sellingPrice;
    const changed = previousPrice !== sellingPrice;
    const changedAt = new Date(); // server time, never the phone's clock

    product.sellingPrice = sellingPrice;
    if (mrp !== undefined) product.mrp = mrp;
    if (changed) product.priceUpdatedAt = changedAt;
    await product.save({ session }); // model validation: MRP not below the selling price

    let entryId = null;
    if (changed) {
      const [entry] = await PriceHistory.create(
        [
          {
            product: product._id,
            productNameEn: product.nameEn,
            productNameHi: product.nameHi,
            previousPrice,
            newPrice: sellingPrice,
            updatedBy: adminId,
          },
        ],
        { session },
      );
      entryId = String(entry._id);
    }
    return { changed, previousPrice, historyEntryId: entryId };
  });

  const product = await Product.findById(productId).populate('category', 'nameEn nameHi isActive showDeliveryNote').lean();
  return { ...result, product: serializeProduct(product) };
}

function serializeHistoryEntry(entry) {
  const productDoc = entry.product && typeof entry.product === 'object' && 'nameEn' in entry.product ? entry.product : null;
  const difference = roundMoney(entry.newPrice - entry.previousPrice);
  return {
    id: String(entry._id),
    product: {
      id: String(productDoc?._id ?? entry.product),
      // Current name if the product still exists, otherwise the name saved with the entry.
      nameEn: productDoc?.nameEn ?? entry.productNameEn,
      nameHi: productDoc?.nameHi ?? entry.productNameHi,
      deleted: !productDoc,
    },
    previousPrice: entry.previousPrice,
    newPrice: entry.newPrice,
    difference,
    percentChange: entry.previousPrice > 0 ? Math.round((difference / entry.previousPrice) * 1000) / 10 : null,
    updatedBy: entry.updatedBy && typeof entry.updatedBy === 'object' ? { id: String(entry.updatedBy._id), name: entry.updatedBy.name } : null,
    createdAt: entry.createdAt,
  };
}

/** Price changes, newest first. Filter by product or search by product name. */
export async function listPriceHistory({ product, search, page, limit }) {
  const filter = {};
  if (product) filter.product = product;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const matchingProducts = await Product.find({ $or: [{ nameEn: pattern }, { nameHi: pattern }] }).distinct('_id');
    filter.$or = [{ productNameEn: pattern }, { productNameHi: pattern }, { product: { $in: matchingProducts } }];
  }

  const [items, total] = await Promise.all([
    PriceHistory.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('product', 'nameEn nameHi')
      .populate('updatedBy', 'name')
      .lean(),
    PriceHistory.countDocuments(filter),
  ]);

  return {
    items: items.map(serializeHistoryEntry),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
