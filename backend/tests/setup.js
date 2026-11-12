/**
 * Loaded before every test file (see the "test" script in package.json).
 * Forces test mode and a separate database so tests never touch real shop data.
 */
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.MONGODB_DB_NAME = 'nirmaan_catalogue_test';
process.env.JWT_SECRET ||= 'test-only-secret-not-used-outside-automated-tests-0123456789';

// Automated tests never upload to the real Cloudinary account: images go to a
// temporary local folder that each test file removes afterwards.
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.UPLOADS_DIR = path.join(os.tmpdir(), `nirmaan-test-uploads-${process.pid}`);
