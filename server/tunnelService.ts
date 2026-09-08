import { spawn, execSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { tunnelmole } from 'tunnelmole';

let activePublicUrl: string = '';
let tunnelProcess: ChildProcess | null = null;
let isStarting = false;

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
        '--url',
        `http://127.0.0.1:${port}`
      ]);
      tunnelProcess = proc;

      let resolved = false;

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && !resolved) {
          resolved = true;
          const cfUrl = match[0];
          console.log(`[Tunnel] Cloudflare Tunnel LIVE: ${cfUrl}`);
          resolve(cfUrl);
        }
      };

      proc.stdout.on('data', handleOutput);
      proc.stderr.on('data', handleOutput);

      proc.on('close', (code) => {
        console.log(`[Tunnel] Cloudflare process closed with code ${code}`);
        tunnelProcess = null;
        if (!resolved) {
          resolve(null);
        }
      });

      // 10s timeout to resolve
      setTimeout(() => {
        if (!resolved) {
          console.warn('[Tunnel] Cloudflare startup timeout (10s)');
          resolve(null);
        }
      }, 10000);
    } catch (err: any) {
      console.error('[Tunnel] Error launching Cloudflare tunnel:', err);
      resolve(null);
    }
  });
}

export async function initTunnelAndSyncYemot(port: number = 3000): Promise<string> {
  if (isStarting) return activePublicUrl;
  isStarting = true;

  if (process.env.PUBLIC_URL && process.env.PUBLIC_URL.startsWith('http')) {
    activePublicUrl = process.env.PUBLIC_URL.trim().replace(/\/$/, '');
    console.log(`[Tunnel] Using configured PUBLIC_URL: ${activePublicUrl}`);
    await syncToYemot(activePublicUrl, ['2', '4', '5', '6']);
    isStarting = false;
    return activePublicUrl;
  }

  try {
    const cfUrl = await startCloudflareTunnel(port);
    if (cfUrl && cfUrl.startsWith('http')) {
      activePublicUrl = cfUrl;
      console.log(`[Tunnel] Primary Cloudflare Tunnel LIVE: ${activePublicUrl}`);

      await syncToYemot(activePublicUrl, ['2', '4', '5', '6']);
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
      console.log(`[Tunnel] Tunnelmole LIVE: ${activePublicUrl}`);

      await syncToYemot(activePublicUrl, ['2', '4', '5', '6']);
      isStarting = false;
      return activePublicUrl;
    }
  } catch (tmErr: any) {
    console.warn('[Tunnel] Tunnelmole fallback error:', tmErr?.message);
  }

  isStarting = false;
  return activePublicUrl;
}

export async function syncToYemot(publicUrl: string, extensions: string | string[] = ['2', '4', '5', '6']): Promise<{ success: boolean; message: string }> {
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
    const isAudioRecordingExt = ext === '6';
    const extIniContent = `; הגדרות שלוחה ${ext} - מענה קולי מבוסס AI של ימות המשיח
type=api
api_link=${webhookUrl}
api_phone_send=yes
api_did_send=yes
api_extension_send=yes
api_hangup_send=yes
${isAudioRecordingExt ? 'api_link_send_recording=yes\napi_timeout=35' : 'api_timeout=25'}
`;

    try {
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
      console.log(`[Yemot Sync] Uploaded ext.ini to extension ${ext}:`, uploadData);
      results.push({ ext, success: uploadData?.responseStatus === 'OK' });
    } catch (err: any) {
      console.error(`[Yemot Sync] Error uploading to extension ${ext}:`, err);
      results.push({ ext, success: false });
    }
  }

  const allSuccess = results.every(r => r.success);
  return {
    success: allSuccess,
    message: `שלוחות ${extList.join(', ')} סונכרנו בהצלחה עם הכתובת הציבורית ${webhookUrl}`,
  };
}
