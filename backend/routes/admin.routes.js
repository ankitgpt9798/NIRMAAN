import { Router } from 'express';
import * as categoryController from '../controllers/category.controller.js';
import * as communityController from '../controllers/community.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import * as priceController from '../controllers/price.controller.js';
import * as qrController from '../controllers/qr.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as shopController from '../controllers/shop.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { singleImage } from '../middleware/upload.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validators.js';
import { createProductSchema, listProductsQuery, updateProductSchema } from '../validators/product.validators.js';
import { updateShopSchema } from '../validators/shop.validators.js';
import { adminReviewsQuery, updateGalleryPhotoSchema, updateReviewSchema } from '../validators/community.validators.js';
import { priceHistoryQuery, updatePriceSchema } from '../validators/price.validators.js';

/**
 * Everything under /api/admin requires a logged-in admin. Authentication runs
 * before route matching, so even unknown admin URLs answer 401 to the public.
 */
export function createAdminRouter() {
  const router = Router();
  router.use(requireAuth, requireRole('admin'));

  router.get('/meta', dashboardController.meta);
  router.get('/dashboard/stats', dashboardController.stats);

  router.get('/categories', categoryController.list);
  router.post('/categories', validateBody(createCategorySchema), categoryController.create);
  router.put('/categories/:id', validateBody(updateCategorySchema), categoryController.update);
  router.delete('/categories/:id', categoryController.remove);

  router.get('/products', validateQuery(listProductsQuery), productController.list);
  router.post('/products', validateBody(createProductSchema), productController.create);
  router.get('/products/:id', productController.get);
  router.put('/products/:id', validateBody(updateProductSchema), productController.update);
  router.delete('/products/:id', productController.remove);
  router.put('/products/:id/image', singleImage('image'), productController.uploadImage);
  router.delete('/products/:id/image', productController.removeImage);

  // Manual price updates (each actual change is saved in price history).
  router.patch('/products/:id/price', validateBody(updatePriceSchema), priceController.updatePrice);
  router.get('/price-history', validateQuery(priceHistoryQuery), priceController.history);

  router.get('/shop', shopController.get);
  router.put('/shop', validateBody(updateShopSchema), shopController.update);
  router.put('/shop/logo', singleImage('image'), shopController.uploadLogo);
  router.delete('/shop/logo', shopController.removeLogo);
  router.put('/shop/photo', singleImage('image'), communityController.uploadShopPhoto);
  router.delete('/shop/photo', communityController.removeShopPhoto);

  // Photo gallery shown on the website.
  router.get('/gallery', communityController.listGallery);
  router.post('/gallery', singleImage('image'), communityController.addGalleryPhoto);
  router.put('/gallery/:id', validateBody(updateGalleryPhotoSchema), communityController.updateGalleryPhoto);
  router.delete('/gallery/:id', communityController.deleteGalleryPhoto);

  // Customer reviews: approve (show on the website), hide again, or delete.
  router.get('/reviews', validateQuery(adminReviewsQuery), communityController.listReviews);
  router.patch('/reviews/:id', validateBody(updateReviewSchema), communityController.updateReview);
  router.delete('/reviews/:id', communityController.deleteReview);

  // The permanent shop QR code (encodes only PUBLIC_SITE_URL).
  router.get('/qr-code', qrController.get);

  return router;
}
