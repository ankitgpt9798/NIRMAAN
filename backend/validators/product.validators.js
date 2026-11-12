import { z } from 'zod';
import { AVAILABILITY_VALUES, UNIT_KEYS } from '../constants/catalog.js';
import { money, objectId, optionalQuery, paginationQuery, text } from './common.js';

const detailFields = {
  nameEn: text(120, 'English name'),
  nameHi: text(120, 'Hindi name'),
  brand: text(80, 'Brand'),
  category: objectId('Category'),
  descriptionEn: text(1000, 'English description'),
  descriptionHi: text(1000, 'Hindi description'),
  unit: z.enum(UNIT_KEYS, { error: 'Choose a measurement unit from the list' }),
  mrp: money('MRP').nullable(),
  availability: z.enum(AVAILABILITY_VALUES, { error: 'Choose In Stock, Out of Stock or Currently Unavailable' }),
  isActive: z.boolean({ error: 'Active must be true or false' }),
};

const needsAName = (data) => Boolean(data.nameEn?.trim() || data.nameHi?.trim());
const nameIssue = { message: 'Product name is required in English or Hindi', path: ['nameEn'] };
const mrpNotBelowPrice = (data) => data.mrp === null || data.mrp === undefined || data.mrp >= data.sellingPrice;
const mrpIssue = { message: 'MRP cannot be lower than the selling price', path: ['mrp'] };

export const createProductSchema = z
  .object({
    ...detailFields,
    nameEn: detailFields.nameEn.default(''),
    nameHi: detailFields.nameHi.default(''),
    brand: detailFields.brand.default(''),
    descriptionEn: detailFields.descriptionEn.default(''),
    descriptionHi: detailFields.descriptionHi.default(''),
    mrp: detailFields.mrp.default(null),
    availability: detailFields.availability.default('in_stock'),
    isActive: detailFields.isActive.default(true),
    // Initial price only. Later changes go through the price update flow,
    // which records price history.
    sellingPrice: money('Selling price'),
  })
  .strict()
  .refine(needsAName, nameIssue)
  .refine(mrpNotBelowPrice, mrpIssue);

/**
 * Editing product details. The selling price is deliberately NOT editable here:
 * price and availability are managed separately, and every price change must
 * go through the price update flow so it is recorded in price history.
 */
export const updateProductSchema = z
  .object({
    ...detailFields,
    sellingPrice: z
      .never({ error: 'The selling price is changed from "Update Prices" so the change is saved in price history' })
      .optional(),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Nothing to update');

export const listProductsQuery = z.object({
  search: optionalQuery(z.string().trim().max(100)),
  category: optionalQuery(objectId('Category')),
  availability: optionalQuery(z.enum(AVAILABILITY_VALUES)),
  status: optionalQuery(z.enum(['active', 'inactive', 'all'])).transform((value) => value ?? 'all'),
  ...paginationQuery,
});
