import mongoose from 'mongoose';
import { MAX_PENDING_REVIEWS, REVIEW_STATUS } from '../constants/community.js';
import { Review } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeReview } from './serializers.js';

/**
 * Customer reviews. Anyone can send one (no login); it is shown on the website
 * only after the owner approves it in the admin.
 */

async function findReviewOr404(id) {
  const review = mongoose.isValidObjectId(id) ? await Review.findById(id) : null;
  if (!review) throw ApiError.notFound('Review not found');
  return review;
}

const pageOf = (total, page, limit) => ({ total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });

/**
 * Saves a new (pending) review. `website` is a hidden form field that people never
 * see or fill in; when a bot fills it, the review is quietly dropped while the
 * answer looks the same, so the bot learns nothing.
 */
export async function submitReview({ name, rating, comment = '', website = '' }) {
  if (website) return { status: REVIEW_STATUS.PENDING };
  if ((await Review.countDocuments({ status: REVIEW_STATUS.PENDING })) >= MAX_PENDING_REVIEWS) {
    throw new ApiError(503, 'REVIEWS_PAUSED', 'Reviews cannot be accepted right now. Please try again later.');
  }
  await Review.create({ name, rating, comment });
  return { status: REVIEW_STATUS.PENDING };
}

/** Approved reviews (newest first) and the average rating, for the website. */
export async function listPublicReviews({ page, limit }) {
  const approved = { status: REVIEW_STATUS.APPROVED };
  const [items, summary] = await Promise.all([
    Review.find(approved).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Review.aggregate([{ $match: approved }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } }]),
  ]);
  const total = summary[0]?.count ?? 0;
  return {
    items: items.map((review) => serializeReview(review)),
    averageRating: total ? Math.round(summary[0].average * 10) / 10 : null,
    ...pageOf(total, page, limit),
  };
}

export const countPendingReviews = () => Review.countDocuments({ status: REVIEW_STATUS.PENDING });

/** Admin list (waiting for approval or shown), with the number in each group. */
export async function listReviews({ status = REVIEW_STATUS.PENDING, page, limit }) {
  const filter = { status };
  const [items, total, counts] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const countByStatus = Object.fromEntries(counts.map((row) => [row._id, row.count]));
  return {
    items: items.map((review) => serializeReview(review, { admin: true })),
    counts: { pending: countByStatus.pending ?? 0, approved: countByStatus.approved ?? 0 },
    ...pageOf(total, page, limit),
  };
}

/** Approves a review (shows it on the website) or moves it back to "waiting" (hides it). */
export async function setReviewStatus(id, status) {
  const review = await findReviewOr404(id);
  review.status = status;
  review.approvedAt = status === REVIEW_STATUS.APPROVED ? new Date() : null;
  await review.save();
  return serializeReview(review.toObject(), { admin: true });
}

export async function deleteReview(id) {
  const review = await findReviewOr404(id);
  await review.deleteOne();
}
