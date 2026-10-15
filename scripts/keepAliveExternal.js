/**
 * Standalone 24/7 Keep-Alive Worker Script
 * 
 * Can be run on any free VPS, background worker, or computer to keep
 * Yemot HaMashiach extension 6 and the server awake 24/7.
 * 
 * Usage: node scripts/keepAliveExternal.js [TARGET_URL]
 */

const TARGET_URL = process.argv[2] || process.env.TARGET_URL || 'https://peninsula-broader-goals-lone.trycloudflare.com';
const PING_INTERVAL_MS = 3 * 60 * 1000; // Every 3 minutes

console.log(`[Keep-Alive Worker] Starting 24/7 pinger for: ${TARGET_URL}`);
console.log(`[Keep-Alive Worker] Ping interval: ${PING_INTERVAL_MS / 1000} seconds`);

async function ping() {
  const startTime = Date.now();
  try {
    const res = await fetch(`${TARGET_URL.replace(/\/$/, '')}/api/health`, {
      headers: { 'User-Agent': 'External-24-7-KeepAlive/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const elapsed = Date.now() - startTime;
    if (res.ok) {
      console.log(`[${new Date().toISOString()}] Ping OK (${elapsed}ms) - Server is awake!`);
    } else {
      console.warn(`[${new Date().toISOString()}] Ping WARN: HTTP ${res.status} (${elapsed}ms)`);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Ping FAILED (${Date.now() - startTime}ms):`, err.message);
  }
}

// Initial ping
ping();

// Periodic timer
setInterval(ping, PING_INTERVAL_MS);
