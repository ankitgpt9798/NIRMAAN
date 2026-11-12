import mongoose from 'mongoose';
import { cleanJson, imageSchema } from './shared.js';

/** A photo in the shop gallery shown on the customer website (newest first). */
const galleryPhotoSchema = new mongoose.Schema(
  {
    image: { type: imageSchema, required: [true, 'Photo is required'] },
    captionEn: { type: String, trim: true, maxlength: [150, 'Caption (English) must be at most 150 characters'], default: '' },
    captionHi: { type: String, trim: true, maxlength: [150, 'Caption (Hindi) must be at most 150 characters'], default: '' },
  },
  { timestamps: true, toJSON: { transform: cleanJson } },
);

galleryPhotoSchema.index({ createdAt: -1 });

export const GalleryPhoto = mongoose.model('GalleryPhoto', galleryPhotoSchema);
