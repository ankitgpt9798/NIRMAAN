import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../app.js';

// HTTP-level checks of the Express setup. No database connection is opened here,
// so the health endpoint is expected to report the database as disconnected.

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

describe('Express app', () => {
  it('GET /api/health reports status as JSON', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 503);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.equal(body.data.database, 'disconnected');
    assert.ok(body.data.time);
  });

  it('returns a consistent JSON error for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken": ',
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'INVALID_JSON');
  });

  it('rejects request bodies larger than 100kb', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'x'.repeat(120 * 1024) }),
    });
    assert.equal(res.status, 413);
  });

  it('sends security headers and hides the framework', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-security-policy'));
    assert.ok(res.headers.get('strict-transport-security'));
  });

  it('allows the configured frontend origin and refuses others', async () => {
    const allowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const blocked = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://evil.example.com' } });
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  });

  it('sends rate-limit headers on API responses', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.ok(res.headers.get('ratelimit-policy') || res.headers.get('ratelimit'));
  });
});
