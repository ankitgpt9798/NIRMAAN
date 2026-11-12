import { analyseSiteUrl } from '../utils/siteUrl.js';

/**
 * Settings that work but would hurt the shop when hosted. Printed as warnings
 * when the server starts in production (they do not stop the server).
 */
export function productionWarnings(env) {
  if (!env.isProduction) return [];
  const warnings = [];

  if (!env.cloudinaryEnabled) {
    warnings.push(
      'Cloudinary is not configured: product photos are saved on this server’s disk, which free hosting (Render) wipes on every restart or deploy. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
    );
  }

  const site = analyseSiteUrl(env.PUBLIC_SITE_URL);
  if (!site.isProductionReady) {
    warnings.push(
      `PUBLIC_SITE_URL (${env.PUBLIC_SITE_URL}) is not a final https website address (${site.warnings.map((w) => w.code).join(', ')}). Do not print the QR code until it is.`,
    );
  }

  if (env.TRUST_PROXY === 0) {
    warnings.push('TRUST_PROXY is 0. On Render (behind a proxy) set TRUST_PROXY=1, otherwise login rate limiting cannot tell customers’ phones apart.');
  }

  const siteOrigin = new URL(env.PUBLIC_SITE_URL).origin;
  if (!env.CORS_ORIGINS.includes(siteOrigin)) {
    warnings.push(`CORS_ORIGINS (${env.CORS_ORIGINS.join(', ')}) does not include the website address ${siteOrigin}. The website will not be able to load prices.`);
  }

  return warnings;
}
