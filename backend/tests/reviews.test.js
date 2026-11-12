import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PENDING_REVIEWS, REVIEW_SUBMIT_LIMIT } from '../constants/community.js';
import { Review } from '../models/index.js';
import { client, createAdminToken, startApi } from './helpers/http.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

// Names and comments below are clearly labelled sample values for tests only.

describe('Customer reviews API', { skip: dbSkipReason }, () => {
  let connection;
  let token;
  let servers = [];

  /** Each server has fresh rate-limit counters, so tests do not use up each other's limit. */
  async function newClients() {
    const api = await startApi();
    servers.push(api);
    return { call: client(api.url, token), anon: client(api.url) };
  }

  before(async () => {
    connection = await setupTestDb();
    ({ token } = await createAdminToken());
  });

  after(async () => {
    await Promise.all(servers.map((api) => api.close()));
    servers = [];
    await teardownTestDb(connection);
  });

  it('accepts a review from the website without login, but does not show it yet', async () => {
    const { anon } = await newClients();
    const res = await anon('POST', '/api/public/reviews', { name: '  Sample Customer ', rating: 5, comment: ' Good service (sample) ' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.data, { status: 'pending' });

    const saved = await Review.findOne().lean();
    assert.equal(saved.name, 'Sample Customer');
    assert.equal(saved.comment, 'Good service (sample)');
    assert.equal(saved.status, 'pending');
    assert.deepEqual(Object.keys(saved).sort(), ['__v', '_id', 'approvedAt', 'comment', 'createdAt', 'name', 'rating', 'status', 'updatedAt'], 'no IP or other personal data stored');

    const site = (await anon('GET', '/api/public/reviews')).body.data;
    assert.deepEqual(site.items, []);
    assert.equal(site.total, 0);
    assert.equal(site.averageRating, null);
  });

  it('validates reviews and never lets a customer approve their own review', async () => {
    const { anon } = await newClients();
    const bad = async (body) => {
      const res = await anon('POST', '/api/public/reviews', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      return res.body.error.details.map((d) => d.message);
    };
    assert.deepEqual(await bad({ name: '   ', rating: 4 }), ['Name is required']);
    assert.deepEqual(await bad({ name: 'A', rating: 0 }), ['Rating must be from 1 to 5 stars']);
    assert.deepEqual(await bad({ name: 'A', rating: 6 }), ['Rating must be from 1 to 5 stars']);
    assert.deepEqual(await bad({ name: 'A', rating: 3.5 }), ['Rating must be a whole number of stars']);
    assert.deepEqual(await bad({ name: 'A', rating: '5' }), ['Rating must be from 1 to 5 stars']);
    assert.deepEqual(await bad({ name: 'x'.repeat(61), rating: 4 }), ['Name must be at most 60 characters']);
    assert.deepEqual(await bad({ name: 'A', rating: 4, comment: 'x'.repeat(501) }), ['Comment must be at most 500 characters']);
    assert.equal((await anon('POST', '/api/public/reviews', { name: 'A', rating: 5, status: 'approved' })).status, 400);
    assert.equal(await Review.countDocuments({ status: 'approved' }), 0);
  });

  it('quietly drops reviews from bots that fill in the hidden field', async () => {
    const { anon } = await newClients();
    const before = await Review.countDocuments();
    const res = await anon('POST', '/api/public/reviews', { name: 'Bot', rating: 5, comment: 'buy now', website: 'http://spam.example' });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.data, { status: 'pending' }, 'same answer as a real review');
    assert.equal(await Review.countDocuments(), before);
  });

  it('limits how many reviews one connection can send per hour', async () => {
    const { anon } = await newClients();
    for (let n = 1; n <= REVIEW_SUBMIT_LIMIT; n += 1) {
      assert.equal((await anon('POST', '/api/public/reviews', { name: `Sample ${n}`, rating: 4 })).status, 201);
    }
    const blocked = await anon('POST', '/api/public/reviews', { name: 'One too many', rating: 4 });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'TOO_MANY_REQUESTS');
    assert.equal((await anon('GET', '/api/public/reviews')).status, 200, 'reading reviews is not limited');
    // Invalid attempts do not use up the limit on a fresh connection.
    const fresh = (await newClients()).anon;
    for (let n = 0; n < REVIEW_SUBMIT_LIMIT + 2; n += 1) await fresh('POST', '/api/public/reviews', { name: '', rating: 4 });
    assert.equal((await fresh('POST', '/api/public/reviews', { name: 'Sample 9', rating: 4 })).status, 201);
    await Review.deleteMany({ name: /^Sample \d$/ });
  });

  it('lets the admin approve, hide and delete reviews; the website shows only approved ones', async () => {
    const { call, anon } = await newClients();
    await anon('POST', '/api/public/reviews', { name: 'Second Sample', rating: 3, comment: 'Okay (sample)' });
    assert.equal((await anon('GET', '/api/admin/reviews')).status, 401);
    assert.equal((await anon('PATCH', '/api/admin/reviews/000000000000000000000000', { status: 'approved' })).status, 401);

    const waiting = (await call('GET', '/api/admin/reviews')).body.data;
    assert.equal(waiting.items.length, 2);
    assert.deepEqual(waiting.counts, { pending: 2, approved: 0 });
    assert.equal(waiting.items[0].name, 'Second Sample', 'newest first');
    assert.equal(waiting.items[0].status, 'pending');
    assert.equal((await call('GET', '/api/admin/dashboard/stats')).body.data.pendingReviews, 2);

    for (const review of waiting.items) {
      const res = await call('PATCH', `/api/admin/reviews/${review.id}`, { status: 'approved' });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'approved');
      assert.ok(res.body.data.approvedAt);
    }
    const site = (await anon('GET', '/api/public/reviews')).body.data;
    assert.equal(site.total, 2);
    assert.equal(site.averageRating, 4); // (5 + 3) / 2
    assert.deepEqual(Object.keys(site.items[0]).sort(), ['comment', 'createdAt', 'id', 'name', 'rating'], 'no status or admin fields');

    const [newest] = site.items;
    await call('PATCH', `/api/admin/reviews/${newest.id}`, { status: 'pending' });
    const afterHide = (await anon('GET', '/api/public/reviews')).body.data;
    assert.deepEqual(afterHide.items.map((r) => r.name), ['Sample Customer']);
    assert.equal(afterHide.averageRating, 5);
    assert.deepEqual((await call('GET', '/api/admin/reviews?status=approved')).body.data.counts, { pending: 1, approved: 1 });

    assert.equal((await call('PATCH', `/api/admin/reviews/${newest.id}`, { status: 'shown' })).status, 400);
    assert.equal((await call('PATCH', `/api/admin/reviews/${newest.id}`, { status: 'approved', rating: 5 })).status, 400, 'the owner cannot change a rating');
    assert.equal((await call('DELETE', `/api/admin/reviews/${newest.id}`)).status, 200);
    assert.equal((await call('DELETE', `/api/admin/reviews/${newest.id}`)).status, 404);
    assert.equal((await call('PATCH', '/api/admin/reviews/not-an-id', { status: 'approved' })).status, 404);
  });

  it('pages approved reviews for the website', async () => {
    const { anon } = await newClients();
    await Review.insertMany(
      Array.from({ length: 12 }, (_, n) => ({ name: `Paged Sample ${n}`, rating: 4, status: 'approved', approvedAt: new Date(), createdAt: new Date(Date.now() - n * 60_000) })),
    );
    const first = (await anon('GET', '/api/public/reviews?limit=5')).body.data;
    assert.equal(first.items.length, 5);
    assert.equal(first.total, 13);
    assert.equal(first.totalPages, 3);
    const last = (await anon('GET', '/api/public/reviews?limit=5&page=3')).body.data;
    assert.equal(last.items.length, 3);
    assert.equal((await anon('GET', '/api/public/reviews?limit=500')).status, 400);
  });

  it(`stops accepting reviews while ${MAX_PENDING_REVIEWS} are waiting, so spam cannot fill the database`, async () => {
    const { anon } = await newClients();
    const waiting = await Review.countDocuments({ status: 'pending' });
    await Review.insertMany(Array.from({ length: MAX_PENDING_REVIEWS - waiting }, (_, n) => ({ name: `Waiting Sample ${n}`, rating: 3 })));
    const res = await anon('POST', '/api/public/reviews', { name: 'Late Sample', rating: 4 });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'REVIEWS_PAUSED');
    assert.equal(await Review.countDocuments({ name: 'Late Sample' }), 0);
  });
});
