import { z } from 'zod';
import { REVIEW_LIMITS, REVIEW_STATUS_VALUES } from '../constants/community.js';
import { optionalQuery, text } from './common.js';

/** Gallery photo captions (both optional). */
export const updateGalleryPhotoSchema = z
  .object({
    captionEn: text(150, 'Caption (English)'),
    captionHi: text(150, 'Caption (Hindi)'),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Nothing to update');

/**
 * A review sent from the website. Strict: a customer cannot set the status or any
 * other field. `website` is the hidden anti-bot field (see review.service.js).
 */
export const submitReviewSchema = z
  .object({
    name: text(REVIEW_LIMITS.name, 'Name').min(1, 'Name is required'),
    rating: z
      .number({ error: 'Rating must be from 1 to 5 stars' })
      .int('Rating must be a whole number of stars')
      .min(1, 'Rating must be from 1 to 5 stars')
      .max(5, 'Rating must be from 1 to 5 stars'),
    comment: text(REVIEW_LIMITS.comment, 'Comment').optional(),
    website: z.string().max(200).optional(),
  })
  .strict();

export const publicReviewsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const adminReviewsQuery = z.object({
  status: optionalQuery(z.enum(REVIEW_STATUS_VALUES)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateReviewSchema = z.object({ status: z.enum(REVIEW_STATUS_VALUES, { error: 'Choose pending or approved' }) }).strict();
