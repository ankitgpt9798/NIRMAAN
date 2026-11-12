/** Limits for the shop photo gallery and customer reviews. */

/** Most photos the gallery can hold (keeps the page light on mobile data and storage free-tier friendly). */
export const MAX_GALLERY_PHOTOS = 40;

/** Largest width/height customers' phones download for big photos (Cloudinary only). */
export const BIG_PHOTO_DELIVERY_SIZE = 1600;

export const REVIEW_STATUS = Object.freeze({ PENDING: 'pending', APPROVED: 'approved' });
export const REVIEW_STATUS_VALUES = Object.freeze(Object.values(REVIEW_STATUS));

/**
 * New reviews are refused while this many are already waiting for approval, so a
 * flood of spam can never fill the database. The owner approves or deletes to make room.
 */
export const MAX_PENDING_REVIEWS = 100;

/** Reviews one connection (IP address) can send per hour. */
export const REVIEW_SUBMIT_LIMIT = 5;

export const REVIEW_LIMITS = Object.freeze({ name: 60, comment: 500 });
