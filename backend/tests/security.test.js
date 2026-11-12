import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { env } from '../config/env.js';
import { createErrorHandler } from '../middleware/errorHandler.js';
import { Category, Product } from '../models/index.js';
import { hashPassword } from '../services/auth.service.js';
import { client, createAdminToken, startApi } from './helpers/http.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

/** Raw GET that keeps the path exactly as written (fetch would normalise "../"). */
function rawGet(baseUrl, rawPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const { hostname, port } = new URL(baseUrl);
    const req = http.request({ hostname, port, path: rawPath, method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('Production error responses', () => {
  it('never reveal internal messages or stack traces', async () => {
    const app = express();
    app.get('/boom', () => {
      throw new Error('internal detail: mongodb+srv://user:secret@cluster/db at line 42');
    });
    app.use(createErrorHandler({ exposeErrors: false, log: false }));
    const server = app.listen(0);
    await once(server, 'listening');
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/boom`);
      assert.equal(res.status, 500);
      const text = await res.text();
      assert.deepEqual(JSON.parse(text), { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
      assert.ok(!/secret|mongodb|line 42|at /i.test(text));
    } finally {
      server.close();
    }
  });
});

describe('Security checks', { skip: dbSkipReason }, () => {
  let connection;
  let api;
  let call;
  let anon;
  let token;

  before(async () => {
    connection = await setupTestDb();
    api = await startApi();
    ({ token } = await createAdminToken({ passwordHash: await hashPassword('Sample-pass123') }));
    call = client(api.url, token);
    anon = client(api.url);
    const category = await Category.create({ nameEn: 'Cement', nameHi: 'सीमेंट' });
    await Product.create({ nameEn: 'Sample Cement (test)', category: category._id, unit: 'bag', sellingPrice: 370 });
    await Product.create({ nameEn: 'Hidden Sample (test)', category: category._id, unit: 'bag', sellingPrice: 1, isActive: false });
  });

  after(async () => {
    await api?.close();
    await teardownTestDb(connection);
  });

  it('ignores MongoDB operators in the address bar (no query injection)', async () => {
    const pub = await anon('GET', '/api/public/products?search[$ne]=x&category[$ne]=x');
    assert.equal(pub.status, 200);
    assert.equal(pub.body.data.total, 1, 'hidden products stay hidden');
    const adminList = await call('GET', '/api/admin/products?status[$ne]=active&search[$regex]=.*');
    assert.equal(adminList.status, 200);
    const history = await call('GET', '/api/admin/price-history?product[$ne]=x');
    assert.equal(history.status, 200);
  });

  it('rejects repeated or malformed query values instead of crashing', async () => {
    assert.equal((await anon('GET', '/api/public/products?search=a&search=b')).status, 400);
    assert.equal((await anon('GET', '/api/public/products?page=-1')).status, 400);
    assert.equal((await anon('GET', '/api/public/products?limit=abc')).status, 400);
  });

  it('rejects operators and unexpected fields in request bodies', async () => {
    const login = await anon('POST', '/api/auth/login', { email: { $gt: '' }, password: { $gt: '' } });
    assert.equal(login.status, 400);
    const category = await call('POST', '/api/admin/categories', { nameEn: { $gt: '' } });
    assert.equal(category.status, 400);
  });

  it('is not affected by prototype pollution attempts', async () => {
    const res = await fetch(`${api.url}/api/admin/categories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{"nameEn":"Polluted (test)","__proto__":{"isAdmin":true},"constructor":{"prototype":{"polluted":true}}}',
    });
    assert.equal(res.status, 400);
    assert.equal({}.isAdmin, undefined);
    assert.equal({}.polluted, undefined);
  });

  it('refuses to serve files outside the uploads folder', async () => {
    for (const path of ['/uploads/../.env', '/uploads/..%2f.env', '/uploads/..%2f..%2fbackend%2f.env', '/uploads/%2e%2e/package.json', '/uploads/.env']) {
      const res = await rawGet(api.url, path);
      assert.ok([400, 403, 404].includes(res.status), `${path} -> ${res.status}`);
      assert.ok(!res.body.includes('JWT_SECRET') && !res.body.includes('MONGODB_URI') && !res.body.includes('"dependencies"'), path);
    }
  });

  it('only accepts the login token in the Authorization header', async () => {
    assert.equal((await anon('GET', `/api/admin/products?token=${token}`)).status, 401);
    const cookie = await rawGet(api.url, '/api/admin/products', { Cookie: `token=${token}` });
    assert.equal(cookie.status, 401);
  });

  it('sends security headers on every kind of response', async () => {
    for (const path of ['/api/public/products', '/api/admin/products', '/api/nope', '/api/health']) {
      const res = await rawGet(api.url, path);
      assert.equal(res.headers['x-content-type-options'], 'nosniff', path);
      assert.ok(res.headers['content-security-policy'], path);
      assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN', path);
      assert.equal(res.headers['x-powered-by'], undefined, path);
      assert.match(res.headers['content-type'] ?? '', /application\/json/, path);
    }
  });

  it('answers browsers from other websites without CORS permission', async () => {
    const res = await fetch(`${api.url}/api/admin/products`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  it('never returns secrets or password data in any API response', async () => {
    const responses = await Promise.all([
      anon('GET', '/api/public/shop'), anon('GET', '/api/public/products'), anon('GET', '/api/public/categories'),
      call('GET', '/api/auth/me'), call('GET', '/api/admin/products'), call('GET', '/api/admin/categories'),
      call('GET', '/api/admin/dashboard/stats'), call('GET', '/api/admin/shop'), call('GET', '/api/admin/qr-code'),
      call('GET', '/api/admin/price-history'), call('GET', '/api/admin/meta'),
      anon('POST', '/api/auth/login', { email: 'owner@test.local', password: 'wrong-pass-1' }),
    ]);
    const all = JSON.stringify(responses.map((r) => r.body));
    const mongoPassword = env.MONGODB_URI?.match(/:\/\/[^:]+:([^@]+)@/)?.[1];
    for (const secret of [env.JWT_SECRET, mongoPassword, env.MONGODB_URI, process.env.CLOUDINARY_API_SECRET].filter(Boolean)) {
      assert.ok(!all.includes(secret), 'a secret value appeared in an API response');
    }
    for (const word of ['passwordHash', 'tokenVersion', '$2a$', '$2b$', '"__v"']) {
      assert.ok(!all.includes(word), `"${word}" appeared in an API response`);
    }
  });
});
