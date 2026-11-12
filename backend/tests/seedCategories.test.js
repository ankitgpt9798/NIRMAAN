import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Category } from '../models/index.js';
import { dbSkipReason, setupTestDb, teardownTestDb } from './helpers/testDb.js';

const run = promisify(execFile);
const backendDir = fileURLToPath(new URL('..', import.meta.url));
const seed = () =>
  run(process.execPath, ['--env-file-if-exists=.env', 'scripts/seedCategories.js'], {
    cwd: backendDir,
    env: { ...process.env, NODE_ENV: 'test', MONGODB_DB_NAME: 'nirmaan_catalogue_test' },
  });

describe('seed:categories script', { skip: dbSkipReason }, () => {
  let connection;
  before(async () => {
    connection = await setupTestDb();
  });
  after(() => teardownTestDb(connection));

  it('creates the four default categories in order, with the delivery note on Sand', async () => {
    const { stdout } = await seed();
    assert.match(stdout, /4 created, 0 already present/);
    const categories = await Category.find().sort({ sortOrder: 1 }).lean();
    assert.deepEqual(categories.map((c) => c.nameEn), ['Cement', 'TMT Rod', 'Sand', 'Other Building Materials']);
    assert.ok(categories.every((c) => c.nameHi && c.isActive));
    assert.deepEqual(categories.filter((c) => c.showDeliveryNote).map((c) => c.nameEn), ['Sand']);
  });

  it('is safe to run again and never overwrites the owner’s edits', async () => {
    await Category.updateOne({ nameEn: 'Cement' }, { nameHi: 'सीमेंट (बदला हुआ)', isActive: false });
    const { stdout } = await seed();
    assert.match(stdout, /0 created, 4 already present/);
    assert.equal(await Category.countDocuments(), 4);
    const cement = await Category.findOne({ nameEn: 'Cement' }).lean();
    assert.equal(cement.nameHi, 'सीमेंट (बदला हुआ)');
    assert.equal(cement.isActive, false);
  });
});
