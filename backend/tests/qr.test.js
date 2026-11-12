import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import pngjs from 'pngjs';
import { env } from '../config/env.js';
import { Category, Product, Shop } from '../models/index.js';
import { analyseSiteUrl, generateQrImages, QR_PNG_SIZE } from '../services/qr.service.js';
import { client, createAdminToken, startApi } from './helpers/http.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

const { PNG } = pngjs;

/** Reads a QR code back from a PNG data URL with an independent decoder (jsQR). */
function decodeQrPng(dataUrl) {
  const png = PNG.sync.read(Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  const result = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);
  return { text: result?.data ?? null, width: png.width, height: png.height };
}

describe('QR code: address checks', () => {
  it('accepts a proper https website address', () => {
    for (const address of ['https://myshop.vercel.app/', 'https://www.example-shop.in/']) {
      const result = analyseSiteUrl(address);
      assert.equal(result.isProductionReady, true, address);
      assert.deepEqual(result.warnings, []);
    }
  });

  it('warns about addresses that must not be printed', () => {
    const codes = (address) => analyseSiteUrl(address).warnings.map((w) => w.code);
    assert.deepEqual(codes('http://localhost:5173/'), ['LOCALHOST', 'NOT_HTTPS']);
    assert.deepEqual(codes('http://127.0.0.1:5173/'), ['LOCALHOST', 'NOT_HTTPS']);
    assert.deepEqual(codes('http://192.168.1.20:5173/'), ['PRIVATE_NETWORK', 'NOT_HTTPS']);
    assert.deepEqual(codes('http://10.179.27.213:5173/'), ['PRIVATE_NETWORK', 'NOT_HTTPS']);
    assert.deepEqual(codes('https://172.20.0.5/'), ['PRIVATE_NETWORK']);
    assert.deepEqual(codes('https://203.0.113.10/'), ['IP_ADDRESS']);
    assert.deepEqual(codes('http://myshop.example.com/'), ['NOT_HTTPS']);
    assert.deepEqual(codes('https://myshop.example.com/?utm=poster'), ['EXTRA_PARTS']);
    assert.equal(analyseSiteUrl('http://localhost:5173/').isProductionReady, false);
  });
});

describe('QR code: images', () => {
  it('encodes exactly the website address and nothing else', async () => {
    const address = 'https://myshop.vercel.app/';
    const { pngDataUrl, svg } = await generateQrImages(address);
    const decoded = decodeQrPng(pngDataUrl);
    assert.equal(decoded.text, address);
    assert.equal(decoded.width, QR_PNG_SIZE);
    assert.match(svg, /^<svg[\s\S]*<\/svg>\s*$/);
    assert.ok(!svg.includes('<script'), 'SVG contains no scripts');
  });

  it('produces identical images for the same address (it never "changes")', async () => {
    const first = await generateQrImages('https://myshop.vercel.app/');
    const second = await generateQrImages('https://myshop.vercel.app/');
    assert.equal(first.pngDataUrl, second.pngDataUrl);
    assert.equal(first.svg, second.svg);
    const other = await generateQrImages('https://othershop.vercel.app/');
    assert.notEqual(other.pngDataUrl, first.pngDataUrl);
  });
});

describe('QR code: admin API', { skip: dbSkipReason }, () => {
  let connection;
  let api;
  let call;
  let anon;
  let product;

  before(async () => {
    connection = await setupTestDb();
    api = await startApi();
    const { token } = await createAdminToken();
    call = client(api.url, token);
    anon = client(api.url);
    const category = await Category.create({ nameEn: 'Cement', nameHi: 'सीमेंट' });
    product = await Product.create({ nameEn: 'Sample Cement (test)', category: category._id, unit: 'bag', sellingPrice: 370 });
  });

  after(async () => {
    await api?.close();
    await teardownTestDb(connection);
  });

  it('requires an admin login', async () => {
    assert.equal((await anon('GET', '/api/admin/qr-code')).status, 401);
  });

  it('returns the QR code for the configured website address', async () => {
    const res = await call('GET', '/api/admin/qr-code');
    assert.equal(res.status, 200);
    const data = res.body.data;
    assert.equal(data.url, env.PUBLIC_SITE_URL);
    assert.equal(decodeQrPng(data.pngDataUrl).text, env.PUBLIC_SITE_URL, 'the image really contains the address');
    assert.match(data.svg, /^<svg/);
    assert.equal(data.isProductionReady, analyseSiteUrl(env.PUBLIC_SITE_URL).isProductionReady);
    assert.ok(Array.isArray(data.warnings));
    assert.deepEqual(data.shop, { nameEn: '', nameHi: '', phone: '' });
  });

  it('stays exactly the same after prices, products, categories and shop details change', async () => {
    const before = (await call('GET', '/api/admin/qr-code')).body.data;

    await call('PATCH', `/api/admin/products/${product._id}/price`, { sellingPrice: 380 });
    const created = await call('POST', '/api/admin/products', { nameEn: 'New Sample (test)', category: String(product.category), unit: 'kg', sellingPrice: 10 });
    await call('DELETE', `/api/admin/products/${created.body.data.id}`);
    await call('POST', '/api/admin/categories', { nameEn: 'Paint (test)' });
    await call('PUT', '/api/admin/shop', { nameEn: 'Sample Traders (test)', nameHi: 'नमूना ट्रेडर्स', phone: '+91 90000 00000' });

    const after = (await call('GET', '/api/admin/qr-code')).body.data;
    assert.equal(after.pngDataUrl, before.pngDataUrl, 'PNG identical');
    assert.equal(after.svg, before.svg, 'SVG identical');
    assert.equal(after.url, before.url);
    // Shop details are only for the printed poster text, never inside the QR code.
    assert.deepEqual(after.shop, { nameEn: 'Sample Traders (test)', nameHi: 'नमूना ट्रेडर्स', phone: '+91 90000 00000' });
    assert.equal(decodeQrPng(after.pngDataUrl).text, env.PUBLIC_SITE_URL);
  });

  it('notes when the Shop Settings website differs from the QR address', async () => {
    await Shop.updateOne({ key: 'default' }, { websiteUrl: 'https://some-other-address.example.com' });
    const res = await call('GET', '/api/admin/qr-code');
    assert.equal(res.body.data.notes.length, 1);
    assert.equal(res.body.data.notes[0].code, 'WEBSITE_DIFFERS');
    assert.equal(res.body.data.notes[0].website, 'https://some-other-address.example.com');
    assert.match(res.body.data.notes[0].message, /different from the QR code address/);
    assert.equal(decodeQrPng(res.body.data.pngDataUrl).text, env.PUBLIC_SITE_URL, 'the QR code itself is unaffected');

    await Shop.updateOne({ key: 'default' }, { websiteUrl: env.PUBLIC_SITE_URL.replace(/\/$/, '') });
    assert.deepEqual((await call('GET', '/api/admin/qr-code')).body.data.notes, []);
  });
});
