import mongoose from 'mongoose';
import { Admin } from '../models/index.js';
import { verifyToken } from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';

function unauthorized(res, code, message) {
  res.set('WWW-Authenticate', 'Bearer');
  return new ApiError(401, code, message);
}

/**
 * Requires a valid "Authorization: Bearer <token>" header. The admin is reloaded
 * from the database on every request, so deleted admins and password resets
 * (tokenVersion change) take effect immediately.
 */
export async function requireAuth(req, res, next) {
  const [scheme, token, extra] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token || extra !== undefined) {
    throw unauthorized(res, 'UNAUTHORIZED', 'Please log in to continue');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw unauthorized(res, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.');
    }
    throw unauthorized(res, 'UNAUTHORIZED', 'Invalid session. Please log in again.');
  }

  const admin = mongoose.isValidObjectId(payload.sub) ? await Admin.findById(payload.sub).lean() : null;
  if (!admin || admin.tokenVersion !== payload.tv) {
    throw unauthorized(res, 'UNAUTHORIZED', 'Your session is no longer valid. Please log in again.');
  }

  req.admin = { id: String(admin._id), name: admin.name, email: admin.email, role: admin.role, lastLoginAt: admin.lastLoginAt };
  next();
}

/** Use after requireAuth. Rejects authenticated users without one of the given roles. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      throw ApiError.forbidden();
    }
    next();
  };
}
