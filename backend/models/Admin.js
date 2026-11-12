import mongoose from 'mongoose';
import { ADMIN_ROLES } from '../constants/catalog.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [EMAIL_PATTERN, 'Email address is not valid'],
      unique: true,
    },
    // bcrypt hash only; never returned in queries unless explicitly selected.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ADMIN_ROLES, default: 'admin' },
    // Incremented on password reset so previously issued JWTs stop working.
    tokenVersion: { type: Number, default: 0, min: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const Admin = mongoose.model('Admin', adminSchema);
