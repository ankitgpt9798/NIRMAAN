import multer from 'multer';
import { ALLOWED_IMAGE_MIME, MAX_IMAGE_BYTES } from '../services/image.service.js';
import { ApiError } from '../utils/ApiError.js';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_IMAGE_MIME.test(file.mimetype)) {
      return callback(new ApiError(400, 'INVALID_IMAGE', 'Only JPG, PNG or WebP images are allowed'));
    }
    return callback(null, true);
  },
});

/**
 * Accepts exactly one image in the multipart field "image" (max 5 MB, JPG/PNG/WebP).
 * The real file type is checked again from the file contents in image.service.js.
 */
export function singleImage(field = 'image') {
  const handler = imageUpload.single(field);
  return (req, res, next) =>
    handler(req, res, (error) => {
      if (error) return next(error);
      if (!req.file) return next(new ApiError(400, 'IMAGE_REQUIRED', 'Please choose an image file to upload'));
      return next();
    });
}
