import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Admin, Category, PriceHistory, Product, Shop } from '../models/index.js';

// Schema validation only - no database connection is needed for these tests.

const categoryId = new mongoose.Types.ObjectId();
const validProduct = (overrides = {}) => ({
  nameEn: 'Demo Cement (sample)',
  nameHi: 'डेमो सीमेंट (नमूना)',
  category: categoryId,
  unit: 'bag_50kg',
  sellingPrice: 100,
  ...overrides,
});

async function validationErrors(doc) {
  try {
    await doc.validate();
    return {};
  } catch (error) {
    assert.ok(error instanceof mongoose.Error.ValidationError, `unexpected error: ${error}`);
    return Object.fromEntries(Object.entries(error.errors).map(([path, err]) => [path, err.message]));
  }
}

describe('Product model', () => {
  it('accepts a valid product and applies defaults', async () => {
    const product = new Product(validProduct());
    assert.deepEqual(await validationErrors(product), {});
    assert.equal(product.availability, 'in_stock');
    assert.equal(product.isActive, true);
    assert.equal(product.mrp, null);
    assert.ok(product.priceUpdatedAt instanceof Date);
  });

  it('supports a different measurement unit per product', async () => {
    for (const unit of ['kg', 'ton', 'tractor', 'brass', 'cft', 'sqft', 'piece']) {
      assert.deepEqual(await validationErrors(new Product(validProduct({ unit }))), {}, unit);
    }
  });

  it('rejects negative prices', async () => {
    const errors = await validationErrors(new Product(validProduct({ sellingPrice: -1, mrp: -5 })));
    assert.match(errors.sellingPrice, /cannot be negative/);
    assert.match(errors.mrp, /cannot be negative/);
  });

  it('rejects a non-numeric selling price', async () => {
    const errors = await validationErrors(new Product(validProduct({ sellingPrice: 'abc' })));
    assert.ok(errors.sellingPrice);
  });

  it('requires a selling price', async () => {
    const errors = await validationErrors(new Product(validProduct({ sellingPrice: undefined })));
    assert.match(errors.sellingPrice, /required/);
  });

  it('accepts paise (2 decimals) but rejects more precision', async () => {
    assert.deepEqual(await validationErrors(new Product(validProduct({ sellingPrice: 380.5, mrp: 399.99 }))), {});
    const errors = await validationErrors(new Product(validProduct({ sellingPrice: 1.005 })));
    assert.match(errors.sellingPrice, /2 decimal places/);
  });

  it('rejects an MRP lower than the selling price, allows equal or higher', async () => {
    const errors = await validationErrors(new Product(validProduct({ sellingPrice: 100, mrp: 90 })));
    assert.match(errors.mrp, /cannot be lower than the selling price/);
    assert.deepEqual(await validationErrors(new Product(validProduct({ sellingPrice: 100, mrp: 100 }))), {});
    assert.deepEqual(await validationErrors(new Product(validProduct({ sellingPrice: 100, mrp: 120 }))), {});
  });

  it('rejects unknown units and availability values', async () => {
    const errors = await validationErrors(new Product(validProduct({ unit: 'per-galaxy', availability: 'maybe' })));
    assert.match(errors.unit, /not supported/);
    assert.match(errors.availability, /not valid/);
  });

  it('requires a name in at least one language and a category', async () => {
    const errors = await validationErrors(new Product(validProduct({ nameEn: '  ', nameHi: '', category: undefined })));
    assert.match(errors.nameEn, /English or Hindi/);
    assert.match(errors.category, /required/);
    assert.deepEqual(await validationErrors(new Product(validProduct({ nameEn: '', nameHi: 'रेत' }))), {});
  });

  it('keeps out-of-stock and unavailable as valid statuses', async () => {
    for (const availability of ['out_of_stock', 'unavailable']) {
      assert.deepEqual(await validationErrors(new Product(validProduct({ availability }))), {});
    }
  });
});

describe('Category model', () => {
  it('requires a name in English or Hindi', async () => {
    assert.match((await validationErrors(new Category({}))).nameEn, /English or Hindi/);
    assert.deepEqual(await validationErrors(new Category({ nameEn: 'Cement', nameHi: 'सीमेंट' })), {});
  });
});

describe('PriceHistory model', () => {
  it('requires product, both prices and the admin who made the change', async () => {
    const errors = await validationErrors(new PriceHistory({}));
    for (const field of ['product', 'previousPrice', 'newPrice', 'updatedBy']) {
      assert.ok(errors[field], `${field} should be required`);
    }
    const entry = new PriceHistory({
      product: new mongoose.Types.ObjectId(),
      previousPrice: 370,
      newPrice: 380,
      updatedBy: new mongoose.Types.ObjectId(),
    });
    assert.deepEqual(await validationErrors(entry), {});
    assert.equal(PriceHistory.schema.path('updatedAt'), undefined, 'history entries are append-only');
  });
});

describe('Admin model', () => {
  it('normalises email and never serialises the password hash', async () => {
    const admin = new Admin({ name: 'Owner', email: '  Owner@Example.COM ', passwordHash: '$2b$12$hash' });
    assert.deepEqual(await validationErrors(admin), {});
    assert.equal(admin.email, 'owner@example.com');
    assert.equal(admin.role, 'admin');
    const json = admin.toJSON();
    assert.equal(json.passwordHash, undefined);
    assert.equal(json.tokenVersion, undefined);
    assert.equal(Admin.schema.path('passwordHash').options.select, false);
  });

  it('rejects invalid email and unknown roles', async () => {
    const errors = await validationErrors(new Admin({ name: 'X', email: 'not-an-email', passwordHash: 'h', role: 'customer' }));
    assert.ok(errors.email);
    assert.ok(errors.role);
  });
});

describe('Shop model', () => {
  it('validates phone numbers and website URL', async () => {
    assert.deepEqual(await validationErrors(new Shop({ phone: '+91 98765-43210', websiteUrl: 'https://shop.example.com' })), {});
    const errors = await validationErrors(new Shop({ phone: 'call me', whatsapp: '12', websiteUrl: 'shop.example.com' }));
    assert.ok(errors.phone);
    assert.ok(errors.whatsapp);
    assert.ok(errors.websiteUrl);
  });
});
