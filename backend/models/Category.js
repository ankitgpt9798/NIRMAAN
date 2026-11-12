import mongoose from 'mongoose';
import { cleanJson, requireOneLanguage } from './shared.js';

const categorySchema = new mongoose.Schema(
  {
    nameEn: { type: String, trim: true, maxlength: 80, default: '' },
    nameHi: { type: String, trim: true, maxlength: 80, default: '' },
    descriptionEn: { type: String, trim: true, maxlength: 500, default: '' },
    descriptionHi: { type: String, trim: true, maxlength: 500, default: '' },
    isActive: { type: Boolean, default: true },
    // Lower numbers appear first in the customer filter bar.
    sortOrder: { type: Number, default: 0, min: 0, max: 9999 },
    // Show "transport/delivery charges may vary" on this category's products (e.g. sand, gravel).
    showDeliveryNote: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { transform: cleanJson } },
);

requireOneLanguage(categorySchema, 'nameEn', 'nameHi', 'Category name');

categorySchema.index({ isActive: 1, sortOrder: 1 });

export const Category = mongoose.model('Category', categorySchema);
