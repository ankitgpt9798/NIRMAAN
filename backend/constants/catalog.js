/**
 * Measurement units the owner can choose for a product. Each product stores
 * only the `key`; labels are shown in the customer's selected language.
 * To offer a new unit, add an entry here (keys must never be renamed once used).
 */
export const UNITS = Object.freeze([
  { key: 'bag', en: 'Per Bag', hi: 'प्रति बोरी' },
  { key: 'bag_50kg', en: 'Per 50 KG Bag', hi: 'प्रति 50 किलो बोरी' },
  { key: 'kg', en: 'Per KG', hi: 'प्रति किलो' },
  { key: 'quintal', en: 'Per Quintal', hi: 'प्रति क्विंटल' },
  { key: 'ton', en: 'Per Ton', hi: 'प्रति टन' },
  { key: 'piece', en: 'Per Piece', hi: 'प्रति पीस' },
  { key: 'bundle', en: 'Per Bundle', hi: 'प्रति बंडल' },
  // Key stays "tractor" (already saved on products); shown as a tractor-trolley load.
  { key: 'tractor', en: 'Per Trolley', hi: 'प्रति ट्रॉली' },
  { key: 'truck', en: 'Per Truck', hi: 'प्रति ट्रक' },
  { key: 'cft', en: 'Per CFT (Cubic Feet)', hi: 'प्रति घन फुट (CFT)' },
  { key: 'brass', en: 'Per Brass', hi: 'प्रति ब्रास' },
  { key: 'packet', en: 'Per Packet', hi: 'प्रति पैकेट' },
  { key: 'sqft', en: 'Per Square Feet', hi: 'प्रति वर्ग फुट' },
  { key: 'litre', en: 'Per Litre', hi: 'प्रति लीटर' },
  { key: 'metre', en: 'Per Metre', hi: 'प्रति मीटर' },
  { key: 'box', en: 'Per Box', hi: 'प्रति बॉक्स' },
]);

export const UNIT_KEYS = Object.freeze(UNITS.map((unit) => unit.key));

export const AVAILABILITY = Object.freeze({
  IN_STOCK: 'in_stock',
  OUT_OF_STOCK: 'out_of_stock',
  UNAVAILABLE: 'unavailable',
});

export const AVAILABILITY_VALUES = Object.freeze(Object.values(AVAILABILITY));

export const AVAILABILITY_OPTIONS = Object.freeze([
  { value: AVAILABILITY.IN_STOCK, en: 'In Stock', hi: 'स्टॉक में उपलब्ध' },
  { value: AVAILABILITY.OUT_OF_STOCK, en: 'Out of Stock', hi: 'स्टॉक में नहीं' },
  { value: AVAILABILITY.UNAVAILABLE, en: 'Currently Unavailable', hi: 'अभी उपलब्ध नहीं' },
]);

/**
 * Categories created by `npm run seed:categories`. Matched by English name, so
 * running the script again never creates duplicates or overwrites the owner's edits.
 */
export const DEFAULT_CATEGORIES = Object.freeze([
  { nameEn: 'Cement', nameHi: 'सीमेंट', sortOrder: 10, showDeliveryNote: false },
  { nameEn: 'TMT Rod', nameHi: 'सरिया (TMT)', sortOrder: 20, showDeliveryNote: false },
  { nameEn: 'Sand', nameHi: 'रेत (बालू)', sortOrder: 30, showDeliveryNote: true },
  { nameEn: 'Other Building Materials', nameHi: 'अन्य निर्माण सामग्री', sortOrder: 40, showDeliveryNote: false },
]);

const UNIT_BY_KEY = new Map(UNITS.map((unit) => [unit.key, unit]));
export function unitLabel(key) {
  const unit = UNIT_BY_KEY.get(key);
  return unit ? { en: unit.en, hi: unit.hi } : { en: key, hi: key };
}

export const ADMIN_ROLES = Object.freeze(['admin']);

/** Upper bound that catches typing mistakes (₹1 crore) without limiting real prices. */
export const MAX_PRICE = 10_000_000;
