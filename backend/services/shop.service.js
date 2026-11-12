import { BIG_PHOTO_DELIVERY_SIZE } from '../constants/community.js';
import { Shop } from '../models/index.js';
import { deleteImage, saveImage } from './image.service.js';
import { serializeShop } from './serializers.js';

/** Shop Settings (admin). The single shop record is created on first use. */

// Logos are shown small (header, QR poster), so 400px is plenty; the shop photo is shown big.
const SHOP_IMAGES = {
  logo: { deliverySize: 400 },
  photo: { deliverySize: BIG_PHOTO_DELIVERY_SIZE },
};

export async function getShopSettings() {
  return serializeShop((await Shop.getSettings()).toObject());
}

export async function updateShopSettings(data) {
  const shop = await Shop.getSettings();
  shop.set(data);
  await shop.save();
  return serializeShop(shop.toObject());
}

/** Stores a new logo or shop photo; the old file is deleted only after the new one is saved. */
async function setShopImage(field, buffer) {
  const shop = await Shop.getSettings();
  const previous = shop[field]?.toObject?.() ?? shop[field];
  const stored = await saveImage(buffer, 'shop', SHOP_IMAGES[field]);
  try {
    shop[field] = stored;
    await shop.save();
  } catch (error) {
    await deleteImage(stored);
    throw error;
  }
  await deleteImage(previous);
  return serializeShop(shop.toObject());
}

async function removeShopImage(field) {
  const shop = await Shop.getSettings();
  const previous = shop[field]?.toObject?.() ?? shop[field];
  shop[field] = null;
  await shop.save();
  await deleteImage(previous);
  return serializeShop(shop.toObject());
}

export const setShopLogo = (buffer) => setShopImage('logo', buffer);
export const removeShopLogo = () => removeShopImage('logo');
export const setShopPhoto = (buffer) => setShopImage('photo', buffer);
export const removeShopPhoto = () => removeShopImage('photo');
