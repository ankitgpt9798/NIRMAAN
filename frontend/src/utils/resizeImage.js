export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const ACCEPTED = /^image\/(jpeg|png|webp)$/;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Shrinks a phone photo in the browser before uploading (longest side ≤ 1200px,
 * JPEG). A 4 MB camera photo typically becomes 150–300 KB, which uploads much
 * faster on slow mobile networks. Falls back to the original file if the browser
 * cannot process it.
 */
export async function prepareImage(file, { maxSize = 1200, quality = 0.82 } = {}) {
  if (!ACCEPTED.test(file.type)) {
    throw Object.assign(new Error('Please choose a JPG, PNG or WebP photo.'), { i18nKey: 'admin.image.errType' });
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = null;
  }

  if (bitmap) {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const alreadySmall = scale === 1 && file.size <= 600 * 1024;
    if (!alreadySmall) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff'; // transparent PNG areas become white, not black
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob) {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
        return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
      }
    } else {
      bitmap.close();
    }
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error('This photo is too large (maximum 5 MB). Please choose a smaller photo.'), { i18nKey: 'admin.image.errSize' });
  }
  return file;
}
