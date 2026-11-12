import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_GALLERY_PHOTOS } from '../constants/community.js';
import { GalleryPhoto } from '../models/index.js';
import { TINY_PNG, client, createAdminToken, imageForm, startApi } from './helpers/http.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

// Captions below are clearly labelled sample values for tests only.

const uploadsDir = process.env.UPLOADS_DIR;
const fileForUrl = (url) => path.join(uploadsDir, ...url.replace(/^\/uploads\//, '').split('/'));
const exists = (file) => fs.access(file).then(() => true, () => false);

describe('Photo gallery API', { skip: dbSkipReason }, () => {
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

  it('requires an admin login to manage photos', async () => {
    assert.equal((await anon('GET', '/api/admin/gallery')).status, 401);
    assert.equal((await anon('POST', '/api/admin/gallery', imageForm(TINY_PNG))).status, 401);
    assert.equal((await anon('PUT', '/api/admin/gallery/000000000000000000000000', { captionEn: 'x' })).status, 401);
    assert.equal((await anon('DELETE', '/api/admin/gallery/000000000000000000000000')).status, 401);
  });

  it('starts empty on the website', async () => {
    const res = await anon('GET', '/api/public/gallery');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.items, []);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  });

  it('uploads photos and shows them on the website newest first', async () => {
    const first = await call('POST', '/api/admin/gallery', imageForm(TINY_PNG));
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.match(first.body.data.image.url, /^\/uploads\/gallery\/[a-f0-9]{32}\.png$/);
    assert.ok(await exists(fileForUrl(first.body.data.image.url)));
    assert.equal(first.body.data.captionEn, '');
    const second = await call('POST', '/api/admin/gallery', imageForm(TINY_PNG));

    const site = (await anon('GET', '/api/public/gallery')).body.data.items;
    assert.deepEqual(site.map((photo) => photo.id), [second.body.data.id, first.body.data.id]);
    assert.deepEqual(Object.keys(site[0]).sort(), ['captionEn', 'captionHi', 'id', 'image']);
    assert.equal(site[0].image.publicId, undefined, 'storage ids are never sent');

    const admin = (await call('GET', '/api/admin/gallery')).body.data;
    assert.equal(admin.items.length, 2);
    assert.equal(admin.max, MAX_GALLERY_PHOTOS);
    assert.ok(admin.items[0].createdAt);
  });

  it('saves bilingual captions and validates them', async () => {
    const [photo] = (await call('GET', '/api/admin/gallery')).body.data.items;
    const res = await call('PUT', `/api/admin/gallery/${photo.id}`, { captionHi: ' दुकान का सामने का हिस्सा (नमूना) ', captionEn: 'Shop front (sample)' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.captionHi, 'दुकान का सामने का हिस्सा (नमूना)');
    const site = (await anon('GET', '/api/public/gallery')).body.data.items.find((item) => item.id === photo.id);
    assert.equal(site.captionEn, 'Shop front (sample)');

    const tooLong = await call('PUT', `/api/admin/gallery/${photo.id}`, { captionEn: 'x'.repeat(151) });
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.error.details[0].message, 'Caption (English) must be at most 150 characters');
    assert.equal((await call('PUT', `/api/admin/gallery/${photo.id}`, { image: { url: 'https://evil.example/x.png' } })).status, 400, 'image cannot be replaced by a URL');
    assert.equal((await call('PUT', `/api/admin/gallery/${photo.id}`, {})).status, 400);
    assert.equal((await call('PUT', '/api/admin/gallery/000000000000000000000000', { captionEn: 'x' })).status, 404);
    assert.equal((await call('PUT', '/api/admin/gallery/not-an-id', { captionEn: 'x' })).status, 404);
  });

  it('rejects files that are not real images', async () => {
    const res = await call('POST', '/api/admin/gallery', imageForm(Buffer.from('<svg onload=alert(1)>'), { type: 'image/png' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_IMAGE');
    assert.equal((await call('POST', '/api/admin/gallery', new FormData())).body.error.code, 'IMAGE_REQUIRED');
  });

  it('deletes a photo and its file', async () => {
    const [photo] = (await call('GET', '/api/admin/gallery')).body.data.items;
    const res = await call('DELETE', `/api/admin/gallery/${photo.id}`);
    assert.equal(res.status, 200);
    assert.equal(await exists(fileForUrl(photo.image.url)), false);
    assert.equal((await anon('GET', '/api/public/gallery')).body.data.items.some((item) => item.id === photo.id), false);
    assert.equal((await call('DELETE', `/api/admin/gallery/${photo.id}`)).status, 404);
  });

  it(`holds at most ${MAX_GALLERY_PHOTOS} photos`, async () => {
    const missing = MAX_GALLERY_PHOTOS - (await GalleryPhoto.countDocuments());
    await GalleryPhoto.insertMany(
      Array.from({ length: missing }, (_, n) => ({ image: { url: `/uploads/gallery/sample-${n}.png`, publicId: '', provider: 'local' } })),
    );
    const res = await call('POST', '/api/admin/gallery', imageForm(TINY_PNG));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'GALLERY_FULL');
    assert.equal(await GalleryPhoto.countDocuments(), MAX_GALLERY_PHOTOS);
  });
});
