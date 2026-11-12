import mongoose from 'mongoose';
import { z } from 'zod';
import { MAX_PRICE } from '../constants/catalog.js';
import { hasAtMostTwoDecimals } from '../utils/money.js';

export const objectId = (label = 'id') =>
  z.string({ error: `${label} is required` }).refine((value) => mongoose.isValidObjectId(value), `${label} is not valid`);

/** Rupee amount: a real number (not text, NaN or Infinity), 0 or more, at most 2 decimal places. */
export const money = (label) =>
  z
    .number({ error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(MAX_PRICE, `${label} looks too large; please check the amount`)
    .refine(hasAtMostTwoDecimals, `${label} can have at most 2 decimal places`);

export const text = (max, label) =>
  z.string({ error: `${label} must be text` }).trim().max(max, `${label} must be at most ${max} characters`);

/** Treats an empty query-string value (e.g. ?category=) as "not provided". */
export const optionalQuery = (schema) => z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
};

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
