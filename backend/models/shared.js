import mongoose from 'mongoose';
import { hasAtMostTwoDecimals } from '../utils/money.js';
import { MAX_PRICE } from '../constants/catalog.js';

/** Stored image reference. `publicId` lets Cloudinary/local files be deleted later. */
export const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 500 },
    publicId: { type: String, trim: true, maxlength: 300, default: '' },
    provider: { type: String, enum: ['cloudinary', 'local'], required: true },
  },
  { _id: false },
);

/** Price field options shared by Product and PriceHistory. */
export function priceField({ required = false, label = 'Price' } = {}) {
  return {
    type: Number,
    required: required ? [true, `${label} is required`] : false,
    min: [0, `${label} cannot be negative`],
    max: [MAX_PRICE, `${label} looks too large; please check the amount`],
    validate: {
      validator: (value) => value === null || value === undefined || hasAtMostTwoDecimals(value),
      message: `${label} can have at most 2 decimal places`,
    },
  };
}

/**
 * Bilingual names: at least one language must be filled in. The website shows
 * the customer's chosen language and falls back to the other one.
 */
export function requireOneLanguage(schema, enField, hiField, label) {
  schema.pre('validate', function checkBilingualName() {
    if (!this[enField]?.trim() && !this[hiField]?.trim()) {
      this.invalidate(enField, `${label} is required in English or Hindi`);
    }
  });
}

/** Removes internal fields from API output. */
export function cleanJson(_doc, ret) {
  delete ret.__v;
  return ret;
}
