import mongoose from 'mongoose';
import { AVAILABILITY, AVAILABILITY_VALUES, UNIT_KEYS } from '../constants/catalog.js';
import { cleanJson, imageSchema, priceField, requireOneLanguage } from './shared.js';

const productSchema = new mongoose.Schema(
  {
    nameEn: { type: String, trim: true, maxlength: 120, default: '' },
    nameHi: { type: String, trim: true, maxlength: 120, default: '' },
    brand: { type: String, trim: true, maxlength: 80, default: '' },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    descriptionEn: { type: String, trim: true, maxlength: 1000, default: '' },
    descriptionHi: { type: String, trim: true, maxlength: 1000, default: '' },
    image: { type: imageSchema, default: null },
    unit: {
      type: String,
      required: [true, 'Measurement unit is required'],
      enum: { values: UNIT_KEYS, message: 'Measurement unit "{VALUE}" is not supported' },
    },
    mrp: { ...priceField({ label: 'MRP' }), default: null },
    sellingPrice: priceField({ required: true, label: 'Selling price' }),
    availability: {
      type: String,
      enum: { values: AVAILABILITY_VALUES, message: 'Availability "{VALUE}" is not valid' },
      default: AVAILABILITY.IN_STOCK,
    },
    isActive: { type: Boolean, default: true },
    // When the selling price last changed (shown to customers as "Last updated").
    // Separate from updatedAt, which also changes for description/stock edits.
    priceUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { transform: cleanJson } },
);

requireOneLanguage(productSchema, 'nameEn', 'nameHi', 'Product name');

productSchema.pre('validate', function checkMrp() {
  const { mrp, sellingPrice } = this;
  // Only compare two valid amounts; negative/missing values get their own field errors.
  const comparable = typeof mrp === 'number' && typeof sellingPrice === 'number' && mrp >= 0 && sellingPrice >= 0;
  if (comparable && mrp < sellingPrice) {
    this.invalidate('mrp', 'MRP cannot be lower than the selling price');
  }
});

// Public catalogue: active products, optionally within one category.
productSchema.index({ isActive: 1, category: 1 });
// Dashboard "recently updated prices" and the site-wide "last updated" date.
productSchema.index({ priceUpdatedAt: -1 });

export const Product = mongoose.model('Product', productSchema);
