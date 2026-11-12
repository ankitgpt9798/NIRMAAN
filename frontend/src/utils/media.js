/**
 * Image URLs from the API are either absolute (Cloudinary) or relative to the
 * backend ("/uploads/..."). Relative ones must point at the API server, which in
 * production is a different domain from the website.
 */
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const apiOrigin = /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : '';

export function resolveMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return `${apiOrigin}${url}`;
}

// Cloudinary delivery URLs created by the backend contain ".../upload/c_limit,h_800,w_800/...".
const CLOUDINARY_SIZE = /\/upload\/c_limit,h_\d+,w_\d+\//;

/**
 * Same image, at most `size` pixels wide/high. Cloudinary creates smaller copies
 * on request, so phones download a ~10 KB thumbnail instead of the full photo.
 * Images stored on the server's own disk are returned unchanged.
 */
export function resizedImageUrl(url, size) {
  const resolved = resolveMediaUrl(url);
  if (!CLOUDINARY_SIZE.test(resolved)) return resolved;
  return resolved.replace(CLOUDINARY_SIZE, `/upload/c_limit,h_${size},w_${size}/`);
}

/** srcset so the browser picks the right size for the screen (undefined for non-Cloudinary images). */
export function imageSrcSet(url, widths = [200, 400, 800]) {
  if (!CLOUDINARY_SIZE.test(resolveMediaUrl(url))) return undefined;
  return widths.map((width) => `${resizedImageUrl(url, width)} ${width}w`).join(', ');
}
