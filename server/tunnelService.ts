import { spawn, execSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { tunnelmole } from 'tunnelmole';

let activePublicUrl: string = '';
let lastSyncedUrl: string = '';
let tunnelProcess: ChildProcess | null = null;
let isStarting = false;
let watchdogStarted = false;
let consecutiveHealthFailures = 0;

export function getPublicUrl(): string {
  return activePublicUrl || process.env.PUBLIC_WEBHOOK_URL || '';
}

export function setPublicUrl(url: string) {
  activePublicUrl = url.trim().replace(/\/$/, '');
}

function ensureCloudflaredBinary(): string {
  const binaryPath = path.join(process.cwd(), 'cloudflared');
  if (!fs.existsSync(binaryPath)) {
    console.log('[Tunnel] Downloading cloudflared binary...');
    try {
      execSync('curl -L -s --output cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x cloudflared');
    } catch (e) {
      console.error('[Tunnel] Error downloading cloudflared:', e);
    }
  }
  return binaryPath;
}

function startCloudflareTunnel(port: number = 3000): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const binary = ensureCloudflaredBinary();
      console.log(`[Tunnel] Launching Cloudflare Tunnel on port ${port}...`);

      const proc = spawn(binary, [
        'tunnel',
        '--protocol',
        'http2',
        '--edge-ip-version',
        '4',
        '--no-autoupdate',
        '--url',
        `http://127.0.0.1:${port}`
      ]);
      tunnelProcess = proc;

      let resolved = false;

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
          const cfUrl = match[0];
          activePublicUrl = cfUrl;
          if (!resolved) {
            resolved = true;
            console.log(`[Tunnel] Cloudflare Tunnel LIVE: ${cfUrl}`);
            resolve(cfUrl);
          }
          // If URL changed dynamically, sync Yemot immediately!
          if (cfUrl !== lastSyncedUrl) {
            console.log(`[Tunnel] New tunnel URL detected: ${cfUrl} (was: ${lastSyncedUrl}), syncing Yemot...`);
            syncToYemot(cfUrl, ['4', '6', '7', '8', '9', '10', '12'])
              .then((res) => {
                if (res.success) {
                  lastSyncedUrl = cfUrl;
                  console.log(`[Tunnel] Successfully synced Yemot to ${cfUrl}`);
                }
              })
              .catch((err) => {
                console.error('[Tunnel] Auto-sync to Yemot failed on URL change:', err);
              });
          }
        }
      };

      proc.stdout.on('data', handleOutput);
      proc.stderr.on('data', handleOutput);

      proc.on('close', (code) => {
        console.log(`[Tunnel] Cloudflare process closed with code ${code}. Auto-restarting in 2s...`);
        tunnelProcess = null;
        if (!resolved) {
          resolve(null);
        }
        // Auto-restart cloudflared if it unexpectedly terminates
        setTimeout(() => {
          if (!tunnelProcess) {
            startCloudflareTunnel(port).catch(console.error);
          }
        }, 2000);
      });

      // 25s timeout to resolve
      setTimeout(() => {
        if (!resolved) {
          console.warn('[Tunnel] Cloudflare startup timeout (25s)');
          resolve(null);
        }
      }, 25000);
    } catch (err: any) {
      console.error('[Tunnel] Error launching Cloudflare tunnel:', err);
      resolve(null);
    }
  });
}

/**
 * Checks if Yemot extension 7 currently points to the given public URL.
 */
async function checkYemotExtCurrentUrl(expectedUrl: string): Promise<boolean> {
  const token = 'WU1BUElL.apik_WtVEpFUY1BY9hoo6d0tV3g.p2JSowKvsXxrlQNeXfdTVK63hgdh2gYOdBJ6O9YUGik';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://www.call2all.co.il/ym/api/GetTextFile?token=${encodeURIComponent(token)}&what=ivr2:/7/ext.ini`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data: any = await res.json();
    if (data?.contents && typeof data.contents === 'string') {
      const match = data.contents.match(/api_link=([^\r\n]+)/);
      if (match && match[1]) {
        const currentLink = match[1].trim();
        const expectedWebhook = `${expectedUrl}/api/yemot/ivr`;
        return currentLink === expectedWebhook;
      }
    }
  } catch (err: any) {
    console.warn('[Tunnel Watchdog] Could not verify ext.ini from Yemot:', err.message);
  }
  return false;
}

