import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Stores product images (and later the shop logo).
 * - Cloudinary when CLOUDINARY_* are configured (recommended; required in production
 *   because Render's free disk is wiped on every deploy/restart).
 * - Otherwise the local backend/uploads folder, served at /uploads.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = /^image\/(jpeg|png|webp)$/;

export const uploadsRoot = path.resolve(env.UPLOADS_DIR || fileURLToPath(new URL('../uploads', import.meta.url)));

if (env.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
    // No SDK tracking parameter (?_a=…) on image URLs: plain, stable addresses.
    analytics: false,
  });
}

/** Detects the real file type from its first bytes; the browser-supplied type can be faked. */
export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const LOCAL_ID_PATTERN = /^[a-z]+\/[a-f0-9]{32}\.(jpg|png|webp)$/;

async function saveLocally(buffer, extension, folder) {
  const directory = path.join(uploadsRoot, folder);
  await fs.mkdir(directory, { recursive: true });
  const fileName = `${randomBytes(16).toString('hex')}.${extension}`;
  await fs.writeFile(path.join(directory, fileName), buffer);
  return { url: `/uploads/${folder}/${fileName}`, publicId: `${folder}/${fileName}`, provider: 'local' };
}

function uploadToCloudinary(buffer, folder, deliverySize) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/${folder}`,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        // Store at most 1600px; phones already shrink photos before uploading.
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  }).then((result) => ({
    // Delivery URL: size limit, best format (WebP/AVIF) and quality for each phone.
    url: cloudinary.url(result.public_id, {
      secure: true,
      version: result.version,
      transformation: [{ width: deliverySize, height: deliverySize, crop: 'limit' }, { fetch_format: 'auto', quality: 'auto' }],
    }),
    publicId: result.public_id,
    provider: 'cloudinary',
  }));
}

/**
 * Validates and stores an image. `folder` is a short name such as "products" or "shop";
 * `deliverySize` is the largest width/height customers' phones download (Cloudinary only).
 */
export async function saveImage(buffer, folder, { deliverySize = 800 } = {}) {
  const extension = detectImageType(buffer);
  if (!extension) {
    throw new ApiError(400, 'INVALID_IMAGE', 'This file is not a valid JPG, PNG or WebP image');
  }
  if (!env.cloudinaryEnabled) return saveLocally(buffer, extension, folder);

  try {
    return await uploadToCloudinary(buffer, folder, deliverySize);
  } catch (error) {
    if (!env.isTest) console.error('[image] Cloudinary upload failed:', error?.message || error);
    throw new ApiError(502, 'IMAGE_UPLOAD_FAILED', 'The image could not be uploaded. Please try again.');
  }
}

/** Deletes a stored image. Never throws: a leftover file must not break the user's action. */
export async function deleteImage(image) {
  if (!image?.publicId) return;
  try {
    if (image.provider === 'cloudinary') {
      if (env.cloudinaryEnabled) await cloudinary.uploader.destroy(image.publicId, { invalidate: true });
    } else if (image.provider === 'local' && LOCAL_ID_PATTERN.test(image.publicId)) {
      await fs.unlink(path.join(uploadsRoot, image.publicId));
    }
  } catch (error) {
    if (error?.code !== 'ENOENT' && !env.isTest) console.error('[image] Could not delete image:', error?.message || error);
  }
}
