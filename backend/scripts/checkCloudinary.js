/**
 * Verifies the Cloudinary credentials configured in backend/.env.
 * Usage: npm run cloudinary:check
 * Read-only: calls Cloudinary's Admin API "ping" and "usage" endpoints; nothing is uploaded or changed.
 */
import { env } from '../config/env.js';

if (!env.cloudinaryEnabled) {
  console.log('Cloudinary is not configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are all needed).');
  console.log('Images will be stored on the server disk instead.');
  process.exit(0);
}

const base = `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}`;
const headers = {
  Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64')}`,
};

async function call(path) {
  const response = await fetch(`${base}/${path}`, { headers, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

try {
  const ping = await call('ping');
  if (ping.status !== 200) {
    const reason = ping.body?.error?.message || `HTTP ${ping.status}`;
    const hint =
      ping.status === 401
        ? 'API key or API secret is wrong. Copy them again from Cloudinary → Settings → API Keys.'
        : ping.status === 404
          ? 'Cloud name not found. Check CLOUDINARY_CLOUD_NAME (Cloudinary dashboard → "Cloud name").'
          : 'Check the three CLOUDINARY_* values in backend/.env.';
    console.error(`Cloudinary check FAILED: ${reason}\nHint: ${hint}`);
    process.exit(1);
  }

  console.log('Cloudinary connection OK');
  console.log(`  Cloud name: ${env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`  Ping:       ${ping.body.status}`);

  const usage = await call('usage');
  if (usage.status === 200) {
    const { plan, storage, credits } = usage.body;
    const mb = (bytes) => `${((bytes || 0) / 1024 / 1024).toFixed(1)} MB`;
    if (plan) console.log(`  Plan:       ${plan}`);
    if (storage) console.log(`  Storage:    ${mb(storage.usage)} used`);
    if (credits) console.log(`  Credits:    ${credits.usage ?? 0} of ${credits.limit ?? '?'} used this month`);
  }
} catch (error) {
  console.error(`Cloudinary check FAILED: ${error.message}\nHint: check your internet connection.`);
  process.exit(1);
}