function startWatchdog(port: number = 3000) {
  if (watchdogStarted) return;
  watchdogStarted = true;

  // Run health check and auto-sync verification every 15 seconds
  setInterval(async () => {
    try {
      if (!tunnelProcess) {
        console.log('[Tunnel Watchdog] Tunnel process dead, restarting...');
        consecutiveHealthFailures = 0;
        await startCloudflareTunnel(port);
        return;
      }

      if (activePublicUrl) {
        // 1. Check local server health and process status
        let localPingOk = false;
        try {
          const localRes = await fetch(`http://127.0.0.1:${port}/api/health`);
          localPingOk = localRes.ok;
        } catch (e) {}

        // If local server is running fine and tunnel process is running, the tunnel is healthy!
        // (Note: trycloudflare.com resolves via public DNS 8.8.8.8, not container internal DNS, so we don't kill the tunnel on public resolve error)
        if (!localPingOk) {
          console.warn('[Tunnel Watchdog] Local server ping failed on port', port);
        }

        // 2. Proactively verify that Yemot ext.ini is actually synced with the active public URL
        const isYemotSynced = await checkYemotExtCurrentUrl(activePublicUrl);
        if (!isYemotSynced) {
          console.log(`[Tunnel Watchdog] Yemot ext.ini is not synced to ${activePublicUrl}. Re-syncing extensions [4, 6, 7, 8, 9, 10, 12]...`);
          const syncRes = await syncToYemot(activePublicUrl, ['4', '6', '7', '8', '9', '10', '12']);
          if (syncRes.success) {
            lastSyncedUrl = activePublicUrl;
            console.log('[Tunnel Watchdog] Extensions synced successfully to Yemot!');
          }
        }
      }
    } catch (err: any) {
      console.error('[Tunnel Watchdog] Error in watchdog tick:', err.message);
    }
  }, 15000);
}

export async function initTunnelAndSyncYemot(port: number = 3000): Promise<string> {
  startWatchdog(port);

  if (isStarting) return activePublicUrl;
  isStarting = true;

  if (process.env.PUBLIC_URL && process.env.PUBLIC_URL.startsWith('http')) {
    activePublicUrl = process.env.PUBLIC_URL.trim().replace(/\/$/, '');
    lastSyncedUrl = activePublicUrl;
    console.log(`[Tunnel] Using configured PUBLIC_URL: ${activePublicUrl}`);
    await syncToYemot(activePublicUrl, ['4', '6', '7', '8', '9', '10', '12']);
    isStarting = false;
    return activePublicUrl;
  }

  try {
    const cfUrl = await startCloudflareTunnel(port);
    if (cfUrl && cfUrl.startsWith('http')) {
      activePublicUrl = cfUrl;
      lastSyncedUrl = cfUrl;
      console.log(`[Tunnel] Primary Cloudflare Tunnel LIVE: ${activePublicUrl}`);

      await syncToYemot(activePublicUrl, ['4', '6', '7', '8', '9', '10', '12']);
      isStarting = false;
      return activePublicUrl;
    }
  } catch (cfErr: any) {
    console.warn('[Tunnel] Cloudflare start issue, falling back to Tunnelmole:', cfErr?.message);
  }

  // Fallback to Tunnelmole
  try {
    console.log(`[Tunnel] Connecting Tunnelmole fallback on port ${port}...`);
    const tmUrl = await tunnelmole({ port });
    if (tmUrl && tmUrl.startsWith('http')) {
      activePublicUrl = tmUrl;
      lastSyncedUrl = tmUrl;
      console.log(`[Tunnel] Tunnelmole LIVE: ${activePublicUrl}`);

      await syncToYemot(activePublicUrl, ['4', '6', '7', '8', '9', '10', '12']);
      isStarting = false;
      return activePublicUrl;
    }
  } catch (tmErr: any) {
    console.warn('[Tunnel] Tunnelmole fallback error:', tmErr?.message);
  }

  isStarting = false;
  return activePublicUrl;
}

