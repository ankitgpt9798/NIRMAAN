import { z } from 'zod';
import { text } from './common.js';

const PHONE_PATTERN = /^\+?[0-9][0-9 -]{6,18}$/;

const phone = (label) =>
  z
    .string({ error: `${label} must be text` })
    .trim()
    .max(20, `${label} is too long`)
    .refine((value) => value === '' || PHONE_PATTERN.test(value), `${label}: use digits, spaces or "-" only, e.g. +91 98765 43210`);

/** Shop Settings: every field optional (only the fields sent are changed). */
export const updateShopSchema = z
  .object({
    nameEn: text(120, 'Shop name (English)'),
    nameHi: text(120, 'Shop name (Hindi)'),
    phone: phone('Phone number'),
    whatsapp: phone('WhatsApp number'),
    addressEn: text(300, 'Address (English)'),
    addressHi: text(300, 'Address (Hindi)'),
    descriptionEn: text(1000, 'Description (English)'),
    descriptionHi: text(1000, 'Description (Hindi)'),
    websiteUrl: text(300, 'Website')
      .refine((value) => value === '' || /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(value), 'Website must start with http:// or https://'),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Nothing to update');
