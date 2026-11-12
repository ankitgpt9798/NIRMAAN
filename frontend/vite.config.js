import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Production builds get a Content-Security-Policy in index.html: the page may only
 * load its own files, talk to its own API (VITE_API_URL) and show images from
 * itself, the API and Cloudinary. This blocks injected scripts and data leaks.
 * (Frame protection and other headers come from vercel.json.)
 */
export function buildContentSecurityPolicy(apiUrl = '') {
  const apiOrigin = /^https?:\/\//.test(apiUrl) ? new URL(apiUrl).origin : '';
  const extra = apiOrigin ? ` ${apiOrigin}` : '';
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src 'self' data: blob: https://res.cloudinary.com${extra}`,
    `connect-src 'self'${extra}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  if (apiOrigin.startsWith('https://')) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

function contentSecurityPolicy(apiUrl) {
  return {
    name: 'nirmaan-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${buildContentSecurityPolicy(apiUrl)}" />`;
      return html.replace('<head>', `<head>\n    ${meta}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiTarget = env.VITE_DEV_API_PROXY || 'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env.VITE_API_URL)],
    server: {
      port: 5173,
      strictPort: true,
      // Local development: the browser calls /api on the Vite server, which forwards
      // to Express. This avoids CORS issues and also works from a phone on the same Wi-Fi.
      // /uploads serves product images stored on the backend's disk (when Cloudinary is not used).
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
    // Component tests (npm test): run in a simulated browser, no real server needed.
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      css: false,
      restoreMocks: true,
    },
  };
});