export async function syncToYemot(publicUrl: string, extensions: string | string[] = ['4', '6', '7', '8', '9', '10', '12']): Promise<{ success: boolean; message: string }> {
  const username = '0777003161';
  const password = '7003161';
  const apiKey = 'WU1BUElL.apik_WtVEpFUY1BY9hoo6d0tV3g.p2JSowKvsXxrlQNeXfdTVK63hgdh2gYOdBJ6O9YUGik';
  const cleanUrl = publicUrl.trim().replace(/\/$/, '');
  const webhookUrl = `${cleanUrl}/api/yemot/ivr`;

  const extList = Array.isArray(extensions) ? extensions : [extensions];

  let token = apiKey;
  try {
    const loginRes = await fetch(`https://www.call2all.co.il/ym/api/Login?username=${username}&password=${password}`);
    const loginData: any = await loginRes.json();
    if (loginData?.token) {
      token = loginData.token;
    }
  } catch (e) {
    console.warn('[Yemot Sync] Login fallback to apiKey:', e);
  }

  const results = [];
  for (const ext of extList) {
    const isAudioRecordingExt = ['6', '7', '8', '9', '10'].includes(ext);
    const extIniContent = `; הגדרות שלוחה ${ext} - מענה קולי מבוסס AI של ימות המשיח
type=api
api_link=${webhookUrl}
api_phone_send=yes
api_call_id_send=yes
api_did_send=yes
api_extension_send=yes
api_hangup_send=yes
${isAudioRecordingExt ? 'api_link_send_recording=yes\napi_timeout=60\nrecord_ok=no\nrecord_hangup=yes' : 'api_timeout=25'}
`;

    try {
      let uploadSuccess = false;
      const uploadParams = new URLSearchParams({
        token,
        what: `ivr2:/${ext}/ext.ini`,
        contents: extIniContent,
      });

      const uploadRes = await fetch('https://www.call2all.co.il/ym/api/UploadTextFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: uploadParams.toString(),
      });

      const uploadData: any = await uploadRes.json().catch(async () => ({ text: await uploadRes.text() }));
      
      // Verify if file actually exists or if directory needs to be created via UploadFile
      const verifyRes = await fetch(`https://www.call2all.co.il/ym/api/GetTextFile?token=${encodeURIComponent(token)}&what=ivr2:/${ext}/ext.ini`);
      const verifyData: any = await verifyRes.json().catch(() => null);

      if (verifyData?.responseStatus === 'OK' && verifyData?.file?.exists) {
        uploadSuccess = true;
      } else {
        // Fallback to UploadFile (creates directory on the fly in Yemot!)
        const formData = new FormData();
        formData.append('token', token);
        formData.append('path', `ivr2:/${ext}/ext.ini`);
        formData.append('file', new Blob([extIniContent], { type: 'text/plain' }), 'ext.ini');

        const uploadFileRes = await fetch('https://www.call2all.co.il/ym/api/UploadFile', {
          method: 'POST',
          body: formData,
        });
        const uploadFileData: any = await uploadFileRes.json().catch(() => null);
        uploadSuccess = uploadFileData?.responseStatus === 'OK' || uploadFileData?.success === true;
      }

      console.log(`[Yemot Sync] Extension ${ext} sync success: ${uploadSuccess}`);
      results.push({ ext, success: uploadSuccess });
    } catch (err: any) {
      console.error(`[Yemot Sync] Error uploading to extension ${ext}:`, err);
      results.push({ ext, success: false });
    }
  }

  lastSyncedUrl = cleanUrl;
  const allSuccess = results.every(r => r.success);
  return {
    success: allSuccess,
    message: `שלוחות ${extList.join(', ')} סונכרנו בהצלחה עם הכתובת הציבורית ${webhookUrl}`,
  };
}
