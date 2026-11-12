import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { createAdminRouter } from './admin.routes.js';
import { createPublicRouter } from './public.routes.js';

export function createApiRouter() {
  const router = Router();

  router.use('/health', healthRoutes);
  router.use('/public', createPublicRouter());
  router.use('/auth', createAuthRouter());
  router.use('/admin', createAdminRouter());

  return router;
}
