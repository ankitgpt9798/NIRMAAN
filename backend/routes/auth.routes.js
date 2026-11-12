import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { createLoginLimiter } from '../middleware/rateLimiters.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema } from '../validators/auth.validators.js';

// There is intentionally no registration route: admins are created with
// `npm run create-admin` on a machine that has the database credentials.
export function createAuthRouter() {
  const router = Router();
  router.post('/login', createLoginLimiter(), validateBody(loginSchema), authController.login);
  router.get('/me', requireAuth, authController.me);
  return router;
}
