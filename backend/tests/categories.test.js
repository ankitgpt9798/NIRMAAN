import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Category, Product } from '../models/index.js';
import { client, createAdminToken, startApi } from './helpers/http.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

describe('Category management API', { skip: dbSkipReason }, () => {
  let connection;
  let api;
  let call;
  let anon;

  before(async () => {
    connection = await setupTestDb();
    api = await startApi();
    const { token } = await createAdminToken();
    call = client(api.url, token);
    anon = client(api.url);
  });

  after(async () => {
    await api?.close();
    await teardownTestDb(connection);
  });

  it('requires an admin login for every category endpoint', async () => {
    const id = '64b000000000000000000000';
    for (const [method, path] of [['GET', '/api/admin/categories'], ['POST', '/api/admin/categories'], ['PUT', `/api/admin/categories/${id}`], ['DELETE', `/api/admin/categories/${id}`]]) {
      const res = await anon(method, path, method === 'GET' || method === 'DELETE' ? undefined : { nameEn: 'X' });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });

  it('creates a category with bilingual names and defaults', async () => {
    const res = await call('POST', '/api/admin/categories', { nameEn: '  Cement ', nameHi: 'सीमेंट', sortOrder: 10 });
    assert.equal(res.status, 201);
    const category = res.body.data;
    assert.equal(category.nameEn, 'Cement');
    assert.equal(category.nameHi, 'सीमेंट');
    assert.equal(category.isActive, true);
    assert.equal(category.showDeliveryNote, false);
    assert.equal(category.productCount, 0);
    assert.ok(category.id);
    assert.equal(category._id, undefined);
    assert.equal(category.__v, undefined);
  });

  it('allows a category with only a Hindi name', async () => {
    const res = await call('POST', '/api/admin/categories', { nameHi: 'गिट्टी', showDeliveryNote: true, sortOrder: 35 });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.showDeliveryNote, true);
  });

  it('rejects duplicate names regardless of letter case', async () => {
    const en = await call('POST', '/api/admin/categories', { nameEn: 'CEMENT', nameHi: 'कुछ और' });
    assert.equal(en.status, 409);
    assert.equal(en.body.error.details[0].field, 'nameEn');
    const hi = await call('POST', '/api/admin/categories', { nameEn: 'Gravel', nameHi: 'गिट्टी' });
    assert.equal(hi.status, 409);
    assert.equal(hi.body.error.details[0].field, 'nameHi');
  });

  it('validates category input', async () => {
    const cases = [
      [{}, 'nameEn'],
      [{ nameEn: '   ', nameHi: '' }, 'nameEn'],
      [{ nameEn: 'X'.repeat(81) }, 'nameEn'],
      [{ nameEn: 'Paint', sortOrder: 1.5 }, 'sortOrder'],
      [{ nameEn: 'Paint', isActive: 'yes' }, 'isActive'],
      [{ nameEn: 'Paint', productCount: 5 }, ''],
    ];
    for (const [body, field] of cases) {
      const res = await call('POST', '/api/admin/categories', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.details.some((d) => d.field === field), `${JSON.stringify(body)} -> ${JSON.stringify(res.body.error.details)}`);
    }
  });

  it('lists categories in display order with product counts', async () => {
    const cement = await Category.findOne({ nameEn: 'Cement' });
    await Product.create({ nameEn: 'Sample Cement (test)', category: cement._id, unit: 'bag', sellingPrice: 100 });
    await Product.create({ nameEn: 'Hidden Cement (test)', category: cement._id, unit: 'bag', sellingPrice: 100, isActive: false });

    const res = await call('GET', '/api/admin/categories');
    assert.equal(res.status, 200);
    const items = res.body.data.items;
    assert.deepEqual(items.map((c) => c.sortOrder), [10, 35]);
    const cementRow = items.find((c) => c.nameEn === 'Cement');
    assert.equal(cementRow.productCount, 2);
    assert.equal(cementRow.activeProductCount, 1);
  });

  it('updates names, description, order and delivery note', async () => {
    const gravel = await Category.findOne({ nameHi: 'गिट्टी' });
    const res = await call('PUT', `/api/admin/categories/${gravel._id}`, {
      nameEn: 'Gravel & Aggregates',
      descriptionEn: 'Stone chips of various sizes',
      sortOrder: 5,
      showDeliveryNote: true,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.nameEn, 'Gravel & Aggregates');
    assert.equal(res.body.data.nameHi, 'गिट्टी');
    assert.equal(res.body.data.sortOrder, 5);
  });

  it('rejects updates that duplicate another name or remove both names', async () => {
    const gravel = await Category.findOne({ nameHi: 'गिट्टी' });
    const duplicate = await call('PUT', `/api/admin/categories/${gravel._id}`, { nameEn: 'cement' });
    assert.equal(duplicate.status, 409);
    const noName = await call('PUT', `/api/admin/categories/${gravel._id}`, { nameEn: '', nameHi: '' });
    assert.equal(noName.status, 400);
    const empty = await call('PUT', `/api/admin/categories/${gravel._id}`, {});
    assert.equal(empty.status, 400);
    // Keeping its own name is not a duplicate.
    const same = await call('PUT', `/api/admin/categories/${gravel._id}`, { nameEn: 'GRAVEL & AGGREGATES' });
    assert.equal(same.status, 200);
  });

  it('deactivates and reactivates a category', async () => {
    const cement = await Category.findOne({ nameEn: 'Cement' });
    const off = await call('PUT', `/api/admin/categories/${cement._id}`, { isActive: false });
    assert.equal(off.body.data.isActive, false);
    const on = await call('PUT', `/api/admin/categories/${cement._id}`, { isActive: true });
    assert.equal(on.body.data.isActive, true);
  });

  it('refuses to delete a category that still has products', async () => {
    const cement = await Category.findOne({ nameEn: 'Cement' });
    const res = await call('DELETE', `/api/admin/categories/${cement._id}`);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /still has 2 products/);
    assert.ok(await Category.exists({ _id: cement._id }));
  });

  it('deletes an empty category', async () => {
    const gravel = await Category.findOne({ nameHi: 'गिट्टी' });
    const res = await call('DELETE', `/api/admin/categories/${gravel._id}`);
    assert.equal(res.status, 200);
    assert.equal(await Category.exists({ _id: gravel._id }), null);
    const again = await call('DELETE', `/api/admin/categories/${gravel._id}`);
    assert.equal(again.status, 404);
  });

  it('answers 404 for unknown or malformed ids', async () => {
    assert.equal((await call('PUT', '/api/admin/categories/64b000000000000000000000', { nameEn: 'X' })).status, 404);
    assert.equal((await call('PUT', '/api/admin/categories/not-an-id', { nameEn: 'X' })).status, 404);
    assert.equal((await call('DELETE', '/api/admin/categories/not-an-id')).status, 404);
  });
});
