import { env } from './config/env.js';
import { connectDB, describeMongoHost, disconnectDB } from './config/db.js';
import { productionWarnings } from './config/productionChecks.js';
import { createApp } from './app.js';

async function start() {
  for (const warning of productionWarnings(env)) console.warn(`[config] WARNING: ${warning}`);

  try {
    // A few retries so a brief network drop (e.g. mobile hotspot) does not stop the server.
    const connection = await connectDB({
      attempts: 3,
      retryDelayMs: 5000,
      onRetry: (attempt, error) => console.warn(`[db] Connection attempt ${attempt} failed (${error.message.split('\n')[0]}); retrying in 5 s…`),
    });
    console.log(`[db] Connected to MongoDB (${describeMongoHost(env.MONGODB_URI)}), database "${connection.name}"`);
  } catch (error) {
    console.error(`[db] ${error.message}`);
    process.exit(1);
  }

  const server = createApp().listen(env.PORT, () => {
    console.log(`[api] Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
