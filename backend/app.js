import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { createApiRouter } from './routes/index.js';
import { createApiLimiter } from './middleware/rateLimiters.js';
import { uploadsRoot } from './services/image.service.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      // Requests without an Origin header (curl, health checks) are allowed;
      // browsers are limited to the configured frontend origins.
      origin(origin, callback) {
        callback(null, !origin || env.CORS_ORIGINS.includes(origin));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  // Locally stored images (only used when Cloudinary is not configured). File names
  // are random, so they can be cached for a long time and embedded by the website.
  app.use(
    '/uploads',
    helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
    express.static(uploadsRoot, { index: false, dotfiles: 'deny', maxAge: '30d', immutable: true, fallthrough: true }),
  );

  app.use('/api', createApiLimiter(), createApiRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
