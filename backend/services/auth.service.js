import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Admin } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

/** bcrypt work factor: about 0.4 s per check on a typical PC; slow enough to resist guessing. */
export const BCRYPT_ROUNDS = 12;

const JWT_OPTIONS = Object.freeze({ algorithm: 'HS256', issuer: 'nirmaan-api', audience: 'nirmaan-admin' });

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Compared against when the email is unknown, so a wrong email takes as long as a
// wrong password and response timing does not reveal which admin emails exist.
let dummyHashPromise;
const getDummyHash = () => (dummyHashPromise ??= bcrypt.hash(randomBytes(24).toString('hex'), BCRYPT_ROUNDS));

export function toPublicAdmin(admin) {
  return {
    id: String(admin._id),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt ?? null,
  };
}

export function signToken(admin) {
  return jwt.sign({ sub: String(admin._id), role: admin.role, tv: admin.tokenVersion ?? 0 }, env.JWT_SECRET, {
    ...JWT_OPTIONS,
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/** Returns the verified payload or throws jsonwebtoken's error. */
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: [JWT_OPTIONS.algorithm],
    issuer: JWT_OPTIONS.issuer,
    audience: JWT_OPTIONS.audience,
  });
}

export async function login(email, password) {
  const admin = await Admin.findOne({ email }).select('+passwordHash');
  const passwordMatches = await bcrypt.compare(password, admin?.passwordHash ?? (await getDummyHash()));

  if (!admin || !passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  const token = signToken(admin);
  const { exp } = jwt.decode(token);
  return { token, expiresAt: new Date(exp * 1000).toISOString(), admin: toPublicAdmin(admin) };
}
