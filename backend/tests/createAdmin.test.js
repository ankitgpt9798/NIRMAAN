import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { Admin } from '../models/index.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

// Runs the real `create-admin` script as a separate process with answers piped
// to it, against the Atlas *_test database only.

const backendDir = fileURLToPath(new URL('..', import.meta.url));

function runCreateAdmin(answers) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'scripts/createAdmin.js'], {
      cwd: backendDir,
      // Values already in the environment win over backend/.env, so this forces the test database.
      env: { ...process.env, NODE_ENV: 'test', MONGODB_DB_NAME: 'nirmaan_catalogue_test' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
    child.stdin.end(answers.map((line) => `${line}\n`).join(''));
  });
}

describe('create-admin script', { skip: dbSkipReason }, () => {
  let connection;
  const email = 'script-owner@test.local';
  const firstPassword = 'FirstPass123';
  const secondPassword = 'SecondPass456';

  before(async () => {
    connection = await setupTestDb();
  });

  after(() => teardownTestDb(connection));

  it('creates an admin with a hashed password and never prints the password', async () => {
    const { code, output } = await runCreateAdmin([email, 'Script Owner', firstPassword, firstPassword]);
    assert.equal(code, 0, output);
    assert.match(output, /Admin account created/);
    assert.ok(!output.includes(firstPassword), 'password must not appear in output');

    const admin = await Admin.findOne({ email }).select('+passwordHash').lean();
    assert.equal(admin.name, 'Script Owner');
    assert.equal(admin.role, 'admin');
    assert.ok(await bcrypt.compare(firstPassword, admin.passwordHash));
  });

  it('rejects weak passwords and mismatched confirmation without saving', async () => {
    const weak = await runCreateAdmin(['weak@test.local', 'Weak User', 'short', 'onlyletters', '12345678']);
    assert.equal(weak.code, 1);
    assert.match(weak.output, /at least 8 characters/);
    assert.match(weak.output, /letter and one number/);

    const mismatch = await runCreateAdmin([
      'mismatch@test.local', 'Mismatch User',
      'GoodPass123', 'Different123',
      'GoodPass123', 'Different123',
      'GoodPass123', 'Different123',
    ]);
    assert.equal(mismatch.code, 1);
    assert.match(mismatch.output, /do not match/);

    assert.equal(await Admin.countDocuments({ email: { $in: ['weak@test.local', 'mismatch@test.local'] } }), 0);
  });

  it('makes no changes when a reset is not confirmed', async () => {
    const before = await Admin.findOne({ email }).select('+passwordHash').lean();
    const { code, output } = await runCreateAdmin([email, 'no']);
    assert.equal(code, 0);
    assert.match(output, /No changes were made/);
    const afterRun = await Admin.findOne({ email }).select('+passwordHash').lean();
    assert.equal(afterRun.passwordHash, before.passwordHash);
    assert.equal(afterRun.tokenVersion, before.tokenVersion);
  });

  it('resets the password of an existing admin and signs out old sessions', async () => {
    const before = await Admin.findOne({ email }).lean();
    const { code, output } = await runCreateAdmin([email.toUpperCase(), 'yes', secondPassword, secondPassword]);
    assert.equal(code, 0, output);
    assert.match(output, /Password reset/);

    const admin = await Admin.findOne({ email }).select('+passwordHash').lean();
    assert.ok(await bcrypt.compare(secondPassword, admin.passwordHash));
    assert.ok(!(await bcrypt.compare(firstPassword, admin.passwordHash)));
    assert.equal(admin.tokenVersion, before.tokenVersion + 1);
    assert.equal(await Admin.countDocuments({ email }), 1);
  });
});
