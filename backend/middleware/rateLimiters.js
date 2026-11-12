import rateLimit from 'express-rate-limit';
import { REVIEW_SUBMIT_LIMIT } from '../constants/community.js';

const rateLimitResponse = (message) => ({
  success: false,
  error: { code: 'TOO_MANY_REQUESTS', message },
});

// Limiters are created per app instance (see app.js / routes) so each server
// (and each automated test) starts with fresh counters.

/**
 * Generous limit for the whole API. Many customers on Indian mobile networks
 * share one public IP (carrier NAT), so this only stops obvious abuse.
 */
export function createApiLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: rateLimitResponse('Too many requests. Please wait a few minutes and try again.'),
  });
}

/** Login protection: 10 failed attempts per IP address per 15 minutes. Successful logins do not count. */
export const LOGIN_ATTEMPT_LIMIT = 10;

export function createLoginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: LOGIN_ATTEMPT_LIMIT,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: rateLimitResponse('Too many login attempts. Please wait 15 minutes and try again.'),
  });
}

/**
 * New reviews from the website: a few per connection per hour. Normal customers
 * send one; this stops one person or bot from sending hundreds. Only accepted
 * reviews count, so a customer correcting a mistake in the form is not blocked
 * (rejected requests save nothing, and the general API limit still applies).
 */
export function createReviewLimiter(limit = REVIEW_SUBMIT_LIMIT) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit,
    skipFailedRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: rateLimitResponse('Too many reviews from this connection. Please try again later.'),
  });
}
