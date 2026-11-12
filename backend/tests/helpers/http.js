import { once } from 'node:events';
import { createApp } from '../../app.js';
import { Admin } from '../../models/index.js';
import { signToken } from '../../services/auth.service.js';

/** Starts the real Express app on a random free port. */
export async function startApi() {
  const server = createApp().listen(0);
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Small fetch wrapper: JSON or FormData bodies, optional Bearer token, parsed JSON reply. */
export function client(baseUrl, token) {
  return async function call(method, path, body) {
    const init = { method, headers: token ? { Authorization: `Bearer ${token}` } : {} };
    if (body instanceof FormData) {
      init.body = body;
    } else if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${path}`, init);
    const isJson = res.headers.get('content-type')?.includes('application/json');
    return { status: res.status, body: isJson ? await res.json() : null, headers: res.headers };
  };
}

/** Creates an admin in the test database and returns a valid login token for it. */
export async function createAdminToken(overrides = {}) {
  const admin = await Admin.create({ name: 'Test Owner', email: 'owner@test.local', passwordHash: 'not-used-in-these-tests', ...overrides });
  return { admin, token: signToken(admin) };
}

// A real 1×1 pixel PNG image.
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export function imageForm(buffer, { type = 'image/png', name = 'photo.png', field = 'image' } = {}) {
  const form = new FormData();
  form.append(field, new Blob([buffer], { type }), name);
  return form;
}
