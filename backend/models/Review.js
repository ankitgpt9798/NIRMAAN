import mongoose from 'mongoose';
import { REVIEW_LIMITS, REVIEW_STATUS, REVIEW_STATUS_VALUES } from '../constants/community.js';
import { cleanJson } from './shared.js';

/**
 * A customer review. New reviews are "pending" and appear on the website only
 * after the owner approves them. No IP address or contact detail is stored.
 */
const reviewSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, 'Name is required'],
      maxlength: [REVIEW_LIMITS.name, `Name must be at most ${REVIEW_LIMITS.name} characters`],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be from 1 to 5 stars'],
      max: [5, 'Rating must be from 1 to 5 stars'],
      validate: { validator: Number.isInteger, message: 'Rating must be a whole number of stars' },
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [REVIEW_LIMITS.comment, `Comment must be at most ${REVIEW_LIMITS.comment} characters`],
      default: '',
    },
    status: { type: String, enum: REVIEW_STATUS_VALUES, default: REVIEW_STATUS.PENDING },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { transform: cleanJson } },
);

reviewSchema.index({ status: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
