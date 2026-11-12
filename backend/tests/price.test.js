import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Category, PriceHistory, Product } from '../models/index.js';
import { client, createAdminToken, startApi } from './helpers/http.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

// Prices below are arbitrary sample values for tests only.

describe('Price management API', { skip: dbSkipReason }, () => {
  let connection;
  let api;
  let call;
  let anon;
  let admin;
  let cement;
  let tmt;

  before(async () => {
    connection = await setupTestDb();
    api = await startApi();
    const created = await createAdminToken({ name: 'Sample Owner' });
    admin = created.admin;
    call = client(api.url, created.token);
    anon = client(api.url);
    const category = await Category.create({ nameEn: 'Cement', nameHi: 'सीमेंट' });
    cement = await Product.create({
      nameEn: 'Sample Cement (test)', nameHi: 'नमूना सीमेंट', category: category._id, unit: 'bag_50kg', sellingPrice: 370, mrp: 400,
      priceUpdatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    tmt = await Product.create({ nameEn: 'Sample TMT (test)', category: category._id, unit: 'kg', sellingPrice: 60.5 });
  });

  after(async () => {
    await api?.close();
    await teardownTestDb(connection);
  });

  const patchPrice = (product, body) => call('PATCH', `/api/admin/products/${product._id}/price`, body);

  it('requires an admin login', async () => {
    assert.equal((await anon('PATCH', `/api/admin/products/${cement._id}/price`, { sellingPrice: 1 })).status, 401);
    assert.equal((await anon('GET', '/api/admin/price-history')).status, 401);
    assert.equal((await Product.findById(cement._id).lean()).sellingPrice, 370);
  });

  it('changes the price, records the old and new price with server time and the admin', async () => {
    const startedAt = Date.now();
    const res = await patchPrice(cement, { sellingPrice: 380 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.changed, true);
    assert.equal(res.body.data.previousPrice, 370);
    assert.equal(res.body.data.product.sellingPrice, 380);
    assert.equal(res.body.data.product.mrp, 400, 'MRP untouched when not sent');

    const product = await Product.findById(cement._id).lean();
    assert.equal(product.sellingPrice, 380);
    assert.ok(product.priceUpdatedAt.getTime() >= startedAt - 1000);

    const entries = await PriceHistory.find({ product: cement._id }).lean();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].previousPrice, 370);
    assert.equal(entries[0].newPrice, 380);
    assert.equal(String(entries[0].updatedBy), String(admin._id));
    assert.equal(entries[0].productNameHi, 'नमूना सीमेंट');
    assert.ok(Math.abs(entries[0].createdAt.getTime() - product.priceUpdatedAt.getTime()) < 5000);
  });

  it('shows the new price to customers immediately', async () => {
    const res = await anon('GET', `/api/public/products/${cement._id}`);
    assert.equal(res.body.data.sellingPrice, 380);
    const list = await anon('GET', '/api/public/products');
    assert.equal(new Date(list.body.data.lastUpdated).getTime(), (await Product.findById(cement._id).lean()).priceUpdatedAt.getTime());
  });

  it('does not record history when the price is the same', async () => {
    const before = await Product.findById(cement._id).lean();
    const res = await patchPrice(cement, { sellingPrice: 380 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.changed, false);
    assert.equal(res.body.data.historyEntryId, null);
    assert.equal(await PriceHistory.countDocuments({ product: cement._id }), 1);
    assert.equal((await Product.findById(cement._id).lean()).priceUpdatedAt.getTime(), before.priceUpdatedAt.getTime());
  });

  it('changes only the MRP without a price history entry', async () => {
    const res = await patchPrice(cement, { sellingPrice: 380, mrp: 420 });
    assert.equal(res.body.data.changed, false);
    assert.equal(res.body.data.product.mrp, 420);
    assert.equal(await PriceHistory.countDocuments({ product: cement._id }), 1);
  });

  it('supports paise (2 decimals)', async () => {
    const res = await patchPrice(tmt, { sellingPrice: 62.75 });
    assert.equal(res.body.data.product.sellingPrice, 62.75);
    assert.equal((await PriceHistory.findOne({ product: tmt._id }).lean()).previousPrice, 60.5);
  });

  it('rejects invalid prices and changes nothing', async () => {
    const before = await Product.findById(cement._id).lean();
    const historyBefore = await PriceHistory.countDocuments();
    const cases = [
      [{ sellingPrice: -1 }, 'sellingPrice', /cannot be negative/],
      [{ sellingPrice: '390' }, 'sellingPrice', /must be a number/],
      [{ sellingPrice: 390.123 }, 'sellingPrice', /2 decimal places/],
      [{}, 'sellingPrice', /number/],
      [{ sellingPrice: 390, mrp: 385 }, 'mrp', /lower than the selling price/],
      [{ sellingPrice: 390, mrp: -5 }, 'mrp', /cannot be negative/],
      [{ sellingPrice: 390, updatedBy: '64b000000000000000000000' }, '', /Unrecognized/i],
      [{ sellingPrice: 390, priceUpdatedAt: '2020-01-01' }, '', /Unrecognized/i],
    ];
    for (const [body, field, message] of cases) {
      const res = await patchPrice(cement, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      const detail = res.body.error.details.find((d) => d.field === field);
      assert.ok(detail && message.test(detail.message), `${JSON.stringify(body)} -> ${JSON.stringify(res.body.error)}`);
    }
    const after = await Product.findById(cement._id).lean();
    assert.equal(after.sellingPrice, before.sellingPrice);
    assert.equal(after.mrp, before.mrp);
    assert.equal(await PriceHistory.countDocuments(), historyBefore);
  });

  it('refuses a price above the current MRP unless the MRP is raised too (nothing saved)', async () => {
    const historyBefore = await PriceHistory.countDocuments();
    const tooHigh = await patchPrice(cement, { sellingPrice: 450 });
    assert.equal(tooHigh.status, 400);
    assert.match(tooHigh.body.error.details[0].message, /MRP cannot be lower/);
    assert.equal((await Product.findById(cement._id).lean()).sellingPrice, 380);
    assert.equal(await PriceHistory.countDocuments(), historyBefore, 'the transaction left no history entry');

    const withMrp = await patchPrice(cement, { sellingPrice: 450, mrp: 460 });
    assert.equal(withMrp.status, 200);
    assert.equal(withMrp.body.data.product.mrp, 460);
    await patchPrice(cement, { sellingPrice: 380 }); // back to the previous sample price
  });

  it('refuses to overwrite a price that was changed meanwhile', async () => {
    const stale = await patchPrice(cement, { sellingPrice: 395, expectedPrice: 370 });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'PRICE_CHANGED');
    assert.equal(stale.body.error.details[0].currentPrice, 380);
    assert.equal((await Product.findById(cement._id).lean()).sellingPrice, 380);

    const fresh = await patchPrice(cement, { sellingPrice: 390, expectedPrice: 380 });
    assert.equal(fresh.status, 200);
  });

  it('handles two phones saving at the same moment: one wins, the other is told', async () => {
    const before = await PriceHistory.countDocuments({ product: cement._id });
    const results = await Promise.all([
      patchPrice(cement, { sellingPrice: 400, expectedPrice: 390 }),
      patchPrice(cement, { sellingPrice: 405, expectedPrice: 390 }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409], JSON.stringify(results.map((r) => r.body)));
    assert.equal(await PriceHistory.countDocuments({ product: cement._id }), before + 1);
    const winner = results.find((r) => r.status === 200).body.data.product.sellingPrice;
    assert.equal((await Product.findById(cement._id).lean()).sellingPrice, winner);
  });

  it('answers 404 for unknown or malformed product ids', async () => {
    assert.equal((await call('PATCH', '/api/admin/products/64b000000000000000000000/price', { sellingPrice: 1 })).status, 404);
    assert.equal((await call('PATCH', '/api/admin/products/not-an-id/price', { sellingPrice: 1 })).status, 404);
  });

  it('lists price history newest first with differences and who changed it', async () => {
    const res = await call('GET', '/api/admin/price-history');
    assert.equal(res.status, 200);
    const { items, total } = res.body.data;
    assert.equal(total, await PriceHistory.countDocuments());
    const times = items.map((i) => new Date(i.createdAt).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a), 'newest first');

    const first = items.find((i) => i.previousPrice === 370 && i.newPrice === 380);
    assert.equal(first.difference, 10);
    assert.equal(first.percentChange, 2.7);
    assert.equal(first.updatedBy.name, 'Sample Owner');
    assert.equal(first.product.nameEn, 'Sample Cement (test)');
    assert.equal(first.product.deleted, false);
    const paise = items.find((i) => i.previousPrice === 60.5);
    assert.equal(paise.difference, 2.25);
  });

  it('filters history by product, searches by name and pages', async () => {
    const byProduct = await call('GET', `/api/admin/price-history?product=${tmt._id}`);
    assert.deepEqual(byProduct.body.data.items.map((i) => i.newPrice), [62.75]);
    const byHindi = await call('GET', `/api/admin/price-history?search=${encodeURIComponent('नमूना सीमेंट')}`);
    assert.ok(byHindi.body.data.items.length >= 3);
    assert.ok(byHindi.body.data.items.every((i) => i.product.id === String(cement._id)));
    const page = await call('GET', '/api/admin/price-history?limit=2&page=1');
    assert.equal(page.body.data.items.length, 2);
    assert.ok(page.body.data.totalPages >= 2);
    assert.equal((await call('GET', '/api/admin/price-history?product=abc')).status, 400);
  });

  it('keeps history readable after the product is deleted', async () => {
    assert.equal((await call('DELETE', `/api/admin/products/${tmt._id}`)).status, 200);
    const res = await call('GET', `/api/admin/price-history?product=${tmt._id}`);
    assert.equal(res.body.data.items.length, 1);
    assert.equal(res.body.data.items[0].product.deleted, true);
    assert.equal(res.body.data.items[0].product.nameEn, 'Sample TMT (test)');
  });

  it('shows the latest price changes on the dashboard', async () => {
    const res = await call('GET', '/api/admin/dashboard/stats');
    const recent = res.body.data.recentPriceUpdates;
    assert.ok(recent.length > 0 && recent.length <= 5);
    const latest = (await call('GET', '/api/admin/price-history?limit=1')).body.data.items[0];
    assert.equal(recent[0].id, latest.id);
    assert.equal(recent[0].updatedBy, 'Sample Owner');
  });

  it('changing availability never creates price history', async () => {
    const before = await PriceHistory.countDocuments();
    await call('PUT', `/api/admin/products/${cement._id}`, { availability: 'out_of_stock' });
    await call('PUT', `/api/admin/products/${cement._id}`, { availability: 'in_stock' });
    assert.equal(await PriceHistory.countDocuments(), before);
  });
});
