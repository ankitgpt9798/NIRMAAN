/**
 * Verifies the MongoDB Atlas connection configured in backend/.env.
 * Usage: npm run db:check
 * Read-only: it pings the cluster and lists collections; nothing is changed.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB, describeMongoHost, disconnectDB } from '../config/db.js';

try {
  const connection = await connectDB();
  const ping = await connection.db.admin().ping();
  const collections = (await connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();

  console.log('MongoDB connection OK');
  console.log(`  Host:        ${describeMongoHost(env.MONGODB_URI)}`);
  console.log(`  Database:    ${connection.name}`);
  console.log(`  Ping:        ${ping.ok === 1 ? 'ok' : JSON.stringify(ping)}`);
  console.log(`  Collections: ${collections.length ? collections.join(', ') : '(none yet - created when data is first saved)'}`);
  console.log(`  Driver:      mongoose ${mongoose.version}`);
  await disconnectDB();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
