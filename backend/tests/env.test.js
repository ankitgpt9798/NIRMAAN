import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../config/env.js';
import { assertMongoUri, describeMongoHost, explainConnectionError, isLikelyTemporary } from '../config/db.js';

const validSecret = 'x'.repeat(40);

describe('environment configuration', () => {
  it('applies safe defaults for local development', () => {
    const env = parseEnv({ JWT_SECRET: validSecret });
    assert.equal(env.NODE_ENV, 'development');
    assert.equal(env.PORT, 5000);
    assert.equal(env.MONGODB_DB_NAME, 'nirmaan_catalogue');
    assert.deepEqual(env.CORS_ORIGINS, ['http://localhost:5173']);
    assert.equal(env.PUBLIC_SITE_URL, 'http://localhost:5173/');
    assert.equal(env.cloudinaryEnabled, false);
  });

  it('rejects a missing, short, or placeholder JWT secret', () => {
    assert.throws(() => parseEnv({}), /JWT_SECRET/);
    assert.throws(() => parseEnv({ JWT_SECRET: 'too-short' }), /at least 32 characters/);
    assert.throws(
      () => parseEnv({ JWT_SECRET: 'CHANGE_ME_to_a_long_random_secret_of_at_least_32_characters' }),
      /placeholder/,
    );
  });

  it('requires CORS_ORIGINS in production', () => {
    assert.throws(() => parseEnv({ NODE_ENV: 'production', JWT_SECRET: validSecret }), /CORS_ORIGINS/);
    const env = parseEnv({
      NODE_ENV: 'production',
      JWT_SECRET: validSecret,
      CORS_ORIGINS: 'https://shop.example.com/, https://www.shop.example.com',
    });
    assert.deepEqual(env.CORS_ORIGINS, ['https://shop.example.com', 'https://www.shop.example.com']);
  });

  it('parses optional DNS servers and rejects non-IP values', () => {
    assert.deepEqual(parseEnv({ JWT_SECRET: validSecret }).DNS_SERVERS, []);
    assert.deepEqual(parseEnv({ JWT_SECRET: validSecret, DNS_SERVERS: '8.8.8.8, 1.1.1.1' }).DNS_SERVERS, ['8.8.8.8', '1.1.1.1']);
    assert.throws(() => parseEnv({ JWT_SECRET: validSecret, DNS_SERVERS: 'dns.google' }), /DNS_SERVERS/);
  });

  it('rejects an invalid public site URL', () => {
    assert.throws(() => parseEnv({ JWT_SECRET: validSecret, PUBLIC_SITE_URL: 'not a url' }), /PUBLIC_SITE_URL/);
    assert.throws(() => parseEnv({ JWT_SECRET: validSecret, PUBLIC_SITE_URL: 'ftp://shop.example.com' }), /PUBLIC_SITE_URL/);
  });

  it('validates the MongoDB connection string without exposing credentials', () => {
    assert.throws(() => assertMongoUri(undefined), /MONGODB_URI is not set/);
    assert.throws(() => assertMongoUri('http://example.com'), /must start with/);
    assert.throws(
      () => assertMongoUri('mongodb+srv://<db_username>:<db_password>@<cluster-address>.mongodb.net/'),
      /placeholder/,
    );
    assert.doesNotThrow(() => assertMongoUri('mongodb+srv://user:pass@cluster0.abc12.mongodb.net/?retryWrites=true'));
    assert.equal(describeMongoHost('mongodb+srv://user:s3cret@cluster0.abc12.mongodb.net/?x=1'), 'cluster0.abc12.mongodb.net');
  });

  it('gives a helpful hint for each kind of connection problem', () => {
    const hint = (message, options) => explainConnectionError(new Error(message), { dnsServers: ['8.8.8.8'], ...options });
    assert.match(hint('bad auth : authentication failed'), /username\/password/);
    assert.match(hint('querySrv ECONNREFUSED _mongodb._tcp.x', { dnsOverridden: false }), /set DNS_SERVERS/);
    assert.match(hint('querySrv ETIMEOUT _mongodb._tcp.x', { dnsOverridden: true }), /did not answer in time.*unstable/);
    assert.doesNotMatch(hint('querySrv ETIMEOUT _mongodb._tcp.x', { dnsOverridden: true }), /set DNS_SERVERS/, 'no advice to set what is already set');
    assert.match(hint('read ECONNRESET'), /interrupted/);
    assert.match(hint('connection <monitor> to 159.41.207.119:27017 closed'), /interrupted/);
    assert.match(hint('Server selection timed out after 15000 ms'), /Network Access/);
  });

  it('retries only network-level connection failures', () => {
    for (const message of ['querySrv ETIMEOUT _mongodb._tcp.x', 'read ECONNRESET', 'connection <monitor> to 1.2.3.4:27017 closed', 'Server selection timed out after 15000 ms']) {
      assert.equal(isLikelyTemporary(new Error(message)), true, message);
    }
    for (const message of ['bad auth : authentication failed', 'Invalid scheme, expected connection string to start with mongodb']) {
      assert.equal(isLikelyTemporary(new Error(message)), false, message);
    }
  });
});

describe('production start-up warnings', async () => {
  const { productionWarnings } = await import('../config/productionChecks.js');
  const production = (overrides = {}) =>
    parseEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(40),
      CORS_ORIGINS: 'https://myshop.vercel.app',
      PUBLIC_SITE_URL: 'https://myshop.vercel.app',
      TRUST_PROXY: '1',
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: '123',
      CLOUDINARY_API_SECRET: 'abc',
      ...overrides,
    });

  it('has nothing to warn about for a correct hosted setup', () => {
    assert.deepEqual(productionWarnings(production()), []);
  });

  it('warns about missing Cloudinary, a non-final QR address, TRUST_PROXY and CORS', () => {
    const warnings = productionWarnings(
      production({ CLOUDINARY_API_SECRET: '', PUBLIC_SITE_URL: 'http://localhost:5173', TRUST_PROXY: '0', CORS_ORIGINS: 'https://other.example.com' }),
    );
    assert.equal(warnings.length, 4);
    assert.match(warnings[0], /Cloudinary is not configured/);
    assert.match(warnings[1], /PUBLIC_SITE_URL .*\(LOCALHOST, NOT_HTTPS\)/);
    assert.match(warnings[2], /TRUST_PROXY/);
    assert.match(warnings[3], /CORS_ORIGINS .* does not include .*localhost:5173/);
  });

  it('stays quiet during development', () => {
    assert.deepEqual(productionWarnings(parseEnv({ JWT_SECRET: 'x'.repeat(40) })), []);
  });
});
