import { describe, expect, it } from 'vitest';
import { dictionaries } from './dictionaries';
import './admin';
import { apiErrorMessage, fieldErrorsFrom, translateServerText } from './apiErrors';

// Same lookup as I18nProvider: language → English → the key itself.
const translator = (lang) => (key, vars = {}) =>
  (dictionaries[lang][key] ?? dictionaries.en[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
const hi = translator('hi');
const en = translator('en');

const serverError = (status, code, message, details) => ({
  response: { status, data: { success: false, error: { code, message, ...(details ? { details } : {}) } } },
});

describe('server messages in the admin language', () => {
  it('translates the validation sentences the server sends, with translated field names', () => {
    expect(translateServerText('Selling price cannot be negative', hi)).toBe('बिक्री रेट माइनस (ऋणात्मक) नहीं हो सकता');
    expect(translateServerText('Shop name (English) must be at most 120 characters', hi)).toBe('दुकान का नाम (अंग्रेज़ी) अधिकतम 120 अक्षरों का हो सकता है');
    expect(translateServerText('MRP cannot be lower than the selling price', hi)).toMatch(/[ऀ-ॿ]/);
    expect(translateServerText('This category still has 3 products. Move or delete them first.', hi)).toContain('3');
  });

  it('gives the same English text back in English', () => {
    expect(translateServerText('Selling price cannot be negative', en)).toBe('Selling price cannot be negative');
    expect(translateServerText('Shop name (English) must be at most 120 characters', en)).toBe('Shop name (English) must be at most 120 characters');
  });

  it('keeps an unexpected message as the server wrote it', () => {
    expect(translateServerText('Some brand-new server message', hi)).toBe('Some brand-new server message');
  });

  it('picks a message from the error code, the connection state or the fallback', () => {
    expect(apiErrorMessage(serverError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password'), hi)).toBe('ईमेल या पासवर्ड गलत है');
    expect(apiErrorMessage(serverError(429, 'TOO_MANY_REQUESTS', 'Too many login attempts'), en)).toMatch(/login attempts/);
    expect(apiErrorMessage(serverError(429, 'TOO_MANY_REQUESTS', 'Slow down'), en)).toMatch(/Too many requests/);
    expect(apiErrorMessage({ request: {} }, hi)).toBe(hi('admin.error.network'));
    expect(apiErrorMessage({ request: {}, code: 'ECONNABORTED' }, en)).toBe(en('admin.error.timeout'));
    expect(apiErrorMessage(Object.assign(new Error('x'), { i18nKey: 'admin.image.errType' }), hi)).toBe(hi('admin.image.errType'));
    expect(apiErrorMessage(new Error('canvas broke'), en, 'admin.qr.posterFailed')).toBe(en('admin.qr.posterFailed'));
    expect(apiErrorMessage(serverError(500, 'SOMETHING_NEW'), hi)).toBe(hi('admin.error.generic'));
  });

  it('turns validation details into translated messages per field', () => {
    const error = serverError(400, 'VALIDATION_ERROR', 'Some fields are invalid', [
      { field: 'mrp', message: 'MRP cannot be negative' },
      { field: 'mrp', message: 'second message for the same field is ignored' },
      { message: 'Nothing to update' },
    ]);
    expect(fieldErrorsFrom(error, hi)).toEqual({ mrp: 'एमआरपी माइनस (ऋणात्मक) नहीं हो सकता', _form: hi('admin.server.nothingToUpdate') });
    expect(fieldErrorsFrom(new Error('no details'), hi)).toEqual({});
  });
});
