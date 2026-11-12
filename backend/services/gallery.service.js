import mongoose from 'mongoose';
import { BIG_PHOTO_DELIVERY_SIZE, MAX_GALLERY_PHOTOS } from '../constants/community.js';
import { GalleryPhoto } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { deleteImage, saveImage } from './image.service.js';
import { serializeGalleryPhoto } from './serializers.js';

/** Shop photo gallery: the owner uploads photos, customers see them newest first. */

async function findPhotoOr404(id) {
  const photo = mongoose.isValidObjectId(id) ? await GalleryPhoto.findById(id) : null;
  if (!photo) throw ApiError.notFound('Photo not found');
  return photo;
}

const newestFirst = () => GalleryPhoto.find().sort({ createdAt: -1, _id: -1 }).lean();

export async function listGallery() {
  const items = (await newestFirst()).map((photo) => serializeGalleryPhoto(photo, { admin: true }));
  return { items, max: MAX_GALLERY_PHOTOS };
}

export async function listPublicGallery() {
  return { items: (await newestFirst()).map((photo) => serializeGalleryPhoto(photo)) };
}

export async function addGalleryPhoto(buffer) {
  if ((await GalleryPhoto.countDocuments()) >= MAX_GALLERY_PHOTOS) {
    throw new ApiError(409, 'GALLERY_FULL', `The gallery is full (at most ${MAX_GALLERY_PHOTOS} photos). Delete a photo first.`);
  }
  const stored = await saveImage(buffer, 'gallery', { deliverySize: BIG_PHOTO_DELIVERY_SIZE });
  try {
    const photo = await GalleryPhoto.create({ image: stored });
    return serializeGalleryPhoto(photo.toObject(), { admin: true });
  } catch (error) {
    await deleteImage(stored);
    throw error;
  }
}

export async function updateGalleryPhoto(id, data) {
  const photo = await findPhotoOr404(id);
  photo.set(data);
  await photo.save();
  return serializeGalleryPhoto(photo.toObject(), { admin: true });
}

export async function deleteGalleryPhoto(id) {
  const photo = await findPhotoOr404(id);
  const image = photo.image?.toObject?.() ?? photo.image;
  await photo.deleteOne();
  await deleteImage(image);
}
