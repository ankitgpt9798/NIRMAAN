import { unitLabel } from '../constants/catalog.js';

/**
 * Explicit API shapes, so internal fields (__v, image storage ids, etc.) never
 * leak and the frontend always receives `id` instead of `_id`.
 */

export function serializeImage(image) {
  return image?.url ? { url: image.url, provider: image.provider } : null;
}

export function serializeCategory(category, extra = {}) {
  return {
    id: String(category._id),
    nameEn: category.nameEn,
    nameHi: category.nameHi,
    descriptionEn: category.descriptionEn,
    descriptionHi: category.descriptionHi,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    showDeliveryNote: Boolean(category.showDeliveryNote),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    ...extra,
  };
}

function serializeCategoryRef(category) {
  if (!category || typeof category !== 'object' || !('nameEn' in category)) {
    return category ? { id: String(category) } : null;
  }
  return {
    id: String(category._id),
    nameEn: category.nameEn,
    nameHi: category.nameHi,
    isActive: category.isActive,
    showDeliveryNote: Boolean(category.showDeliveryNote),
  };
}

/**
 * What customers receive: no admin-only fields (visibility flags, creation dates,
 * storage ids). Hidden products never reach this function.
 */
export function serializePublicProduct(product) {
  const category = product.category && typeof product.category === 'object' ? product.category : null;
  return {
    id: String(product._id),
    nameEn: product.nameEn,
    nameHi: product.nameHi,
    brand: product.brand,
    category: category
      ? {
          id: String(category._id),
          nameEn: category.nameEn,
          nameHi: category.nameHi,
          sortOrder: category.sortOrder,
          showDeliveryNote: Boolean(category.showDeliveryNote),
        }
      : null,
    descriptionEn: product.descriptionEn,
    descriptionHi: product.descriptionHi,
    image: serializeImage(product.image),
    unit: product.unit,
    unitLabel: unitLabel(product.unit),
    mrp: product.mrp ?? null,
    sellingPrice: product.sellingPrice,
    availability: product.availability,
    priceUpdatedAt: product.priceUpdatedAt,
  };
}

export function serializePublicCategory(category, productCount) {
  return {
    id: String(category._id),
    nameEn: category.nameEn,
    nameHi: category.nameHi,
    descriptionEn: category.descriptionEn,
    descriptionHi: category.descriptionHi,
    sortOrder: category.sortOrder,
    showDeliveryNote: Boolean(category.showDeliveryNote),
    productCount,
  };
}

const EMPTY_SHOP = Object.freeze({
  nameEn: '', nameHi: '', logo: null, photo: null, phone: '', whatsapp: '',
  addressEn: '', addressHi: '', descriptionEn: '', descriptionHi: '', websiteUrl: '', updatedAt: null,
});

/** Shop details for the website. Returns empty values until the owner fills in Shop Settings. */
export function serializeShop(shop) {
  if (!shop) return { ...EMPTY_SHOP };
  return {
    nameEn: shop.nameEn ?? '',
    nameHi: shop.nameHi ?? '',
    logo: serializeImage(shop.logo),
    photo: serializeImage(shop.photo),
    phone: shop.phone ?? '',
    whatsapp: shop.whatsapp ?? '',
    addressEn: shop.addressEn ?? '',
    addressHi: shop.addressHi ?? '',
    descriptionEn: shop.descriptionEn ?? '',
    descriptionHi: shop.descriptionHi ?? '',
    websiteUrl: shop.websiteUrl ?? '',
    updatedAt: shop.updatedAt ?? null,
  };
}

export function serializeProduct(product) {
  return {
    id: String(product._id),
    nameEn: product.nameEn,
    nameHi: product.nameHi,
    brand: product.brand,
    category: serializeCategoryRef(product.category),
    descriptionEn: product.descriptionEn,
    descriptionHi: product.descriptionHi,
    image: serializeImage(product.image),
    unit: product.unit,
    unitLabel: unitLabel(product.unit),
    mrp: product.mrp ?? null,
    sellingPrice: product.sellingPrice,
    availability: product.availability,
    isActive: product.isActive,
    priceUpdatedAt: product.priceUpdatedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/** Gallery photo. `createdAt` is only needed by the admin. */
export function serializeGalleryPhoto(photo, { admin = false } = {}) {
  return {
    id: String(photo._id),
    image: serializeImage(photo.image),
    captionEn: photo.captionEn ?? '',
    captionHi: photo.captionHi ?? '',
    ...(admin ? { createdAt: photo.createdAt } : {}),
  };
}

/** Review as customers see it (approved only); the admin also gets the status. */
export function serializeReview(review, { admin = false } = {}) {
  return {
    id: String(review._id),
    name: review.name,
    rating: review.rating,
    comment: review.comment ?? '',
    createdAt: review.createdAt,
    ...(admin ? { status: review.status, approvedAt: review.approvedAt ?? null } : {}),
  };
}
