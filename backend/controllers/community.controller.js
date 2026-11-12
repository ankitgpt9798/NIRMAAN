import * as galleryService from '../services/gallery.service.js';
import * as reviewService from '../services/review.service.js';
import * as shopService from '../services/shop.service.js';

// ---- Website (no login)

export async function publicGallery(_req, res) {
  res.json({ success: true, data: await galleryService.listPublicGallery() });
}

export async function publicReviews(req, res) {
  res.json({ success: true, data: await reviewService.listPublicReviews(req.validatedQuery) });
}

export async function submitReview(req, res) {
  res.status(201).json({ success: true, data: await reviewService.submitReview(req.body) });
}

// ---- Admin: big shop photo

export async function uploadShopPhoto(req, res) {
  res.json({ success: true, data: await shopService.setShopPhoto(req.file.buffer) });
}

export async function removeShopPhoto(_req, res) {
  res.json({ success: true, data: await shopService.removeShopPhoto() });
}

// ---- Admin: gallery

export async function listGallery(_req, res) {
  res.json({ success: true, data: await galleryService.listGallery() });
}

export async function addGalleryPhoto(req, res) {
  res.status(201).json({ success: true, data: await galleryService.addGalleryPhoto(req.file.buffer) });
}

export async function updateGalleryPhoto(req, res) {
  res.json({ success: true, data: await galleryService.updateGalleryPhoto(req.params.id, req.body) });
}

export async function deleteGalleryPhoto(req, res) {
  await galleryService.deleteGalleryPhoto(req.params.id);
  res.json({ success: true, data: { id: req.params.id, deleted: true } });
}

// ---- Admin: reviews

export async function listReviews(req, res) {
  res.json({ success: true, data: await reviewService.listReviews(req.validatedQuery) });
}

export async function updateReview(req, res) {
  res.json({ success: true, data: await reviewService.setReviewStatus(req.params.id, req.body.status) });
}

export async function deleteReview(req, res) {
  await reviewService.deleteReview(req.params.id);
  res.json({ success: true, data: { id: req.params.id, deleted: true } });
}
