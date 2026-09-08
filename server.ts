import express from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { handleYemotRequest, getAudioFromCache, getCallLogs, getSettings, updateSettings } from './server/yemotService';
import { processAudioQuery, processTextQuery } from './server/geminiService';
import { synthesizeHebrewSpeech } from './server/ttsService';
import { storeAudioInCache } from './server/yemotService';
import { initTunnelAndSyncYemot, getPublicUrl, syncToYemot, setPublicUrl } from './server/tunnelService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Helper to determine base URL
  const getBaseUrl = (req: express.Request) => {
    const tunnelUrl = getPublicUrl();
    if (tunnelUrl) {
      return tunnelUrl;
    }
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/$/, '');
    }
    const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    return `${protocol}://${host}`;
  };

  // Tunnel info & manual sync
  app.get('/api/tunnel/info', (req, res) => {
    const publicUrl = getPublicUrl();
    const effectiveBase = getBaseUrl(req);
    res.json({
      publicUrl,
      webhookUrl: `${effectiveBase}/api/yemot/ivr`,
      isTunnelActive: !!publicUrl,
    });
  });

  app.post('/api/tunnel/sync', async (req, res) => {
    try {
      const publicUrl = req.body.url || getPublicUrl() || getBaseUrl(req);
      const extension = req.body.extension || '4';
      if (req.body.url) {
        setPublicUrl(req.body.url);
      }
      const result = await syncToYemot(publicUrl, extension);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Settings endpoints
  app.get('/api/settings', (req, res) => {
    res.json(getSettings());
  });

  app.post('/api/settings', (req, res) => {
    const updated = updateSettings(req.body);
    res.json(updated);
  });

  // Call logs endpoints
  app.get('/api/logs', (req, res) => {
    const logs = getCallLogs();
    res.json(logs);
  });

  // System stats & cost savings
  app.get('/api/stats', (req, res) => {
    const logs = getCallLogs();
    const totalCalls = logs.length;
    const totalDuration = logs.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
    const totalSaved = logs.reduce((acc, curr) => acc + (curr.costSavedUsd || 0.08), 0);
    const totalCost = logs.reduce((acc, curr) => acc + (curr.costEstimateUsd || 0.0004), 0);
    const avgLatency = totalCalls > 0
      ? Math.round(logs.reduce((acc, curr) => acc + (curr.latencyMs || 0), 0) / totalCalls)
      : 0;

    res.json({
      totalCalls,
      totalDurationMinutes: Math.round((totalDuration / 60) * 10) / 10,
      totalSavedUsd: Math.round(totalSaved * 100) / 100,
      totalCostUsd: Math.round(totalCost * 1000) / 1000,
      avgLatencyMs: avgLatency,
      activeModel: getSettings().model,
    });
  });

  // Dynamic Audio File serving for Yemot HaMashiach & client
  app.get('/api/yemot/audio/:filename', (req, res) => {
    const filename = req.params.filename;
    const id = filename.replace(/\.(mp3|wav)$/, '');
    const audioItem = getAudioFromCache(id);

    if (!audioItem) {
      return res.status(404).send('Audio file not found or expired');
    }

    res.setHeader('Content-Type', audioItem.mimeType);
    res.setHeader('Content-Length', audioItem.buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(audioItem.buffer);
  });

  const safeMulter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    upload.any()(req, res, (err) => {
      if (err) {
        console.warn('[Multer Warning] Error parsing form data:', err.message);
      }
      next();
    });
  };

  // Main Yemot HaMashiach Webhook endpoint (handles both GET and POST from IVR)
  const yemotHandler = async (req: express.Request, res: express.Response) => {
    try {
      const queryParams = { ...req.query, ...req.body };
      const baseUrl = getBaseUrl(req);

      const files = (req as any).files as Express.Multer.File[] | undefined;
      let audioBuffer: Buffer | undefined = undefined;
      if (Array.isArray(files) && files.length > 0) {
        audioBuffer = files[0].buffer;
        console.log(`[IVR Webhook] Received audio from field ${files[0].fieldname} (${audioBuffer.length} bytes)`);
      } else if ((req as any).file?.buffer) {
        audioBuffer = (req as any).file.buffer;
        console.log(`[IVR Webhook] Received audio from req.file (${audioBuffer.length} bytes)`);
      }

      const { yemotResponse, contentType } = await handleYemotRequest(queryParams, baseUrl, audioBuffer);

      res.setHeader('Content-Type', contentType);
      res.send(yemotResponse);
    } catch (err: any) {
      console.error('Error handling Yemot request:', err);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send('id_list_message=t-חלה שגיאה זמנית בעוזר הקולי. אנא נסו שוב מאוחר יותר.&hangup');
    }
  };

  app.get('/api/yemot/ivr', yemotHandler);
  app.post('/api/yemot/ivr', safeMulter, yemotHandler);

  // Yemot Remote Auto-Configuration API
  app.post('/api/yemot/remote-sync', async (req, res) => {
    try {
      const username = req.body.username || '0777003161';
      const password = req.body.password || '7003161';
      const apiKey = req.body.apiKey || 'WU1BUElL.apik_WtVEpFUY1BY9hoo6d0tV3g.p2JSowKvsXxrlQNeXfdTVK63hgdh2gYOdBJ6O9YUGik';
      const extension = req.body.extension || '4';
      const baseUrl = getBaseUrl(req);
      const webhookUrl = `${baseUrl}/api/yemot/ivr`;

      let token = apiKey;
      try {
        const loginRes = await fetch(`https://www.call2all.co.il/ym/api/Login?username=${username}&password=${password}`);
        const loginData: any = await loginRes.json();
        if (loginData && loginData.token) {
          token = loginData.token;
        }
      } catch (loginErr) {
        console.warn('Login fallback to API key:', loginErr);
      }

      const extIniContent = `; הגדרות שלוחה ${extension} - מענה קולי מבוסס AI של ימות המשיח
type=api
api_link=${webhookUrl}
api_phone_send=yes
api_did_send=yes
api_extension_send=yes
api_hangup_send=yes
api_timeout=25
`;

      const uploadParams = new URLSearchParams({
        token: token,
        what: `ivr2:/${extension}/ext.ini`,
        contents: extIniContent,
      });

      const uploadRes = await fetch('https://www.call2all.co.il/ym/api/UploadTextFile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: uploadParams.toString(),
      });

      const uploadData: any = await uploadRes.json().catch(async () => ({ text: await uploadRes.text() }));

      // Verify file
      const verifyRes = await fetch(`https://www.call2all.co.il/ym/api/GetTextFile?token=${encodeURIComponent(token)}&what=ivr2:/${extension}/ext.ini`);
      const verifyData: any = await verifyRes.json().catch(() => null);

      res.json({
        success: true,
        message: `שלוחה ${extension} במערכת ${username} עודכנה והוגדרה בהצלחה בימות המשיח!`,
        webhookUrl,
        uploadResult: uploadData,
        verified: verifyData?.responseStatus === 'OK' && verifyData?.file?.exists === true,
        extIniContent,
      });
    } catch (err: any) {
      console.error('Remote sync error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/yemot/remote-status', async (req, res) => {
    try {
      const username = (req.query.username as string) || '0777003161';
      const password = (req.query.password as string) || '7003161';
      const extension = (req.query.extension as string) || '4';

      let token = 'WU1BUElL.apik_WtVEpFUY1BY9hoo6d0tV3g.p2JSowKvsXxrlQNeXfdTVK63hgdh2gYOdBJ6O9YUGik';
      try {
        const loginRes = await fetch(`https://www.call2all.co.il/ym/api/Login?username=${username}&password=${password}`);
        const loginData: any = await loginRes.json();
        if (loginData?.token) {
          token = loginData.token;
        }
      } catch (e) {}

      const verifyRes = await fetch(`https://www.call2all.co.il/ym/api/GetTextFile?token=${encodeURIComponent(token)}&what=ivr2:/${extension}/ext.ini`);
      const verifyData: any = await verifyRes.json().catch(() => null);

      res.json({
        systemNumber: username,
        extension,
        configured: verifyData?.responseStatus === 'OK' && verifyData?.file?.exists === true,
        contents: verifyData?.contents || null,
        mtime: verifyData?.file?.mtime || null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Direct Voice/Text Processing for Interactive Browser Call Simulator
  app.post('/api/voice/process', upload.single('audio'), async (req, res) => {
    try {
      const baseUrl = getBaseUrl(req);
      const settings = getSettings();
      const startTime = Date.now();
      let transcript = '';
      let textResponse = '';

      if (req.file) {
        const mimeType = req.file.mimetype || 'audio/webm';
        const result = await processAudioQuery(
          req.file.buffer,
          mimeType,
          [],
          settings.systemPrompt
        );
        transcript = result.transcript || 'שאלה קולית';
        textResponse = result.textResponse;
      } else if (req.body.text) {
        transcript = req.body.text;
        const result = await processTextQuery(
          req.body.text,
          [],
          settings.systemPrompt
        );
        textResponse = result.textResponse;
      } else {
        return res.status(400).json({ error: 'No audio or text provided' });
      }

      // Generate speech
      const audioBuffer = await synthesizeHebrewSpeech(textResponse, settings.voiceSpeed);
      const audioId = await storeAudioInCache(audioBuffer, 'audio/mp3');
      const audioUrl = `${baseUrl}/api/yemot/audio/${audioId}.mp3`;
      const latency = Date.now() - startTime;

      res.json({
        transcript,
        textResponse,
        audioUrl,
        latencyMs: latency,
      });
    } catch (err: any) {
      console.error('Error processing voice query in simulator:', err);
      res.status(500).json({ error: err.message || 'Processing failed' });
    }
  });

  // TTS standalone generator endpoint
  app.post('/api/tts/speak', async (req, res) => {
    try {
      const text = req.body.text || '';
      const baseUrl = getBaseUrl(req);
      const buffer = await synthesizeHebrewSpeech(text, 1.0);
      const id = await storeAudioInCache(buffer, 'audio/mp3');
      res.json({ audioUrl: `${baseUrl}/api/yemot/audio/${id}.mp3` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Start background public tunnel and sync to Yemot
    initTunnelAndSyncYemot(PORT).catch(console.error);
  });
}

startServer();
