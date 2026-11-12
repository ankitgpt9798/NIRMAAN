import { Router } from 'express';
import * as communityController from '../controllers/community.controller.js';
import * as publicController from '../controllers/public.controller.js';
import { createReviewLimiter } from '../middleware/rateLimiters.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { publicReviewsQuery, submitReviewSchema } from '../validators/community.validators.js';
import { publicProductsQuery } from '../validators/public.validators.js';

/**
 * Customer-facing endpoints. No login required. All are read-only except sending
 * a review, which is rate-limited and waits for the owner's approval.
 *
 * "Cache-Control: no-cache" makes browsers and proxies check with the server on
 * every visit, so a changed price is shown immediately. Unchanged data is answered
 * with a tiny "304 Not Modified" (via ETag), which saves mobile data.
 */
export function createPublicRouter() {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    next();
  });

  router.get('/shop', publicController.shop);
  router.get('/categories', publicController.categories);
  router.get('/products', validateQuery(publicProductsQuery), publicController.products);
  router.get('/products/:id', publicController.product);
  router.get('/gallery', communityController.publicGallery);
  router.get('/reviews', validateQuery(publicReviewsQuery), communityController.publicReviews);
  router.post('/reviews', createReviewLimiter(), validateBody(submitReviewSchema), communityController.submitReview);
  return router;
}
