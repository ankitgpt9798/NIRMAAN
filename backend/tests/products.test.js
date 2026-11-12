import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Category, PriceHistory, Product } from '../models/index.js';
import { TINY_PNG, client, createAdminToken, imageForm, startApi } from './helpers/http.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

// Product data below is clearly labelled sample data for tests only.

const uploadsDir = process.env.UPLOADS_DIR;
const fileForUrl = (url) => path.join(uploadsDir, ...url.replace(/^\/uploads\//, '').split('/'));
const exists = (file) => fs.access(file).then(() => true, () => false);

describe('Product management API', { skip: dbSkipReason }, () => {
  let connection;
  let api;
  let call;
  let anon;
  const cat = {};
  const ids = {};

  const newProduct = (overrides = {}) => ({
    nameEn: 'Sample Cement (test)',
    nameHi: 'नमूना सीमेंट (टेस्ट)',
    brand: 'Demo Brand',
    category: cat.cement,
    unit: 'bag_50kg',
    sellingPrice: 100,
    ...overrides,
  });

  before(async () => {
    connection = await setupTestDb();
    api = await startApi();
    const { token } = await createAdminToken();
    call = client(api.url, token);
    anon = client(api.url);
    for (const [key, nameEn, nameHi] of [['cement', 'Cement', 'सीमेंट'], ['tmt', 'TMT Rod', 'सरिया'], ['sand', 'Sand', 'रेत'], ['other', 'Other Building Materials', 'अन्य']]) {
      cat[key] = String((await Category.create({ nameEn, nameHi, showDeliveryNote: key === 'sand' }))._id);
    }
  });

  after(async () => {
    await api?.close();
    await teardownTestDb(connection);
    await fs.rm(uploadsDir, { recursive: true, force: true });
  });

  it('requires an admin login for every product endpoint', async () => {
    const id = '64b000000000000000000000';
    const requests = [
      ['GET', '/api/admin/products'], ['POST', '/api/admin/products', newProduct()], ['GET', `/api/admin/products/${id}`],
      ['PUT', `/api/admin/products/${id}`, { brand: 'x' }], ['DELETE', `/api/admin/products/${id}`],
      ['PUT', `/api/admin/products/${id}/image`, imageForm(TINY_PNG)], ['DELETE', `/api/admin/products/${id}/image`],
      ['GET', '/api/admin/meta'], ['GET', '/api/admin/dashboard/stats'],
    ];
    for (const [method, url, body] of requests) {
      assert.equal((await anon(method, url, body)).status, 401, `${method} ${url}`);
    }
  });

  it('adds cement, TMT rod, sand and other products, each with its own unit', async () => {
    const samples = {
      cement: newProduct({ mrp: 120 }),
      tmt: newProduct({ nameEn: 'Sample TMT Bar 12mm (test)', nameHi: 'नमूना सरिया 12mm', brand: 'Demo Steel', category: cat.tmt, unit: 'kg', sellingPrice: 65.5 }),
      sand: newProduct({ nameEn: 'Sample River Sand (test)', nameHi: 'नमूना नदी रेत', brand: '', category: cat.sand, unit: 'tractor', sellingPrice: 3000 }),
      other: newProduct({ nameEn: '', nameHi: 'नमूना ईंट (टेस्ट)', brand: '', category: cat.other, unit: 'piece', sellingPrice: 8, availability: 'out_of_stock' }),
    };
    for (const [key, body] of Object.entries(samples)) {
      const res = await call('POST', '/api/admin/products', body);
      assert.equal(res.status, 201, `${key}: ${JSON.stringify(res.body)}`);
      ids[key] = res.body.data.id;
    }

    const tmt = (await call('GET', `/api/admin/products/${ids.tmt}`)).body.data;
    assert.equal(tmt.unit, 'kg');
    assert.deepEqual(tmt.unitLabel, { en: 'Per KG', hi: 'प्रति किलो' });
    assert.equal(tmt.sellingPrice, 65.5);
    assert.equal(tmt.mrp, null);
    assert.equal(tmt.category.nameEn, 'TMT Rod');
    assert.equal(tmt.availability, 'in_stock');
    assert.ok(tmt.priceUpdatedAt);

    const sand = (await call('GET', `/api/admin/products/${ids.sand}`)).body.data;
    assert.equal(sand.unitLabel.en, 'Per Trolley');
    assert.equal(sand.category.showDeliveryNote, true);

    assert.equal(await PriceHistory.countDocuments(), 0, 'the first price is not a price change');
  });

  it('rejects invalid product data with field-level messages', async () => {
    const cases = [
      [{ sellingPrice: -5 }, 'sellingPrice', /cannot be negative/],
      [{ mrp: -1 }, 'mrp', /cannot be negative/],
      [{ sellingPrice: 100, mrp: 90 }, 'mrp', /lower than the selling price/],
      [{ sellingPrice: '380' }, 'sellingPrice', /must be a number/],
      [{ sellingPrice: 10.555 }, 'sellingPrice', /2 decimal places/],
      [{ sellingPrice: undefined }, 'sellingPrice', /number/],
      [{ unit: 'per-galaxy' }, 'unit', /measurement unit/],
      [{ availability: 'maybe' }, 'availability', /In Stock/],
      [{ nameEn: '', nameHi: '  ' }, 'nameEn', /English or Hindi/],
      [{ category: 'abc' }, 'category', /not valid/],
      [{ category: '64b000000000000000000000' }, 'category', /not found/],
      [{ priceUpdatedAt: '2020-01-01' }, '', /Unrecognized/i],
    ];
    for (const [overrides, field, message] of cases) {
      const res = await call('POST', '/api/admin/products', newProduct(overrides));
      assert.equal(res.status, 400, JSON.stringify(overrides));
      const detail = res.body.error.details?.find((d) => d.field === field);
      assert.ok(detail, `${JSON.stringify(overrides)} -> ${JSON.stringify(res.body.error)}`);
      assert.match(detail.message, message);
    }
  });

  it('gets one product and answers 404 for unknown or malformed ids', async () => {
    assert.equal((await call('GET', `/api/admin/products/${ids.cement}`)).body.data.mrp, 120);
    assert.equal((await call('GET', '/api/admin/products/64b000000000000000000000')).status, 404);
    assert.equal((await call('GET', '/api/admin/products/not-an-id')).status, 404);
  });

  it('edits product details, including the measurement unit and category', async () => {
    const res = await call('PUT', `/api/admin/products/${ids.tmt}`, {
      nameEn: 'Sample TMT Bar 12mm Fe550 (test)',
      descriptionEn: 'Sample description',
      descriptionHi: 'नमूना विवरण',
      unit: 'quintal',
      category: cat.tmt,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.unit, 'quintal');
    assert.equal(res.body.data.unitLabel.hi, 'प्रति क्विंटल');
    assert.equal(res.body.data.descriptionHi, 'नमूना विवरण');
    assert.equal(res.body.data.sellingPrice, 65.5, 'price unchanged');
  });

  it('does not change the selling price through product edit', async () => {
    const before = await Product.findById(ids.cement).lean();
    const res = await call('PUT', `/api/admin/products/${ids.cement}`, { sellingPrice: 110 });
    assert.equal(res.status, 400);
    assert.match(res.body.error.details[0].message, /Update Prices/);
    const after = await Product.findById(ids.cement).lean();
    assert.equal(after.sellingPrice, before.sellingPrice);
  });

  it('checks MRP against the current selling price when editing', async () => {
    const low = await call('PUT', `/api/admin/products/${ids.cement}`, { mrp: 99 });
    assert.equal(low.status, 400);
    assert.match(low.body.error.details[0].message, /lower than the selling price/);
    const ok = await call('PUT', `/api/admin/products/${ids.cement}`, { mrp: 125.5 });
    assert.equal(ok.body.data.mrp, 125.5);
    const cleared = await call('PUT', `/api/admin/products/${ids.cement}`, { mrp: null });
    assert.equal(cleared.body.data.mrp, null);
  });

  it('changes availability without touching the price or price history', async () => {
    const before = await Product.findById(ids.sand).lean();
    for (const availability of ['out_of_stock', 'unavailable', 'in_stock']) {
      const res = await call('PUT', `/api/admin/products/${ids.sand}`, { availability });
      assert.equal(res.body.data.availability, availability);
    }
    const after = await Product.findById(ids.sand).lean();
    assert.equal(after.sellingPrice, before.sellingPrice);
    assert.equal(after.priceUpdatedAt.getTime(), before.priceUpdatedAt.getTime());
    assert.equal(await PriceHistory.countDocuments(), 0);
  });

  it('hides and shows a product (deactivate / activate)', async () => {
    assert.equal((await call('PUT', `/api/admin/products/${ids.other}`, { isActive: false })).body.data.isActive, false);
    assert.equal((await call('PUT', `/api/admin/products/${ids.other}`, { isActive: true })).body.data.isActive, true);
  });

  it('searches by English name, Hindi name, brand and category name', async () => {
    const names = async (query) => (await call('GET', `/api/admin/products?${query}`)).body.data.items.map((p) => p.id).sort();
    assert.deepEqual(await names('search=tmt bar'), [ids.tmt]);
    assert.deepEqual(await names(`search=${encodeURIComponent('ईंट')}`), [ids.other]);
    assert.deepEqual(await names('search=demo steel'), [ids.tmt]);
    assert.deepEqual(await names('search=sand'), [ids.sand]);
    assert.deepEqual(await names('search=(test'), [ids.cement, ids.sand, ids.tmt].sort(), 'special characters are searched literally');
    assert.deepEqual(await names('search=nothing-matches-this'), []);
  });

  it('filters by category, availability and active status, with pages', async () => {
    await call('PUT', `/api/admin/products/${ids.cement}`, { isActive: false });
    const list = async (query) => (await call('GET', `/api/admin/products?${query}`)).body.data;

    assert.deepEqual((await list(`category=${cat.sand}`)).items.map((p) => p.id), [ids.sand]);
    assert.deepEqual((await list('availability=out_of_stock')).items.map((p) => p.id), [ids.other]);
    assert.deepEqual((await list('status=inactive')).items.map((p) => p.id), [ids.cement]);
    assert.equal((await list('status=active')).total, 3);
    assert.equal((await list('status=&category=')).total, 4, 'empty filters are ignored');

    const page1 = await list('limit=3&page=1');
    const page2 = await list('limit=3&page=2');
    assert.equal(page1.total, 4);
    assert.equal(page1.totalPages, 2);
    assert.equal(page1.items.length, 3);
    assert.equal(page2.items.length, 1);
    assert.ok(!page1.items.some((p) => p.id === page2.items[0].id));

    assert.equal((await call('GET', '/api/admin/products?category=abc')).status, 400);
    assert.equal((await call('GET', '/api/admin/products?limit=500')).status, 400);
    await call('PUT', `/api/admin/products/${ids.cement}`, { isActive: true });
  });

  describe('product images', () => {
    it('uploads an image and serves it so the website can display it', async () => {
      const res = await call('PUT', `/api/admin/products/${ids.cement}/image`, imageForm(TINY_PNG));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const { image } = res.body.data;
      assert.equal(image.provider, 'local');
      assert.match(image.url, /^\/uploads\/products\/[a-f0-9]{32}\.png$/);
      assert.equal(image.publicId, undefined, 'storage id is not exposed');
      assert.ok(await exists(fileForUrl(image.url)));

      const served = await fetch(`${api.url}${image.url}`);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get('content-type'), 'image/png');
      assert.equal(served.headers.get('cross-origin-resource-policy'), 'cross-origin');
      assert.deepEqual(Buffer.from(await served.arrayBuffer()), TINY_PNG);
    });

    it('replaces an image and deletes the old file', async () => {
      const oldUrl = (await call('GET', `/api/admin/products/${ids.cement}`)).body.data.image.url;
      const res = await call('PUT', `/api/admin/products/${ids.cement}/image`, imageForm(TINY_PNG));
      assert.notEqual(res.body.data.image.url, oldUrl);
      assert.equal(await exists(fileForUrl(oldUrl)), false);
      assert.ok(await exists(fileForUrl(res.body.data.image.url)));
    });

    it('removes an image', async () => {
      const url = (await call('GET', `/api/admin/products/${ids.cement}`)).body.data.image.url;
      const res = await call('DELETE', `/api/admin/products/${ids.cement}/image`);
      assert.equal(res.body.data.image, null);
      assert.equal(await exists(fileForUrl(url)), false);
    });

    it('rejects files that are not real JPG/PNG/WebP images', async () => {
      const fake = await call('PUT', `/api/admin/products/${ids.cement}/image`, imageForm(Buffer.from('<script>alert(1)</script> not an image'), { type: 'image/png' }));
      assert.equal(fake.status, 400);
      assert.equal(fake.body.error.code, 'INVALID_IMAGE');

      const gif = await call('PUT', `/api/admin/products/${ids.cement}/image`, imageForm(Buffer.from('GIF89a........'), { type: 'image/gif', name: 'a.gif' }));
      assert.equal(gif.status, 400);
      assert.equal(gif.body.error.code, 'INVALID_IMAGE');

      const svg = await call('PUT', `/api/admin/products/${ids.cement}/image`, imageForm(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), { type: 'image/svg+xml', name: 'a.svg' }));
      assert.equal(svg.status, 400);
    });

    it('rejects images over 5 MB, missing files and extra files', async () => {
      const big = Buffer.concat([TINY_PNG, Buffer.alloc(5 * 1024 * 1024)]);
      const tooBig = await call('PUT', `/api/admin/products/${ids.cement}/image`, imageForm(big));
      assert.equal(tooBig.status, 413);
      assert.equal(tooBig.body.error.code, 'IMAGE_TOO_LARGE');

      const missing = await call('PUT', `/api/admin/products/${ids.cement}/image`, new FormData());
      assert.equal(missing.status, 400);
      assert.equal(missing.body.error.code, 'IMAGE_REQUIRED');

      const wrongField = await call('PUT', `/api/admin/products/${ids.cement}/image`, imageForm(TINY_PNG, { field: 'photo' }));
      assert.equal(wrongField.status, 400);

      const two = imageForm(TINY_PNG);
      two.append('image', new Blob([TINY_PNG], { type: 'image/png' }), 'second.png');
      assert.equal((await call('PUT', `/api/admin/products/${ids.cement}/image`, two)).status, 400);
    });

    it('answers 404 for an unknown product without storing the file', async () => {
      const before = await fs.readdir(path.join(uploadsDir, 'products')).catch(() => []);
      const res = await call('PUT', '/api/admin/products/64b000000000000000000000/image', imageForm(TINY_PNG));
      assert.equal(res.status, 404);
      const after = await fs.readdir(path.join(uploadsDir, 'products')).catch(() => []);
      assert.deepEqual(after.sort(), before.sort());
    });
  });

  it('deletes a product and its image but keeps its price history', async () => {
    const upload = await call('PUT', `/api/admin/products/${ids.other}/image`, imageForm(TINY_PNG));
    const file = fileForUrl(upload.body.data.image.url);
    const history = await PriceHistory.create({ product: ids.other, productNameHi: 'नमूना ईंट (टेस्ट)', previousPrice: 7, newPrice: 8, updatedBy: '64b000000000000000000001' });

    const res = await call('DELETE', `/api/admin/products/${ids.other}`);
    assert.equal(res.status, 200);
    assert.equal((await call('GET', `/api/admin/products/${ids.other}`)).status, 404);
    assert.equal(await exists(file), false);
    assert.ok(await PriceHistory.exists({ _id: history._id }), 'history is kept for the records');
    assert.equal((await call('DELETE', `/api/admin/products/${ids.other}`)).status, 404);
    await PriceHistory.deleteMany({});
  });

  it('returns dashboard summary numbers', async () => {
    await call('PUT', `/api/admin/products/${ids.sand}`, { availability: 'out_of_stock' });
    await call('PUT', `/api/admin/products/${ids.tmt}`, { isActive: false });
    const res = await call('GET', '/api/admin/dashboard/stats');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.products, { total: 3, active: 2, inactive: 1, inStock: 1, outOfStock: 1, unavailable: 0 });
    assert.deepEqual(res.body.data.categories, { total: 4, active: 4 });
    assert.deepEqual(res.body.data.recentPriceUpdates, []);
  });

  it('provides the unit and availability lists for the admin forms', async () => {
    const res = await call('GET', '/api/admin/meta');
    assert.equal(res.status, 200);
    const keys = res.body.data.units.map((u) => u.key);
    for (const key of ['bag', 'bag_50kg', 'kg', 'piece', 'bundle', 'ton', 'tractor', 'truck', 'cft', 'brass', 'packet', 'sqft']) {
      assert.ok(keys.includes(key), key);
    }
    assert.ok(res.body.data.units.every((u) => u.en && u.hi));
    assert.deepEqual(res.body.data.availability.map((a) => a.value), ['in_stock', 'out_of_stock', 'unavailable']);
  });
});
