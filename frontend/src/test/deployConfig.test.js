import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from '../../vite.config.js';

// Tests run from the frontend folder.
const vercel = JSON.parse(readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'));

describe('Content-Security-Policy (production build)', () => {
  it('allows only the site itself, the configured API and Cloudinary images', () => {
    const policy = buildContentSecurityPolicy('https://nirmaan-api.onrender.com/api');
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("connect-src 'self' https://nirmaan-api.onrender.com");
    expect(policy).toContain("img-src 'self' data: blob: https://res.cloudinary.com https://nirmaan-api.onrender.com");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain('upgrade-insecure-requests');
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });

  it('works without a separate API address (same-origin /api)', () => {
    const policy = buildContentSecurityPolicy('');
    expect(policy).toContain("connect-src 'self';");
    expect(policy).not.toContain('upgrade-insecure-requests');
  });
});

describe('vercel.json', () => {
  it('serves index.html for app routes but not for missing asset files', () => {
    const [rewrite] = vercel.rewrites;
    expect(rewrite.destination).toBe('/index.html');
    const pattern = new RegExp(`^${rewrite.source.replace('(?!assets/)', '(?!assets/)')}$`);
    expect(pattern.test('/products/abc123')).toBe(true);
    expect(pattern.test('/admin/qr-code')).toBe(true);
    expect(pattern.test('/assets/index-abc.js')).toBe(false);
  });

  it('sends security headers on every page and long caching for hashed assets', () => {
    const all = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));
    expect(all['X-Frame-Options']).toBe('DENY');
    expect(all['X-Content-Type-Options']).toBe('nosniff');
    expect(all['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(all['Strict-Transport-Security']).toMatch(/max-age=\d+/);
    expect(all['Permissions-Policy']).toContain('camera=()');
    const assets = vercel.headers.find((h) => h.source === '/assets/(.*)').headers[0];
    expect(assets.value).toBe('public, max-age=31536000, immutable');
  });
});
