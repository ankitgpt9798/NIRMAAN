/**
 * Turns errors from the server (written in English) into the admin's language.
 * Known error codes and validation sentences are translated; an unexpected
 * message is shown as the server wrote it.
 */

// Field names the server uses inside its messages → translated field names.
const LABELS = {
  'Selling price': 'admin.label.sellingPrice',
  'Expected price': 'admin.label.sellingPrice',
  'New price': 'admin.label.newPrice',
  MRP: 'admin.label.mrp',
  'English name': 'admin.label.nameEn',
  'Hindi name': 'admin.label.nameHi',
  Brand: 'admin.label.brand',
  Category: 'admin.label.category',
  Product: 'admin.label.product',
  'English description': 'admin.label.descriptionEn',
  'Hindi description': 'admin.label.descriptionHi',
  'Shop name (English)': 'admin.label.shopNameEn',
  'Shop name (Hindi)': 'admin.label.shopNameHi',
  'Phone number': 'admin.label.phone',
  'WhatsApp number': 'admin.label.whatsapp',
  'Address (English)': 'admin.label.addressEn',
  'Address (Hindi)': 'admin.label.addressHi',
  'Description (English)': 'admin.label.shopDescriptionEn',
  'Description (Hindi)': 'admin.label.shopDescriptionHi',
  Website: 'admin.label.website',
  Email: 'admin.label.email',
  Password: 'admin.label.password',
  'Display order': 'admin.label.sortOrder',
  'Caption (English)': 'admin.label.captionEn',
  'Caption (Hindi)': 'admin.label.captionHi',
};

const EXACT = {
  'MRP cannot be lower than the selling price': 'admin.server.mrpBelowPrice',
  'Product name is required in English or Hindi': 'admin.server.productNameRequired',
  'Category name is required in English or Hindi': 'admin.server.categoryNameRequired',
  'Choose a measurement unit from the list': 'admin.server.chooseUnit',
  'Choose In Stock, Out of Stock or Currently Unavailable': 'admin.server.chooseAvailability',
  'Category not found': 'admin.server.categoryNotFound',
  'Product not found': 'admin.server.productNotFound',
  'Photo not found': 'admin.server.photoNotFound',
  'Review not found': 'admin.server.reviewNotFound',
  'A category with this name already exists': 'admin.server.duplicateCategory',
  'Name already used by another category': 'admin.server.duplicateCategory',
  'Website must start with http:// or https://': 'admin.server.websiteFormat',
  'Enter a valid email address': 'admin.server.invalidEmail',
  'Nothing to update': 'admin.server.nothingToUpdate',
  'Incorrect email or password': 'admin.error.invalidCredentials',
  'Some fields are invalid': 'admin.error.checkFields',
};

const PATTERNS = [
  [/^The selling price is changed from "Update Prices"/, () => ['admin.server.priceViaUpdatePrices']],
  [/^This category still has (\d+) products?/, (m) => ['admin.server.categoryHasProducts', { count: m[1] }]],
  [/^Measurement unit /, () => ['admin.server.chooseUnit']],
  [/^Availability /, () => ['admin.server.chooseAvailability']],
  [/^(.+) cannot be negative$/, (m) => ['admin.server.negative', { label: m[1] }]],
  [/^(.+) must be a (?:whole )?number$/, (m) => ['admin.server.notNumber', { label: m[1] }]],
  [/^(.+) can have at most 2 decimal places$/, (m) => ['admin.server.decimals', { label: m[1] }]],
  [/^(.+) looks too large; please check the amount$/, (m) => ['admin.server.tooLarge', { label: m[1] }]],
  [/^(.+) must be at most (\d+) characters$/, (m) => ['admin.server.tooLong', { label: m[1], max: m[2] }]],
  [/^(.+) is too long$/, (m) => ['admin.server.tooLongShort', { label: m[1] }]],
  [/^(.+) is required$/, (m) => ['admin.server.required', { label: m[1] }]],
  [/^(.+) (?:is not valid|must be text|must be true or false)$/, (m) => ['admin.server.invalid', { label: m[1] }]],
  [/^(.+): use digits, spaces or "-" only/, (m) => ['admin.server.phoneFormat', { label: m[1] }]],
];

export function translateServerText(text, t) {
  if (!text) return '';
  if (EXACT[text]) return t(EXACT[text]);
  for (const [pattern, build] of PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const [key, vars = {}] = build(match);
    if (vars.label !== undefined) vars.label = LABELS[vars.label] ? t(LABELS[vars.label]) : vars.label;
    return t(key, vars);
  }
  return text;
}

const CODE_KEYS = {
  INVALID_CREDENTIALS: 'admin.error.invalidCredentials',
  TOKEN_EXPIRED: 'admin.auth.sessionExpired',
  UNAUTHORIZED: 'admin.auth.sessionEnded',
  FORBIDDEN: 'admin.error.forbidden',
  VALIDATION_ERROR: 'admin.error.checkFields',
  INVALID_IMAGE: 'admin.error.invalidImage',
  INVALID_UPLOAD: 'admin.error.invalidImage',
  IMAGE_TOO_LARGE: 'admin.error.imageTooLarge',
  IMAGE_REQUIRED: 'admin.error.imageRequired',
  IMAGE_UPLOAD_FAILED: 'admin.error.imageUploadFailed',
  PAYLOAD_TOO_LARGE: 'admin.error.payloadTooLarge',
  GALLERY_FULL: 'admin.error.galleryFull',
  INTERNAL_ERROR: 'admin.error.generic',
  INVALID_JSON: 'admin.error.generic',
};

/** One short message for any error (network, server, or a local check with an `i18nKey`). */
export function apiErrorMessage(error, t, fallbackKey = 'admin.error.generic') {
  if (!error) return '';
  if (!error.response) {
    if (error.i18nKey) return t(error.i18nKey);
    if (error.code === 'ECONNABORTED') return t('admin.error.timeout');
    if (error.request) return t('admin.error.network');
    return t(fallbackKey);
  }
  const apiError = error.response.data?.error;
  if (apiError?.code === 'TOO_MANY_REQUESTS') {
    return t(/login/i.test(apiError.message ?? '') ? 'admin.error.tooManyLogins' : 'admin.error.tooManyRequests');
  }
  if (CODE_KEYS[apiError?.code]) return t(CODE_KEYS[apiError.code]);
  if (apiError?.message) return translateServerText(apiError.message, t);
  return t(fallbackKey);
}

/**
 * Text for a form message, which is either an already-translated string (from the
 * server) or a description { key, vars?, labelKey? } (from checks in the browser,
 * translated when shown, so it follows the language switch).
 */
export function messageText(entry, t) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  return t(entry.key, { ...entry.vars, ...(entry.labelKey ? { label: t(entry.labelKey) } : {}) });
}

/** Server validation details → { fieldName: translated message }; messages without a field go under "_form". */
export function fieldErrorsFrom(error, t) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return details.reduce((errors, { field, message }) => {
    const key = field || '_form';
    if (message && !errors[key]) errors[key] = translateServerText(message, t);
    return errors;
  }, {});
}
