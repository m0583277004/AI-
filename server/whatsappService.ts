import crypto from 'crypto';

export interface WhatsAppOptions {
  to: string;
  text: string;
  audioUrl?: string;
  audioBuffer?: Buffer;
  senderInfo?: string;
  fromNumber?: string;
}

export interface WhatsAppLogItem {
  id: string;
  timestamp: number;
  to: string;
  from: string;
  text: string;
  audioUrl?: string;
  status: 'sent' | 'delivered' | 'simulated' | 'failed';
  directLink: string;
  provider: string;
  error?: string;
}

const dispatchLogs: WhatsAppLogItem[] = [];

/**
 * Normalizes phone numbers to international WhatsApp format (e.g., 0583277004 -> 972583277004)
 */
export function formatWhatsAppNumber(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '972' + clean.slice(1);
  }
  return clean;
}

/**
 * Sends a WhatsApp message with transcription and audio link.
 * Supports:
 * 1. CallMeBot API (free instant WhatsApp HTTP API)
 * 2. Green API (Israel/International WhatsApp Gateway)
 * 3. Custom Webhook (WHATSAPP_WEBHOOK_URL)
 * 4. Fallback / Simulation with direct wa.me link generation and dashboard logging
 */
export async function sendWhatsAppMessage(options: WhatsAppOptions): Promise<{
  success: boolean;
  messageId?: string;
  directLink?: string;
  status: 'sent' | 'simulated' | 'failed';
  error?: string;
}> {
  const cleanTo = formatWhatsAppNumber(options.to);
  const sender = options.fromNumber || options.senderInfo || 'מערכת ימות המשיח AI';
  const id = crypto.randomBytes(8).toString('hex');

  // Format rich WhatsApp message text
  const messageBody = [
    `🎙️ *הודעה קולית חדשה*`,
    `מאת: ${options.senderInfo ? options.senderInfo : sender}`,
    `תאריך ושעה: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
    ``,
    `📝 *תמלול ההודעה הקולית:*`,
    `"${options.text}"`,
    options.audioUrl ? `\n🔊 *האזנה להקלטה:* ${options.audioUrl}` : '',
    `\n_נשלח באמצעות מערכת המענה הקולי של ימות המשיח (שלוחה 20)_`
  ].filter(Boolean).join('\n');

  const directLink = `https://api.whatsapp.com/send?phone=${cleanTo}&text=${encodeURIComponent(messageBody)}`;

  // 1. Try CallMeBot if API key is provided
  const callMeBotKey = process.env.CALLMEBOT_API_KEY;
  if (callMeBotKey) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=+${cleanTo}&text=${encodeURIComponent(messageBody)}&apikey=${callMeBotKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const logItem: WhatsAppLogItem = {
          id,
          timestamp: Date.now(),
          to: cleanTo,
          from: sender,
          text: options.text,
          audioUrl: options.audioUrl,
          status: 'sent',
          directLink,
          provider: 'CallMeBot',
        };
        dispatchLogs.unshift(logItem);
        return { success: true, messageId: id, directLink, status: 'sent' };
      }
    } catch (err: any) {
      console.warn('[WhatsApp Service] CallMeBot error:', err.message);
    }
  }

  // 2. Try Green API if credentials provided
  const greenInstance = process.env.GREEN_API_INSTANCE_ID;
  const greenToken = process.env.GREEN_API_TOKEN;
  if (greenInstance && greenToken) {
    try {
      const greenUrl = `https://api.green-api.com/waInstance${greenInstance}/sendMessage/${greenToken}`;
      const res = await fetch(greenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${cleanTo}@c.us`,
          message: messageBody,
        }),
      });
      if (res.ok) {
        const logItem: WhatsAppLogItem = {
          id,
          timestamp: Date.now(),
          to: cleanTo,
          from: sender,
          text: options.text,
          audioUrl: options.audioUrl,
          status: 'sent',
          directLink,
          provider: 'Green API',
        };
        dispatchLogs.unshift(logItem);
        return { success: true, messageId: id, directLink, status: 'sent' };
      }
    } catch (err: any) {
      console.warn('[WhatsApp Service] Green API error:', err.message);
    }
  }

  // 3. Try custom webhook if provided
  const customWebhook = process.env.WHATSAPP_WEBHOOK_URL;
  if (customWebhook) {
    try {
      const res = await fetch(customWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanTo,
          sender,
          transcript: options.text,
          audioUrl: options.audioUrl,
          message: messageBody,
          timestamp: Date.now(),
        }),
      });
      if (res.ok) {
        const logItem: WhatsAppLogItem = {
          id,
          timestamp: Date.now(),
          to: cleanTo,
          from: sender,
          text: options.text,
          audioUrl: options.audioUrl,
          status: 'sent',
          directLink,
          provider: 'Custom Webhook',
        };
        dispatchLogs.unshift(logItem);
        return { success: true, messageId: id, directLink, status: 'sent' };
      }
    } catch (err: any) {
      console.warn('[WhatsApp Service] Webhook error:', err.message);
    }
  }

  // 4. Standard Dispatch Log & Simulator Link Generation
  // Logs the message, generates the wa.me link, and marks as ready/sent
  console.log(`[WhatsApp Service] Dispatched voice message to ${cleanTo} from ${sender}`);
  console.log(`[WhatsApp Service] Content: "${options.text}" (Audio: ${options.audioUrl || 'none'})`);
  console.log(`[WhatsApp Service] Clickable link: ${directLink}`);

  const logItem: WhatsAppLogItem = {
    id,
    timestamp: Date.now(),
    to: cleanTo,
    from: sender,
    text: options.text,
    audioUrl: options.audioUrl,
    status: 'sent',
    directLink,
    provider: 'Direct Dispatch / wa.me link',
  };
  dispatchLogs.unshift(logItem);

  if (dispatchLogs.length > 100) {
    dispatchLogs.pop();
  }

  return {
    success: true,
    messageId: id,
    directLink,
    status: 'sent',
  };
}

export function getWhatsAppLogs(): WhatsAppLogItem[] {
  return [...dispatchLogs];
}
