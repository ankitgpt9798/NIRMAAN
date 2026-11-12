import { api } from './api';

const data = (response) => response.data.data;
const withoutEmpty = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));

export const getMeta = () => api.get('/admin/meta').then(data);
export const getDashboardStats = () => api.get('/admin/dashboard/stats').then(data);

export const listCategories = () => api.get('/admin/categories').then(data);
export const createCategory = (body) => api.post('/admin/categories', body).then(data);
export const updateCategory = (id, body) => api.put(`/admin/categories/${id}`, body).then(data);
export const deleteCategory = (id) => api.delete(`/admin/categories/${id}`).then(data);

export const listProducts = (params) => api.get('/admin/products', { params: withoutEmpty(params) }).then(data);
export const getProduct = (id) => api.get(`/admin/products/${id}`).then(data);
export const createProduct = (body) => api.post('/admin/products', body).then(data);
export const updateProduct = (id, body) => api.put(`/admin/products/${id}`, body).then(data);
export const deleteProduct = (id) => api.delete(`/admin/products/${id}`).then(data);

export function uploadProductImage(id, file) {
  const form = new FormData();
  form.append('image', file);
  return api.put(`/admin/products/${id}/image`, form, { timeout: 120_000 }).then(data);
}
export const deleteProductImage = (id) => api.delete(`/admin/products/${id}/image`).then(data);

/** body: { sellingPrice, mrp?, expectedPrice } → { changed, previousPrice, product } */
export const updateProductPrice = (id, body) => api.patch(`/admin/products/${id}/price`, body).then(data);
export const listPriceHistory = (params) => api.get('/admin/price-history', { params: withoutEmpty(params) }).then(data);

/** { url, isProductionReady, warnings, notes, svg, pngDataUrl, shop: { nameEn, nameHi, phone } } */
export const getQrCode = () => api.get('/admin/qr-code').then(data);

export const getShopSettings = () => api.get('/admin/shop').then(data);
export const updateShopSettings = (body) => api.put('/admin/shop', body).then(data);
export function uploadShopLogo(file) {
  const form = new FormData();
  form.append('image', file);
  return api.put('/admin/shop/logo', form, { timeout: 120_000 }).then(data);
}
export const deleteShopLogo = () => api.delete('/admin/shop/logo').then(data);

function imageBody(file) {
  const form = new FormData();
  form.append('image', file);
  return form;
}
/** Big shop photo shown below the product list on the website. */
export const uploadShopPhoto = (file) => api.put('/admin/shop/photo', imageBody(file), { timeout: 120_000 }).then(data);
export const deleteShopPhoto = () => api.delete('/admin/shop/photo').then(data);

/** Photo gallery: { items: [{ id, image, captionEn, captionHi, createdAt }], max } */
export const listGallery = () => api.get('/admin/gallery').then(data);
export const addGalleryPhoto = (file) => api.post('/admin/gallery', imageBody(file), { timeout: 120_000 }).then(data);
export const updateGalleryPhoto = (id, body) => api.put(`/admin/gallery/${id}`, body).then(data);
export const deleteGalleryPhoto = (id) => api.delete(`/admin/gallery/${id}`).then(data);

/** Customer reviews: status 'pending' (waiting for approval) or 'approved' (shown on the website). */
export const listReviews = (params) => api.get('/admin/reviews', { params: withoutEmpty(params) }).then(data);
export const setReviewStatus = (id, status) => api.patch(`/admin/reviews/${id}`, { status }).then(data);
export const deleteReview = (id) => api.delete(`/admin/reviews/${id}`).then(data);
// Server validation details are turned into translated field messages by fieldErrorsFrom() in i18n/apiErrors.js.
