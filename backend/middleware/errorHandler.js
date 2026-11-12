import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

/**
 * Every error response has the same shape:
 *   { success: false, error: { code, message, details? } }
 */
function toApiError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
    return new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid', details);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((item) => ({ field: item.path, message: item.message }));
    return new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return new ApiError(400, 'INVALID_ID', `Invalid value for ${err.path}`);
  }

  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    return new ApiError(409, 'DUPLICATE', 'A record with the same value already exists', fields.map((field) => ({ field })));
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new ApiError(413, 'IMAGE_TOO_LARGE', 'The image is too large. The maximum size is 5 MB.');
    }
    return new ApiError(400, 'INVALID_UPLOAD', 'Upload exactly one image in the "image" field');
  }

  // Errors raised by express.json() body parsing.
  if (err?.type === 'entity.parse.failed') {
    return new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  // Other client errors raised by Express and its helpers (e.g. a refused file path
  // from the static file server, an unsupported body encoding). Their messages are
  // replaced with a generic one so nothing internal is ever echoed back.
  const status = err?.status ?? err?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return new ApiError(status, status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', status === 404 ? 'Not found' : 'The request could not be processed');
  }

  return null;
}

/**
 * Builds the final error handler. With `exposeErrors` false (production), unexpected
 * errors answer only "Something went wrong" – never the internal message or stack trace.
 */
export function createErrorHandler({ exposeErrors = !env.isProduction, log = !env.isTest } = {}) {
  // Express recognises error handlers by their four arguments.
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, _next) {
    const apiError = toApiError(err);

    if (!apiError) {
      if (log) console.error(`[error] ${req.method} ${req.originalUrl}`, err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: exposeErrors ? String(err?.message || err) : 'Something went wrong. Please try again.',
        },
      });
    }

    const body = { success: false, error: { code: apiError.code, message: apiError.message } };
    if (apiError.details) body.error.details = apiError.details;
    return res.status(apiError.statusCode).json(body);
  };
}

export const errorHandler = createErrorHandler();

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`));
}
