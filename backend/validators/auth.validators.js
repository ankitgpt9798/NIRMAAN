import { z } from 'zod';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailField = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .regex(EMAIL_PATTERN, 'Enter a valid email address');

/** Login input. The password is only length-checked here so the policy is never revealed. */
export const loginSchema = z.object({
  email: emailField,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200, 'Password is too long'),
});

/** Rules for setting a new admin password (used by the create-admin script). */
export const passwordPolicy = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  // bcrypt only uses the first 72 bytes of a password.
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long (maximum 72 bytes)')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), 'Password must contain at least one letter and one number')
  .refine((value) => value.trim() === value, 'Password cannot start or end with a space');

export const adminNameField = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name must be at most 80 characters');
