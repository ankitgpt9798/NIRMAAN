import mongoose from 'mongoose';
import { cleanJson, imageSchema } from './shared.js';

const PHONE_PATTERN = /^\+?[0-9][0-9 -]{6,18}$/;
const optionalPhone = (label) => ({
  type: String,
  trim: true,
  maxlength: 20,
  default: '',
  validate: {
    validator: (value) => value === '' || PHONE_PATTERN.test(value),
    message: `${label} should contain only digits, spaces, "-" and an optional leading "+"`,
  },
});

/**
 * Shop details shown on the public website. There is exactly one shop document
 * (key "default"); use Shop.getSettings() instead of creating documents directly.
 */
const shopSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', immutable: true, unique: true },
    nameEn: { type: String, trim: true, maxlength: 120, default: '' },
    nameHi: { type: String, trim: true, maxlength: 120, default: '' },
    logo: { type: imageSchema, default: null },
    // Big photo of the shop, shown below the product list on the website.
    photo: { type: imageSchema, default: null },
    phone: optionalPhone('Phone number'),
    whatsapp: optionalPhone('WhatsApp number'),
    addressEn: { type: String, trim: true, maxlength: 300, default: '' },
    addressHi: { type: String, trim: true, maxlength: 300, default: '' },
    descriptionEn: { type: String, trim: true, maxlength: 1000, default: '' },
    descriptionHi: { type: String, trim: true, maxlength: 1000, default: '' },
    websiteUrl: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
      validate: {
        validator: (value) => value === '' || /^https?:\/\/[^\s]+$/i.test(value),
        message: 'Website URL must start with http:// or https://',
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.key;
        return cleanJson(doc, ret);
      },
    },
  },
);

shopSchema.statics.getSettings = function getSettings() {
  return this.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
};

export const Shop = mongoose.model('Shop', shopSchema);
