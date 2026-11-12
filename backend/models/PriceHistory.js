import mongoose from 'mongoose';
import { cleanJson, priceField } from './shared.js';

/**
 * One entry per actual selling-price change. Entries are append-only and the
 * timestamp is always set by the server.
 */
const priceHistorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    // Name snapshot so history stays readable even if the product is later deleted.
    productNameEn: { type: String, trim: true, maxlength: 120, default: '' },
    productNameHi: { type: String, trim: true, maxlength: 120, default: '' },
    previousPrice: priceField({ required: true, label: 'Previous price' }),
    newPrice: priceField({ required: true, label: 'New price' }),
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Updated by is required'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { transform: cleanJson },
  },
);

priceHistorySchema.index({ createdAt: -1 });
priceHistorySchema.index({ product: 1, createdAt: -1 });

export const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);
