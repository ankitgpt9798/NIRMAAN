// Clearly labelled sample data for component tests only (not real shop prices).

export const CEMENT = { id: 'c1', nameEn: 'Cement', nameHi: 'सीमेंट', sortOrder: 10, showDeliveryNote: false };
export const SAND = { id: 'c2', nameEn: 'Sand', nameHi: 'रेत', sortOrder: 30, showDeliveryNote: true };

export const PRODUCTS = [
  {
    id: 'p1',
    nameEn: 'Alpha Cement (sample)',
    nameHi: 'अल्फा सीमेंट',
    brand: 'Demo Brand',
    category: CEMENT,
    descriptionEn: 'Sample description',
    descriptionHi: '',
    image: null,
    unit: 'bag_50kg',
    unitLabel: { en: 'Per 50 KG Bag', hi: 'प्रति 50 किलो बोरी' },
    mrp: 420,
    sellingPrice: 380,
    availability: 'in_stock',
    priceUpdatedAt: '2026-11-05T10:00:00.000Z',
  },
  {
    id: 'p2',
    nameEn: 'Beta Cement (sample)',
    nameHi: 'बीटा सीमेंट',
    brand: 'Other Demo',
    category: CEMENT,
    descriptionEn: '',
    descriptionHi: '',
    image: { url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', provider: 'cloudinary' },
    unit: 'bag',
    unitLabel: { en: 'Per Bag', hi: 'प्रति बोरी' },
    mrp: null,
    sellingPrice: 365.5,
    availability: 'out_of_stock',
    priceUpdatedAt: '2026-11-03T10:00:00.000Z',
  },
  {
    id: 'p3',
    nameEn: '',
    nameHi: 'नमूना नदी रेत',
    brand: '',
    category: SAND,
    descriptionEn: '',
    descriptionHi: '',
    image: null,
    unit: 'tractor',
    unitLabel: { en: 'Per Trolley', hi: 'प्रति ट्रॉली' },
    mrp: null,
    sellingPrice: 3000,
    availability: 'unavailable',
    priceUpdatedAt: '2026-11-01T10:00:00.000Z',
  },
];

export const CATALOG = { items: PRODUCTS, total: 3, page: 1, limit: 1000, totalPages: 1, lastUpdated: '2026-11-05T10:00:00.000Z' };

export const EMPTY_SHOP = {
  nameEn: '', nameHi: '', logo: null, photo: null, phone: '', whatsapp: '', addressEn: '', addressHi: '',
  descriptionEn: '', descriptionHi: '', websiteUrl: '', updatedAt: null,
};

export const SHOP = {
  ...EMPTY_SHOP,
  nameEn: 'Sample Traders (demo)',
  nameHi: 'नमूना ट्रेडर्स',
  phone: '+91 90000 00000',
  whatsapp: '9000000000',
  addressEn: 'Sample Address, Demo Village',
};

/** Shape of an Axios error with an HTTP status. */
export function httpError(status, message = 'Error') {
  return Object.assign(new Error(message), { response: { status, data: { success: false, error: { code: 'X', message } } } });
}

/** Shape of an Axios network error (no response). */
export function networkError() {
  return Object.assign(new Error('Network Error'), { request: {}, response: undefined });
}
