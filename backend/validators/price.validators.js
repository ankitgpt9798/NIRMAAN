import { z } from 'zod';
import { money, objectId, optionalQuery, paginationQuery } from './common.js';

/**
 * Manual price update for one product.
 * - sellingPrice: the new price (required)
 * - mrp: optionally change the MRP at the same time (null removes it)
 * - expectedPrice: the price the owner's screen showed; if the price was changed
 *   meanwhile (e.g. from another phone) the update is refused instead of
 *   silently overwriting the newer price.
 */
export const updatePriceSchema = z
  .object({
    sellingPrice: money('Selling price'),
    mrp: money('MRP').nullable().optional(),
    expectedPrice: money('Expected price').optional(),
  })
  .strict()
  .refine((data) => data.mrp === null || data.mrp === undefined || data.mrp >= data.sellingPrice, {
    message: 'MRP cannot be lower than the selling price',
    path: ['mrp'],
  });

export const priceHistoryQuery = z.object({
  product: optionalQuery(objectId('Product')),
  search: optionalQuery(z.string().trim().max(100)),
  ...paginationQuery,
});
