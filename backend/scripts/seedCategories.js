/**
 * Creates the four default categories (Cement, TMT Rod, Sand, Other Building Materials).
 * Usage: npm run seed:categories
 *
 * Safe to run more than once: a category whose English name already exists
 * (any letter case) is left untouched, so the owner's edits are never overwritten.
 * No products or prices are created.
 */
import { env } from '../config/env.js';
import { connectDB, describeMongoHost, disconnectDB } from '../config/db.js';
import { DEFAULT_CATEGORIES } from '../constants/catalog.js';
import { Category } from '../models/index.js';

try {
  const connection = await connectDB();
  console.log(`Database: "${connection.name}" on ${describeMongoHost(env.MONGODB_URI)}\n`);

  let created = 0;
  for (const defaults of DEFAULT_CATEGORIES) {
    const existing = await Category.findOne({ nameEn: defaults.nameEn }).collation({ locale: 'en', strength: 2 }).lean();
    if (existing) {
      console.log(`  - ${defaults.nameEn} / ${defaults.nameHi}: already exists, unchanged`);
      continue;
    }
    await Category.create(defaults);
    created += 1;
    console.log(`  + ${defaults.nameEn} / ${defaults.nameHi}: created`);
  }

  console.log(`\nDone. ${created} created, ${DEFAULT_CATEGORIES.length - created} already present.`);
  await disconnectDB();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  await disconnectDB();
}
