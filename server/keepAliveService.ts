/**
 * Self-Pinging Keep-Alive Bot for Cloud Deployments (Render / Cloud Run / VPS)
 * 
 * Prevents Render free-tier instances from spinning down (sleeping) by issuing
 * periodic HTTP health checks. Also allows configuring target Render URLs.
 */

import { getPublicUrl } from './tunnelService';

interface KeepAliveStatus {
  enabled: boolean;
  intervalMinutes: number;
  lastPingTime: number | null;
  lastPingStatus: 'ok' | 'failed' | 'idle';
  lastPingError?: string;
  totalPings: number;
  targetUrls: string[];
}

let keepAliveTimer: NodeJS.Timeout | null = null;

const status: KeepAliveStatus = {
  enabled: true,
  intervalMinutes: 3, // Ping every 3 minutes to prevent Cloudflare/Render/free hosts from idling out
  lastPingTime: null,
  lastPingStatus: 'idle',
  totalPings: 0,
  targetUrls: [],
};

// Auto-discover target URLs from environment if present
if (process.env.RENDER_EXTERNAL_URL) {
  status.targetUrls.push(process.env.RENDER_EXTERNAL_URL.replace(/\/$/, ''));
}
if (process.env.PUBLIC_URL) {
  status.targetUrls.push(process.env.PUBLIC_URL.replace(/\/$/, ''));
}
if (process.env.PUBLIC_WEBHOOK_URL) {
  status.targetUrls.push(process.env.PUBLIC_WEBHOOK_URL.replace(/\/$/, ''));
}

export function registerActiveUrl(url: string) {
  if (!url || !url.startsWith('http')) return;
  const clean = url.trim().replace(/\/$/, '');
  if (!status.targetUrls.includes(clean)) {
    status.targetUrls.unshift(clean); // Prioritize active public URL
  }
}

export function getKeepAliveStatus(): KeepAliveStatus {
  return { ...status };
}

export function updateKeepAliveConfig(config: Partial<{ enabled: boolean; intervalMinutes: number; addUrl: string; removeUrl: string }>) {
  if (config.enabled !== undefined) {
    status.enabled = config.enabled;
  }
  if (config.intervalMinutes !== undefined && config.intervalMinutes >= 1) {
    status.intervalMinutes = config.intervalMinutes;
  }
  if (config.addUrl) {
    const clean = config.addUrl.trim().replace(/\/$/, '');
    if (!status.targetUrls.includes(clean)) {
      status.targetUrls.push(clean);
    }
  }
  if (config.removeUrl) {
    const clean = config.removeUrl.trim().replace(/\/$/, '');
    status.targetUrls = status.targetUrls.filter(u => u !== clean);
  }

  restartTimer();
  return getKeepAliveStatus();
}

export async function pingNow(): Promise<{ success: boolean; results: Array<{ url: string; success: boolean; timeMs: number; error?: string }> }> {
  const urlsToPing = [...status.targetUrls];
  
  // Proactively include current live public tunnel/cloud URL
  const publicUrl = getPublicUrl();
  if (publicUrl && publicUrl.startsWith('http') && !urlsToPing.includes(publicUrl)) {
    urlsToPing.unshift(publicUrl);
  }

  // Always ping local server too
  if (!urlsToPing.some(u => u.includes('localhost') || u.includes('127.0.0.1'))) {
    urlsToPing.push('http://127.0.0.1:3000');
  }

  const results: Array<{ url: string; success: boolean; timeMs: number; error?: string }> = [];
  let anySuccess = false;

  for (const baseUrl of urlsToPing) {
    const startTime = Date.now();
    const pingTarget = `${baseUrl}/api/health`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(pingTarget, {
        method: 'GET',
        headers: { 'User-Agent': 'KeepAlive-Bot/1.0 (Render 24/7 pinger)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const elapsed = Date.now() - startTime;
      if (res.ok) {
        results.push({ url: baseUrl, success: true, timeMs: elapsed });
        anySuccess = true;
      } else {
        results.push({ url: baseUrl, success: false, timeMs: elapsed, error: `HTTP ${res.status}` });
      }
    } catch (err: any) {
      results.push({ url: baseUrl, success: false, timeMs: Date.now() - startTime, error: err.message });
    }
  }

  status.lastPingTime = Date.now();
  status.totalPings += 1;
  status.lastPingStatus = anySuccess ? 'ok' : 'failed';
  if (!anySuccess && results.length > 0) {
    status.lastPingError = results.map(r => `${r.url}: ${r.error}`).join('; ');
  } else {
    status.lastPingError = undefined;
  }

  return { success: anySuccess, results };
}

function restartTimer() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  if (status.enabled) {
    const ms = Math.max(1, status.intervalMinutes) * 60 * 1000;
    keepAliveTimer = setInterval(async () => {
      try {
        await pingNow();
        console.log(`[KeepAlive Bot] Ping executed (${status.totalPings} total pings). Status: ${status.lastPingStatus}`);
      } catch (e: any) {
        console.warn('[KeepAlive Bot] Periodic ping error:', e.message);
      }
    }, ms);
  }
}

export function initKeepAliveBot() {
  console.log('[KeepAlive Bot] Initializing background self-pinger (24/7 awake bot)...');
  restartTimer();
  // Fire first ping in 5 seconds
  setTimeout(() => {
    pingNow().catch(() => {});
  }, 5000);
}
