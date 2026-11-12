import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Category, Product, Shop } from '../models/index.js';
import { client, startApi } from './helpers/http.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

// Clearly labelled sample data; prices are arbitrary test values.

describe('Public catalogue API', { skip: dbSkipReason }, () => {
  let connection;
  let api;
  let anon;
  const cat = {};
  const prod = {};

  before(async () => {
    connection = await setupTestDb();
    api = await startApi();
    anon = client(api.url);

    cat.sand = await Category.create({ nameEn: 'Sand', nameHi: 'रेत', sortOrder: 30, showDeliveryNote: true });
    cat.cement = await Category.create({ nameEn: 'Cement', nameHi: 'सीमेंट', sortOrder: 10 });
    cat.hidden = await Category.create({ nameEn: 'Hidden Category', nameHi: 'छुपी', sortOrder: 5, isActive: false });
    cat.empty = await Category.create({ nameEn: 'Paint', nameHi: 'पेंट', sortOrder: 40 });

    const make = (fields) => Product.create({ unit: 'bag', sellingPrice: 100, ...fields });
    prod.cementB = await make({ nameEn: 'Beta Cement (sample)', nameHi: 'बीटा सीमेंट', brand: 'Demo Two', category: cat.cement._id, sellingPrice: 390, mrp: 400, unit: 'bag_50kg', descriptionEn: 'Sample', image: { url: 'https://res.cloudinary.com/demo/x.jpg', publicId: 'nirmaan/products/secret-id', provider: 'cloudinary' } });
    prod.cementA = await make({ nameEn: 'Alpha Cement (sample)', nameHi: 'अल्फा सीमेंट', brand: 'Demo One', category: cat.cement._id, availability: 'out_of_stock' });
    prod.sand = await make({ nameEn: '', nameHi: 'नमूना नदी रेत', category: cat.sand._id, unit: 'tractor', sellingPrice: 3000, availability: 'unavailable' });
    prod.inactive = await make({ nameEn: 'Discontinued Cement (sample)', category: cat.cement._id, isActive: false });
    prod.inHidden = await make({ nameEn: 'Product In Hidden Category (sample)', category: cat.hidden._id });

    // Most recent price change among visible products.
    await Product.updateOne({ _id: prod.sand._id }, { priceUpdatedAt: new Date('2026-11-01T10:00:00Z') });
    await Product.updateOne({ _id: prod.cementA._id }, { priceUpdatedAt: new Date('2026-11-05T10:00:00Z') });
    await Product.updateOne({ _id: prod.cementB._id }, { priceUpdatedAt: new Date('2026-11-03T10:00:00Z') });
    await Product.updateOne({ _id: prod.inactive._id }, { priceUpdatedAt: new Date('2026-11-09T10:00:00Z') });
  });

  after(async () => {
    await api?.close();
    await teardownTestDb(connection);
  });

  const productIds = (body) => body.data.items.map((p) => p.id);

  it('needs no login', async () => {
    for (const path of ['/api/public/shop', '/api/public/products', '/api/public/categories', `/api/public/products/${prod.sand._id}`]) {
      assert.equal((await anon('GET', path)).status, 200, path);
    }
  });

  it('lists only active products in active categories, including out-of-stock ones', async () => {
    const res = await anon('GET', '/api/public/products');
    const ids = productIds(res.body);
    assert.ok(ids.includes(String(prod.cementA._id)), 'out-of-stock product stays visible');
    assert.ok(ids.includes(String(prod.sand._id)), 'currently unavailable product stays visible');
    assert.ok(!ids.includes(String(prod.inactive._id)), 'hidden product is not listed');
    assert.ok(!ids.includes(String(prod.inHidden._id)), 'product of hidden category is not listed');
    assert.equal(res.body.data.total, 3);
  });

  it('orders by category display order, then product name', async () => {
    const res = await anon('GET', '/api/public/products');
    assert.deepEqual(productIds(res.body), [prod.cementA, prod.cementB, prod.sand].map((p) => String(p._id)));
  });

  it('reports when prices were last updated (visible products only)', async () => {
    const res = await anon('GET', '/api/public/products');
    assert.equal(res.body.data.lastUpdated, '2026-11-05T10:00:00.000Z');
  });

  it('sends only customer-facing fields', async () => {
    const res = await anon('GET', '/api/public/products');
    const cement = res.body.data.items.find((p) => p.id === String(prod.cementB._id));
    assert.deepEqual(Object.keys(cement).sort(), [
      'availability', 'brand', 'category', 'descriptionEn', 'descriptionHi', 'id', 'image', 'mrp', 'nameEn', 'nameHi', 'priceUpdatedAt', 'sellingPrice', 'unit', 'unitLabel',
    ]);
    assert.deepEqual(cement.image, { url: 'https://res.cloudinary.com/demo/x.jpg', provider: 'cloudinary' });
    assert.deepEqual(cement.unitLabel, { en: 'Per 50 KG Bag', hi: 'प्रति 50 किलो बोरी' });
    assert.equal(cement.sellingPrice, 390);
    assert.equal(cement.mrp, 400);
    assert.deepEqual(Object.keys(cement.category).sort(), ['id', 'nameEn', 'nameHi', 'showDeliveryNote', 'sortOrder']);
    assert.ok(!JSON.stringify(res.body).includes('secret-id'), 'storage ids never reach customers');
  });

  it('marks categories that need the delivery-charges note', async () => {
    const res = await anon('GET', '/api/public/products');
    const sand = res.body.data.items.find((p) => p.id === String(prod.sand._id));
    assert.equal(sand.category.showDeliveryNote, true);
    assert.equal(sand.unitLabel.en, 'Per Trolley');
  });

  it('searches by English name, Hindi name, brand and category', async () => {
    const search = async (q) => productIds((await anon('GET', `/api/public/products?search=${encodeURIComponent(q)}`)).body);
    assert.deepEqual(await search('alpha'), [String(prod.cementA._id)]);
    assert.deepEqual(await search('नदी'), [String(prod.sand._id)]);
    assert.deepEqual(await search('demo two'), [String(prod.cementB._id)]);
    assert.deepEqual((await search('cement')).length, 2);
    assert.deepEqual(await search('discontinued'), [], 'hidden products are never found');
    assert.deepEqual(await search('hidden category'), [], 'hidden categories are never matched');
  });

  it('filters by category; hidden or unknown categories give no products', async () => {
    const list = async (id) => (await anon('GET', `/api/public/products?category=${id}`)).body.data;
    assert.equal((await list(cat.cement._id)).total, 2);
    assert.equal((await list(cat.hidden._id)).total, 0);
    assert.equal((await list('64b000000000000000000000')).total, 0);
    assert.equal((await anon('GET', '/api/public/products?category=abc')).status, 400);
    assert.equal((await anon('GET', '/api/public/products?limit=5000')).status, 400);
  });

  it('supports pages when needed', async () => {
    const page2 = (await anon('GET', '/api/public/products?limit=2&page=2')).body.data;
    assert.equal(page2.total, 3);
    assert.equal(page2.totalPages, 2);
    assert.deepEqual(page2.items.map((p) => p.id), [String(prod.sand._id)]);
  });

  it('shows details of a visible product only', async () => {
    const ok = await anon('GET', `/api/public/products/${prod.cementB._id}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.nameHi, 'बीटा सीमेंट');
    assert.equal(ok.body.data.isActive, undefined);
    for (const id of [prod.inactive._id, prod.inHidden._id, '64b000000000000000000000', 'not-an-id']) {
      assert.equal((await anon('GET', `/api/public/products/${id}`)).status, 404, String(id));
    }
  });

  it('lists active categories in order with their visible product counts', async () => {
    const res = await anon('GET', '/api/public/categories');
    const rows = res.body.data.items.map((c) => [c.nameEn, c.productCount, c.showDeliveryNote]);
    assert.deepEqual(rows, [['Cement', 2, false], ['Sand', 1, true], ['Paint', 0, false]]);
  });

  it('returns empty shop details without creating a record, then the saved details', async () => {
    const empty = await anon('GET', '/api/public/shop');
    assert.equal(empty.body.data.nameEn, '');
    assert.equal(empty.body.data.logo, null);
    assert.equal(await Shop.countDocuments(), 0, 'a public GET must not write to the database');

    await Shop.create({ nameEn: 'Sample Traders (test)', nameHi: 'नमूना ट्रेडर्स', phone: '+91 90000 00000', addressHi: 'नमूना पता' });
    const saved = await anon('GET', '/api/public/shop');
    assert.equal(saved.body.data.nameHi, 'नमूना ट्रेडर्स');
    assert.equal(saved.body.data.phone, '+91 90000 00000');
    assert.equal(saved.body.data.key, undefined);
    assert.equal(saved.body.data._id, undefined);
  });

  it('shows a changed price on the very next request', async () => {
    await Product.updateOne({ _id: prod.cementB._id }, { sellingPrice: 395 });
    const res = await anon('GET', `/api/public/products/${prod.cementB._id}`);
    assert.equal(res.body.data.sellingPrice, 395);
  });

  it('tells browsers to re-check prices every time, using 304 when unchanged', async () => {
    const first = await fetch(`${api.url}/api/public/products`);
    assert.equal(first.headers.get('cache-control'), 'no-cache');
    const etag = first.headers.get('etag');
    assert.ok(etag);

    // Revalidate the way a browser's cache does. (fetch() cannot be used here: per the
    // Fetch standard it adds "Cache-Control: no-cache" to hand-made conditional requests.)
    const revalidate = () =>
      new Promise((resolve, reject) => {
        http
          .get(`${api.url}/api/public/products`, { headers: { 'If-None-Match': etag } }, (res) => {
            res.resume();
            resolve(res.statusCode);
          })
          .on('error', reject);
      });
    assert.equal(await revalidate(), 304, 'unchanged catalogue is not downloaded again');

    await Product.updateOne({ _id: prod.cementA._id }, { sellingPrice: 101 });
    assert.equal(await revalidate(), 200, 'a price change produces a new response');
  });

  it('is read-only', async () => {
    assert.equal((await anon('POST', '/api/public/products', { nameEn: 'x' })).status, 404);
    assert.equal((await anon('PUT', `/api/public/products/${prod.sand._id}`, { sellingPrice: 1 })).status, 404);
    assert.equal((await anon('DELETE', `/api/public/products/${prod.sand._id}`)).status, 404);
  });
});
