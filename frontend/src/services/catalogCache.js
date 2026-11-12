import { getCatalog, getShop } from './publicApi';

/**
 * In-memory copy of the last loaded catalogue for this page visit only (lost on
 * reload, never stored on the phone). It lets "Back" from a product show the list
 * instantly while fresh prices are fetched in the background. Prices are always
 * re-fetched from the server whenever the catalogue is opened or refreshed.
 */
let catalog = null;
let shop = null;
let savedScroll = 0;

export const getCachedCatalog = () => catalog ?? undefined;
export const getCachedShop = () => shop ?? undefined;
export const findCachedProduct = (id) => catalog?.items.find((product) => product.id === id);

export async function loadCatalog() {
  catalog = await getCatalog();
  return catalog;
}

export async function loadShop() {
  shop = await getShop();
  return shop;
}

/** Remember where the list was scrolled when a product is opened. */
export const rememberScroll = (y) => {
  savedScroll = y;
};
export const takeScroll = () => {
  const y = savedScroll;
  savedScroll = 0;
  return y;
};

/** Tests only. */
export function resetCatalogCache() {
  catalog = null;
  shop = null;
  savedScroll = 0;
}
