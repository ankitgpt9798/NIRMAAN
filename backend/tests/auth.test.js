import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { Admin } from '../models/index.js';
import { LOGIN_ATTEMPT_LIMIT } from '../middleware/rateLimiters.js';
import { hashPassword } from '../services/auth.service.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

// End-to-end authentication tests over HTTP against the Atlas *_test database.
// Credentials below exist only inside the throwaway test database.

const OWNER = { name: 'Test Owner', email: 'owner@test.local', password: 'TestOnly-pass123' };
const SECRET = process.env.JWT_SECRET;
const JWT_CLAIMS = { issuer: 'nirmaan-api', audience: 'nirmaan-admin' };

async function startServer() {
  const server = createApp().listen(0);
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

describe('Admin authentication', { skip: dbSkipReason }, () => {
  let connection;
  let api;
  let owner;

  const request = (path, { token, body, method = body ? 'POST' : 'GET' } = {}) =>
    fetch(`${api.url}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  const login = (email = OWNER.email, password = OWNER.password) =>
    request('/api/auth/login', { body: { email, password } });

  before(async () => {
    connection = await setupTestDb();
    owner = await Admin.create({ name: OWNER.name, email: OWNER.email, passwordHash: await hashPassword(OWNER.password) });
  });

  // Fresh app (and fresh rate-limit counters) for every test.
  beforeEach(async () => {
    if (api) await new Promise((resolve) => api.server.close(resolve));
    api = await startServer();
  });

  after(async () => {
    if (api) await new Promise((resolve) => api.server.close(resolve));
    await teardownTestDb(connection);
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials and returns a token', async () => {
      const res = await login();
      assert.equal(res.status, 200);
      const { data } = await res.json();
      assert.ok(data.token);
      assert.ok(Date.parse(data.expiresAt) > Date.now());
      assert.deepEqual(Object.keys(data.admin).sort(), ['email', 'id', 'lastLoginAt', 'name', 'role']);
      assert.equal(data.admin.email, OWNER.email);
      const decoded = jwt.verify(data.token, SECRET, { algorithms: ['HS256'], ...JWT_CLAIMS });
      assert.equal(decoded.sub, String(owner._id));
      assert.equal(decoded.password, undefined);
    });

    it('accepts the email in any letter case and with spaces around it', async () => {
      const res = await login('  OWNER@Test.Local ');
      assert.equal(res.status, 200);
    });

    it('records the last login time', async () => {
      await login();
      const stored = await Admin.findById(owner._id).lean();
      assert.ok(stored.lastLoginAt instanceof Date);
    });

    it('rejects a wrong password and an unknown email with the same message', async () => {
      const wrongPassword = await login(OWNER.email, 'wrong-password-1');
      const unknownEmail = await login('nobody@test.local', OWNER.password);
      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownEmail.status, 401);
      const [a, b] = [await wrongPassword.json(), await unknownEmail.json()];
      assert.equal(a.error.code, 'INVALID_CREDENTIALS');
      assert.deepEqual(a.error, b.error);
    });

    it('validates the request body', async () => {
      const res = await request('/api/auth/login', { body: { email: 'not-an-email' } });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      const fields = body.error.details.map((d) => d.field).sort();
      assert.deepEqual(fields, ['email', 'password']);
    });

    it('rejects non-string values (no query injection)', async () => {
      const res = await request('/api/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } });
      assert.equal(res.status, 400);
    });

    it(`blocks login after ${LOGIN_ATTEMPT_LIMIT} failed attempts`, async () => {
      for (let i = 0; i < LOGIN_ATTEMPT_LIMIT; i += 1) {
        assert.equal((await login(OWNER.email, `wrong-${i}`)).status, 401);
      }
      const blocked = await login(); // even the correct password is refused now
      assert.equal(blocked.status, 429);
      assert.equal((await blocked.json()).error.code, 'TOO_MANY_REQUESTS');
    });

    it('does not count successful logins towards the limit', async () => {
      for (let i = 0; i < LOGIN_ATTEMPT_LIMIT + 2; i += 1) {
        assert.equal((await login()).status, 200);
      }
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the logged-in admin for a valid token', async () => {
      const { data } = await (await login()).json();
      const res = await request('/api/auth/me', { token: data.token });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.admin.email, OWNER.email);
      assert.equal(body.data.admin.passwordHash, undefined);
      assert.equal(body.data.admin.tokenVersion, undefined);
    });

    it('rejects requests without a token', async () => {
      const res = await request('/api/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.headers.get('www-authenticate'), 'Bearer');
      assert.equal((await res.json()).error.code, 'UNAUTHORIZED');
    });

    it('rejects malformed, forged and tampered tokens', async () => {
      const { data } = await (await login()).json();
      const payload = { sub: String(owner._id), role: 'admin', tv: 0 };
      const [header, , signature] = data.token.split('.');
      const tamperedBody = Buffer.from(JSON.stringify({ ...jwt.decode(data.token), role: 'superuser' })).toString('base64url');

      const badTokens = {
        garbage: 'not.a.token',
        'wrong secret': jwt.sign(payload, 'some-other-secret-that-is-long-enough-123', { ...JWT_CLAIMS, expiresIn: '1h' }),
        'alg none': jwt.sign(payload, null, { algorithm: 'none', ...JWT_CLAIMS }),
        'wrong audience': jwt.sign(payload, SECRET, { issuer: JWT_CLAIMS.issuer, audience: 'someone-else', expiresIn: '1h' }),
        tampered: `${header}.${tamperedBody}.${signature}`,
        'unknown admin': jwt.sign({ ...payload, sub: '64b000000000000000000000' }, SECRET, { ...JWT_CLAIMS, expiresIn: '1h' }),
        'invalid id': jwt.sign({ ...payload, sub: 'abc' }, SECRET, { ...JWT_CLAIMS, expiresIn: '1h' }),
      };
      for (const [label, token] of Object.entries(badTokens)) {
        const res = await request('/api/auth/me', { token });
        assert.equal(res.status, 401, label);
      }

      const lowercaseScheme = await fetch(`${api.url}/api/auth/me`, { headers: { Authorization: `bearer ${data.token}` } });
      assert.equal(lowercaseScheme.status, 401);
    });

    it('reports expired tokens clearly', async () => {
      const expired = jwt.sign({ sub: String(owner._id), role: 'admin', tv: 0 }, SECRET, { ...JWT_CLAIMS, expiresIn: -10 });
      const res = await request('/api/auth/me', { token: expired });
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, 'TOKEN_EXPIRED');
    });

    it('signs out existing sessions when the password is reset (tokenVersion)', async () => {
      const { data } = await (await login()).json();
      assert.equal((await request('/api/auth/me', { token: data.token })).status, 200);
      await Admin.updateOne({ _id: owner._id }, { $inc: { tokenVersion: 1 } });
      assert.equal((await request('/api/auth/me', { token: data.token })).status, 401);
      // A fresh login works again with the new version.
      const fresh = await (await login()).json();
      assert.equal((await request('/api/auth/me', { token: fresh.data.token })).status, 200);
    });
  });

  describe('admin API protection', () => {
    it('refuses public access to every /api/admin URL', async () => {
      for (const path of ['/api/admin/products', '/api/admin/dashboard/stats', '/api/admin/anything']) {
        const res = await request(path);
        assert.equal(res.status, 401, path);
      }
      const post = await request('/api/admin/products', { body: { nameEn: 'x' } });
      assert.equal(post.status, 401);
    });

    it('lets an authenticated admin through (unknown routes then return 404)', async () => {
      const { data } = await (await login()).json();
      const res = await request('/api/admin/anything', { token: data.token });
      assert.equal(res.status, 404);
    });

    it('returns 403 for a valid account without the admin role', async () => {
      const viewer = await Admin.collection.insertOne({
        name: 'Viewer',
        email: 'viewer@test.local',
        passwordHash: 'x',
        role: 'viewer',
        tokenVersion: 0,
      });
      const token = jwt.sign({ sub: String(viewer.insertedId), role: 'viewer', tv: 0 }, SECRET, { ...JWT_CLAIMS, expiresIn: '1h' });
      const res = await request('/api/admin/anything', { token });
      assert.equal(res.status, 403);
      await Admin.deleteOne({ _id: viewer.insertedId });
    });
  });

  describe('password storage', () => {
    it('stores only a bcrypt hash, never the password', async () => {
      const stored = await Admin.findById(owner._id).select('+passwordHash').lean();
      assert.match(stored.passwordHash, /^\$2[aby]\$12\$/);
      assert.notEqual(stored.passwordHash, OWNER.password);
      assert.ok(!stored.passwordHash.includes(OWNER.password));
    });
  });
});
