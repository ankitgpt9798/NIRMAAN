import { api } from './api';

const data = (response) => response.data.data;

export const getShop = () => api.get('/public/shop').then(data);
/** All visible products in one response, so search and filters work instantly on the phone. */
export const getCatalog = () => api.get('/public/products', { params: { limit: 1000 } }).then(data);
export const getPublicProduct = (id) => api.get(`/public/products/${encodeURIComponent(id)}`).then(data);
export const getGallery = () => api.get('/public/gallery').then(data);
/** Approved reviews, newest first: { items, total, page, totalPages, averageRating } */
export const getReviews = (page = 1, limit = 5) => api.get('/public/reviews', { params: { page, limit } }).then(data);
/** body: { name, rating (1-5), comment?, website (hidden anti-bot field, normally empty) } */
export const submitReview = (body) => api.post('/public/reviews', body).then(data);
