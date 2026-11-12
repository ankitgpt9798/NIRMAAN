import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Shop } from '../models/index.js';
import { TINY_PNG, client, createAdminToken, imageForm, startApi } from './helpers/http.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

// Shop details below are clearly labelled sample values for tests only.

const uploadsDir = process.env.UPLOADS_DIR;
const fileForUrl = (url) => path.join(uploadsDir, ...url.replace(/^\/uploads\//, '').split('/'));
const exists = (file) => fs.access(file).then(() => true, () => false);

describe('Shop Settings API', { skip: dbSkipReason }, () => {
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
    await fs.rm(uploadsDir, { recursive: true, force: true });
  });

  it('requires an admin login', async () => {
    assert.equal((await anon('GET', '/api/admin/shop')).status, 401);
    assert.equal((await anon('PUT', '/api/admin/shop', { nameEn: 'x' })).status, 401);
    assert.equal((await anon('PUT', '/api/admin/shop/logo', imageForm(TINY_PNG))).status, 401);
    assert.equal((await anon('DELETE', '/api/admin/shop/logo')).status, 401);
  });

  it('starts with empty settings', async () => {
    const res = await call('GET', '/api/admin/shop');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.nameEn, '');
    assert.equal(res.body.data.nameHi, '');
    assert.equal(res.body.data.logo, null);
    assert.equal(res.body.data.key, undefined);
    assert.equal(await Shop.countDocuments(), 1);
  });

  it('saves bilingual shop details and shows them on the public website immediately', async () => {
    const details = {
      nameEn: '  Sample Building Materials (test) ',
      nameHi: 'नमूना बिल्डिंग मटेरियल (टेस्ट)',
      phone: '+91 90000 00000',
      whatsapp: '9000000000',
      addressEn: 'Sample Road, Demo Village',
      addressHi: 'नमूना रोड, डेमो गाँव',
      descriptionEn: 'Cement, TMT rod and sand (sample)',
      descriptionHi: 'सीमेंट, सरिया और रेत (नमूना)',
      websiteUrl: 'https://shop.example.com',
    };
    const res = await call('PUT', '/api/admin/shop', details);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.nameEn, 'Sample Building Materials (test)', 'text is trimmed');

    const pub = (await anon('GET', '/api/public/shop')).body.data;
    assert.equal(pub.nameHi, details.nameHi);
    assert.equal(pub.addressHi, details.addressHi);
    assert.equal(pub.descriptionHi, details.descriptionHi);
    assert.equal(pub.phone, details.phone);
    assert.equal(pub.whatsapp, details.whatsapp);
    assert.equal(await Shop.countDocuments(), 1, 'still a single shop record');
  });

  it('changes only the fields that are sent', async () => {
    const res = await call('PUT', '/api/admin/shop', { phone: '' });
    assert.equal(res.body.data.phone, '');
    assert.equal(res.body.data.nameHi, 'नमूना बिल्डिंग मटेरियल (टेस्ट)');
  });

  it('validates shop details', async () => {
    const cases = [
      [{ phone: 'call me' }, 'phone'],
      [{ whatsapp: '12' }, 'whatsapp'],
      [{ websiteUrl: 'shop.example.com' }, 'websiteUrl'],
      [{ websiteUrl: 'javascript:alert(1)' }, 'websiteUrl'],
      [{ nameEn: 'X'.repeat(121) }, 'nameEn'],
      [{ addressHi: 'X'.repeat(301) }, 'addressHi'],
      [{ logo: { url: 'https://evil.example.com/x.png' } }, ''],
      [{}, ''],
    ];
    for (const [body, field] of cases) {
      const res = await call('PUT', '/api/admin/shop', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.ok(res.body.error.details.some((d) => d.field === field), `${JSON.stringify(body)} -> ${JSON.stringify(res.body.error.details)}`);
    }
  });

  it('uploads, replaces and removes the shop logo', async () => {
    const first = await call('PUT', '/api/admin/shop/logo', imageForm(TINY_PNG));
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const firstUrl = first.body.data.logo.url;
    assert.match(firstUrl, /^\/uploads\/shop\/[a-f0-9]{32}\.png$/);
    assert.ok(await exists(fileForUrl(firstUrl)));
    assert.equal((await anon('GET', '/api/public/shop')).body.data.logo.url, firstUrl);

    const second = await call('PUT', '/api/admin/shop/logo', imageForm(TINY_PNG));
    assert.notEqual(second.body.data.logo.url, firstUrl);
    assert.equal(await exists(fileForUrl(firstUrl)), false, 'old logo deleted');

    const removed = await call('DELETE', '/api/admin/shop/logo');
    assert.equal(removed.body.data.logo, null);
    assert.equal(await exists(fileForUrl(second.body.data.logo.url)), false);
    assert.equal((await anon('GET', '/api/public/shop')).body.data.logo, null);
  });

  it('uploads, replaces and removes the big shop photo, separately from the logo', async () => {
    assert.equal((await anon('PUT', '/api/admin/shop/photo', imageForm(TINY_PNG))).status, 401);
    assert.equal((await anon('DELETE', '/api/admin/shop/photo')).status, 401);
    await call('PUT', '/api/admin/shop/logo', imageForm(TINY_PNG));

    const first = await call('PUT', '/api/admin/shop/photo', imageForm(TINY_PNG));
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const firstUrl = first.body.data.photo.url;
    assert.match(firstUrl, /^\/uploads\/shop\/[a-f0-9]{32}\.png$/);
    assert.ok(await exists(fileForUrl(firstUrl)));
    const publicShop = (await anon('GET', '/api/public/shop')).body.data;
    assert.deepEqual(publicShop.photo, { url: firstUrl, provider: 'local' });
    assert.notEqual(publicShop.logo.url, firstUrl, 'logo is kept');

    const second = await call('PUT', '/api/admin/shop/photo', imageForm(TINY_PNG));
    assert.notEqual(second.body.data.photo.url, firstUrl);
    assert.equal(await exists(fileForUrl(firstUrl)), false, 'old photo deleted');

    const removed = await call('DELETE', '/api/admin/shop/photo');
    assert.equal(removed.body.data.photo, null);
    assert.ok(removed.body.data.logo, 'removing the photo keeps the logo');
    assert.equal(await exists(fileForUrl(second.body.data.photo.url)), false);
    assert.equal((await anon('GET', '/api/public/shop')).body.data.photo, null);
    assert.equal((await call('PUT', '/api/admin/shop/photo', imageForm(Buffer.from('not an image at all')))).body.error.code, 'INVALID_IMAGE');
  });

  it('rejects a logo that is not a real image', async () => {
    const res = await call('PUT', '/api/admin/shop/logo', imageForm(Buffer.from('definitely not an image'), { type: 'image/png' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_IMAGE');
  });
});
