import { z } from 'zod';
import { objectId, optionalQuery } from './common.js';

/**
 * Customer catalogue query. By default all visible products are returned in one
 * response (a shop catalogue is small) so the website can search instantly
 * without further requests. Pages are available if the catalogue grows.
 */
export const publicProductsQuery = z.object({
  search: optionalQuery(z.string().trim().max(100)),
  category: optionalQuery(objectId('Category')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
