import assert from 'node:assert/strict';
import { env } from '../../config/env.js';
import { assertMongoUri, connectDB, disconnectDB } from '../../config/db.js';
import { Admin, Category, GalleryPhoto, PriceHistory, Product, Review, Shop } from '../../models/index.js';

const MODELS = [Admin, Category, Product, PriceHistory, Shop, GalleryPhoto, Review];

/** Reason to skip database tests, or false when Atlas is configured. */
export const dbSkipReason = (() => {
  try {
    assertMongoUri(env.MONGODB_URI);
    return false;
  } catch (error) {
    return `MongoDB Atlas not configured yet (${error.message.split('.')[0]})`;
  }
})();

async function emptyTestDatabase(db) {
  assert.ok(db.databaseName.endsWith('_test'), `refusing to clean non-test database "${db.databaseName}"`);
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) await db.dropCollection(name);
}

/**
 * Connects to the separate *_test database and starts from an empty state with
 * all indexes built. (Mongoose's automatic init() runs only once per model, so
 * indexes are rebuilt explicitly after emptying.)
 */
export async function setupTestDb() {
  // Retries cover brief network drops (seen on mobile data); real config errors still fail at once.
  const connection = await connectDB({ attempts: 3, retryDelayMs: 3000 });
  assert.equal(connection.name, 'nirmaan_catalogue_test');
  await Promise.all(MODELS.map((model) => model.init()));
  await emptyTestDatabase(connection.db);
  for (const model of MODELS) {
    await model.createCollection();
    await model.syncIndexes();
  }
  return connection;
}

export async function teardownTestDb(connection) {
  if (connection) await emptyTestDatabase(connection.db);
  await disconnectDB();
}
