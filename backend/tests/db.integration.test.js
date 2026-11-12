import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Admin, Category, PriceHistory, Product, Shop } from '../models/index.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

// Talks to the real MongoDB Atlas cluster from backend/.env, but only to the
// separate "nirmaan_catalogue_test" database, which is emptied afterwards.

describe('MongoDB Atlas integration', { skip: dbSkipReason }, () => {
  let connection;

  before(async () => {
    connection = await setupTestDb();
  });

  after(() => teardownTestDb(connection));

  it('connects to the dedicated test database', async () => {
    assert.equal(connection.name, 'nirmaan_catalogue_test');
    assert.equal((await connection.db.admin().ping()).ok, 1);
  });

  it('creates the expected indexes', async () => {
    const indexKeys = async (model) => (await model.collection.indexes()).map((index) => JSON.stringify(index.key));
    assert.ok((await indexKeys(Admin)).includes('{"email":1}'));
    assert.ok((await indexKeys(Product)).includes('{"isActive":1,"category":1}'));
    assert.ok((await indexKeys(PriceHistory)).includes('{"product":1,"createdAt":-1}'));
    assert.ok((await indexKeys(Shop)).includes('{"key":1}'));
  });

  it('saves and reads a category with a product (with population)', async () => {
    const category = await Category.create({ nameEn: 'Test Cement', nameHi: 'टेस्ट सीमेंट' });
    const product = await Product.create({
      nameEn: 'Sample Cement (test data)',
      nameHi: 'नमूना सीमेंट (टेस्ट)',
      category: category._id,
      unit: 'bag_50kg',
      sellingPrice: 123.45,
      mrp: 130,
    });
    const loaded = await Product.findById(product._id).populate('category').lean();
    assert.equal(loaded.sellingPrice, 123.45);
    assert.equal(loaded.category.nameHi, 'टेस्ट सीमेंट');
    assert.equal(loaded.nameHi, 'नमूना सीमेंट (टेस्ट)');
  });

  it('stores price history with a server-side timestamp', async () => {
    const startedAt = Date.now();
    const entry = await PriceHistory.create({
      product: new mongoose.Types.ObjectId(),
      previousPrice: 1,
      newPrice: 2,
      updatedBy: new mongoose.Types.ObjectId(),
    });
    assert.ok(entry.createdAt.getTime() >= startedAt - 1000);
  });

  it('enforces unique admin email', async () => {
    await Admin.create({ name: 'Test Owner', email: 'owner@test.local', passwordHash: 'not-a-real-hash' });
    await assert.rejects(
      Admin.create({ name: 'Duplicate', email: 'OWNER@test.local', passwordHash: 'not-a-real-hash' }),
      (error) => error.code === 11000,
    );
    const stored = await Admin.findOne({ email: 'owner@test.local' }).lean();
    assert.equal(stored.passwordHash, undefined, 'passwordHash must not be selected by default');
  });

  it('keeps exactly one shop settings document', async () => {
    const first = await Shop.getSettings();
    const second = await Shop.getSettings();
    assert.equal(String(first._id), String(second._id));
    assert.equal(await Shop.countDocuments(), 1);
  });
});
