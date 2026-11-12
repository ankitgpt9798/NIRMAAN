import dns from 'node:dns';
import mongoose from 'mongoose';
import { env, PLACEHOLDER_PATTERN } from './env.js';

mongoose.set('strictQuery', true);

/** Throws a readable error when MONGODB_URI is missing or still the example value. */
export function assertMongoUri(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add your MongoDB Atlas connection string to backend/.env (see README → MongoDB Atlas setup).');
  }
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGODB_URI must start with "mongodb+srv://" (Atlas) or "mongodb://".');
  }
  if (PLACEHOLDER_PATTERN.test(uri)) {
    throw new Error('MONGODB_URI still contains placeholder text such as <password>. Replace it with your real Atlas connection string.');
  }
}

/** Host part of the URI only, so credentials never reach the logs. */
export function describeMongoHost(uri = '') {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/);
  return match ? match[1] : 'unknown-host';
}

/** Adds a practical hint for the most common Atlas connection problems. */
export function explainConnectionError(error, { dnsOverridden = env.DNS_SERVERS.length > 0, dnsServers = dns.getServers() } = {}) {
  const message = String(error?.message || error);
  if (/bad auth|authentication failed/i.test(message)) {
    return 'Atlas rejected the username/password. Use the Database User from Atlas → Database Access (not your Atlas login), and URL-encode special characters in the password (e.g. @ → %40).';
  }
  if (/querySrv|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    const servers = dnsServers.join(', ') || 'none';
    if (/ETIMEOUT/i.test(message) && dnsOverridden) {
      return `The DNS servers (${servers}) did not answer in time. The internet connection looks unstable (common on mobile data or a hotspot). Wait a moment and try again.`;
    }
    const tip = dnsOverridden
      ? 'Check your internet connection and the cluster address in MONGODB_URI.'
      : 'Check your internet connection and the cluster address. If "nslookup" works but this fails, set DNS_SERVERS=8.8.8.8,1.1.1.1 in backend/.env.';
    return `The Atlas cluster address could not be looked up (Node.js is using DNS server(s): ${servers}). ${tip}`;
  }
  if (/ECONNRESET|socket hang up|connection .* closed/i.test(message)) {
    return 'The connection to Atlas was interrupted. The internet connection looks unstable; wait a moment and try again.';
  }
  if (/whitelist|IP address|Server selection timed out|ECONNREFUSED|ETIMEDOUT|ReplicaSetNoPrimary/i.test(message)) {
    return 'Atlas did not accept the connection. Add your current IP address in Atlas → Network Access, then wait a minute and retry.';
  }
  return 'Check MONGODB_URI in backend/.env and the cluster status in the Atlas dashboard.';
}

/** Network-level failures worth retrying (not configuration errors like a wrong password). */
export const isLikelyTemporary = (error) =>
  /querySrv ETIMEOUT|EAI_AGAIN|ECONNRESET|ETIMEDOUT|socket hang up|Server selection timed out|connection .* closed|ReplicaSetNoPrimary/i.test(
    String(error?.message || error),
  ) || error?.name === 'MongoNetworkError';

/**
 * Connects to MongoDB. With `attempts` > 1, temporary network failures (DNS
 * timeouts, dropped connections) are retried after `retryDelayMs`; configuration
 * problems such as a wrong password fail immediately.
 */
export async function connectDB({ uri = env.MONGODB_URI, dbName = env.MONGODB_DB_NAME, attempts = 1, retryDelayMs = 5000, onRetry } = {}) {
  assertMongoUri(uri);
  // Affects only Node's own DNS queries (used for the Atlas SRV/TXT records).
  if (env.DNS_SERVERS.length) dns.setServers(env.DNS_SERVERS);

  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        dbName,
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 10,
      });
      return mongoose.connection;
    } catch (error) {
      if (attempt < attempts && isLikelyTemporary(error)) {
        onRetry?.(attempt, error);
        await mongoose.disconnect().catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
      const wrapped = new Error(`Could not connect to MongoDB at ${describeMongoHost(uri)}: ${error.message}\nHint: ${explainConnectionError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}
