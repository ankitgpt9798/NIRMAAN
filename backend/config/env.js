import { isIP } from 'node:net';
import { z } from 'zod';

/**
 * All configuration comes from environment variables (backend/.env locally,
 * the hosting dashboard in production). Values are validated once at startup
 * so a missing or malformed setting fails fast with a readable message.
 */

const PLACEHOLDER_PATTERN = /<[^>]+>|CHANGE_ME|YOUR_/i;

const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  // Checked in config/db.js when a connection is attempted, so the app (and the
  // database-free tests) can load without a configured Atlas cluster.
  MONGODB_URI: z.string().trim().optional(),
  MONGODB_DB_NAME: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,38}$/, 'use letters, numbers, "_" or "-" only (max 38 chars)')
    .default('nirmaan_catalogue'),
  // Optional DNS servers for the Atlas "mongodb+srv" lookup. Only needed when Node.js
  // picks up an unusable DNS server on this computer (error: querySrv ECONNREFUSED).
  DNS_SERVERS: commaList.refine(
    (list) => list.every((ip) => isIP(ip) !== 0),
    'use comma-separated IP addresses, e.g. 8.8.8.8,1.1.1.1',
  ),

  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .refine((value) => !PLACEHOLDER_PATTERN.test(value), 'JWT_SECRET still contains a placeholder value'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'use a duration such as 12h or 1d')
    .default('1d'),

  // Browser origins allowed to call the API (the deployed frontend URL in production).
  CORS_ORIGINS: commaList,
  // Permanent public website URL. The shop QR code will encode exactly this value.
  PUBLIC_SITE_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:5173'),
  // Number of reverse proxies in front of the app (set to 1 on Render) so
  // rate limiting sees the real client IP.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),

  // Optional image storage. When all three are present, uploads go to Cloudinary.
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
  // Top-level Cloudinary folder, keeping this shop's images apart from other projects.
  CLOUDINARY_FOLDER: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/, 'use letters, numbers, "_", "-" and "/" only')
    .default('nirmaan'),
  // Local image folder, used only when Cloudinary is not configured (default: backend/uploads).
  UPLOADS_DIR: z.string().trim().optional(),
});

export function parseEnv(source) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}\nSee backend/.env.example for the expected values.`);
  }

  const env = result.data;
  if (env.CORS_ORIGINS.length === 0) {
    env.CORS_ORIGINS = env.NODE_ENV === 'production' ? [] : ['http://localhost:5173'];
  }
  env.PUBLIC_SITE_URL = env.PUBLIC_SITE_URL.replace(/\/+$/, '') + '/';
  env.isProduction = env.NODE_ENV === 'production';
  env.isTest = env.NODE_ENV === 'test';
  env.cloudinaryEnabled = Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );

  if (env.isProduction && env.CORS_ORIGINS.length === 0) {
    throw new Error('Invalid environment configuration:\n  - CORS_ORIGINS: required in production (your deployed frontend URL).');
  }
  return Object.freeze(env);
}

export const env = parseEnv(process.env);
export { PLACEHOLDER_PATTERN };
