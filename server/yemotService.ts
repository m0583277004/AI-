import { CallLog, AssistantSettings } from '../src/types';
import { synthesizeHebrewSpeech } from './ttsService';
import { processAudioQuery, processTextQuery, ConversationMessage } from './geminiService';
import { sendEmailMessage } from './emailService';
import { getProfileForExtension, EXTENSION_PROFILES, ExtensionProfile } from './extensionProfiles';
import { calculateSpitzerLoan, LoanInput } from './loanCalculator';
import crypto from 'crypto';

interface AudioCacheItem {
  id: string;
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
}

// In-memory audio cache for fast serving to Yemot IVR
const audioCache = new Map<string, AudioCacheItem>();

// In-memory caller sessions (keyed by ApiPhone)
interface CallerSession {
  phone: string;
  lastCallId?: string;
  history: ConversationMessage[];
  step: 'WELCOME' | 'RECORDING' | 'PLAYING';
  stepCounter: number;
  lastActive: number;
  loanState?: {
    step: 'ASK_AMOUNT' | 'ASK_INTEREST' | 'ASK_YEARS';
    amount?: number;
    interest?: number;
    years?: number;
  };
}

const sessions = new Map<string, CallerSession>();

// Call logs store
const callLogs: CallLog[] = [];

// Default assistant settings
let currentSettings: AssistantSettings = {
  systemPrompt: `אתה עוזר קולי חכם, אדיב ותמציתי הפועל בשיחת טלפון קולית (עבור משתמשים בטלפונים כשרים ללא אינטרנט).
הנחיות חשובות מאוד למענה בשיחת טלפון:
1. ענה בעברית ברורה, טבעית ומכבדת.
2. מכיוון שהתשובה תושמע כהקלטה קולית בטלפון, ענה בתמציתיות (עד 2-3 משפטים קצרים).
3. אל תשתמש בסימוני טקסט או אימוג'ים אלא בדיבור רציף וקולח.
4. תן מידע מדויק וברור.
5. חשוב: אל תוסיף בסיום שאלות או הצעות המשך כגון "תרצה לשאול עוד משהו?" או "רוצה עוד תרגיל?", כי מערכת הטלפון מקריאה הנחיה משלה בסוף כל תשובה.`,
  welcomeMessage: 'שלום וברוכים הבאים לעוזר הקולי החכם. אנא אמור את שאלתך לאחר הצליל, ולסיום הקש סולמית.',
  noSpeechMessage: 'לא שמענו את שאלתך. אנא אמור את שאלתך לאחר הצליל ולסיום הקש סולמית.',
  farewellMessage: 'תודה שהשתמשת בעוזר הקולי. להתראות!',
  voiceGender: 'male',
  voiceSpeed: 1.0,
  maxTokens: 250,
  temperature: 0.4,
  saveRecordings: true,
  model: 'gemini-3.7-flash',
};

// Clean cache every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of audioCache.entries()) {
    if (now - item.createdAt > 1000 * 60 * 60 * 2) { // 2 hours
      audioCache.delete(id);
    }
  }
}, 1000 * 60 * 30);

export function getSettings(): AssistantSettings {
  return currentSettings;
}

export function updateSettings(newSettings: Partial<AssistantSettings>): AssistantSettings {
  currentSettings = { ...currentSettings, ...newSettings };
  return currentSettings;
}

export function getCallLogs(): CallLog[] {
  return [...callLogs].reverse();
}

export function getAudioFromCache(id: string): AudioCacheItem | undefined {
  return audioCache.get(id);
}

export async function storeAudioInCache(buffer: Buffer, mimeType = 'audio/mp3'): Promise<string> {
  const id = crypto.randomBytes(12).toString('hex');
  audioCache.set(id, {
    id,
    buffer,
    mimeType,
    createdAt: Date.now(),
  });
  return id;
}

function formatYemotText(text: string): string {
  if (!text) return '';
  return text
    // Strip characters that break Yemot IVR command delimiters (. is message delimiter, - is prefix delimiter, & is command delimiter)
    .replace(/[.\-"'&|~`#*_=\\/:]/g, ' ')
    .replace(/[()\[\]{}!?,;]/g, ' ')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let cachedYemotSessionToken: string = '';
let yemotSessionTokenExpiry = 0;

export async function getYemotSessionToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedYemotSessionToken && Date.now() < yemotSessionTokenExpiry) {
    return cachedYemotSessionToken;
  }
  try {
    const res = await fetch('https://www.call2all.co.il/ym/api/Login?username=0777003161&password=7003161');
    const data: any = await res.json();
    if (data && data.token) {
      cachedYemotSessionToken = data.token;
      yemotSessionTokenExpiry = Date.now() + 1000 * 60 * 25; // 25 minutes
      return cachedYemotSessionToken;
    }
  } catch (e) {
    console.error('[Yemot Auth] Failed to fetch session token:', e);
  }
  return 'WU1BUElL.apik_WtVEpFUY1BY9hoo6d0tV3g.p2JSowKvsXxrlQNeXfdTVK63hgdh2gYOdBJ6O9YUGik';
}

export async function uploadYemotAudio(
  extension: string,
  fileName: string,
  audioBuffer: Buffer
): Promise<boolean> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const token = await getYemotSessionToken(attempt === 2);
      const formData = new FormData();
      formData.append('token', token);
      formData.append('path', `ivr2:/${extension}/${fileName}.wav`);
      formData.append('convertAudio', '1');
      formData.append('autoMakeFolder', '1');
      formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), `${fileName}.wav`);

      const resp = await fetch('https://www.call2all.co.il/ym/api/UploadFile', {
        method: 'POST',
        body: formData,
      });
      const resJson: any = await resp.json().catch(() => null);
      if (resJson?.responseStatus === 'OK' || resJson?.success === true) {
        console.log(`[Yemot Audio Upload] Successfully uploaded ${fileName} to ext ${extension} (duration: ${resJson?.duration}s)`);
        return true;
      }
      console.warn(`[Yemot Audio Upload] Attempt ${attempt} note:`, resJson);
    } catch (e) {
      console.error(`[Yemot Audio Upload] Attempt ${attempt} failed for ${fileName}:`, e);
    }
  }
  return false;
}

async function fetchYemotAudio(recordFileParam: string, extension = '6'): Promise<Buffer | null> {
  try {
    if (recordFileParam.startsWith('http://') || recordFileParam.startsWith('https://')) {
      const resp = await fetch(recordFileParam);
      if (resp.ok) {
        return Buffer.from(await resp.arrayBuffer());
      }
    }

    let yemotPath = recordFileParam;
    if (!yemotPath.startsWith('ivr2:')) {
      const clean = yemotPath.replace(/^\//, '');
      if (clean.includes('/')) {
        yemotPath = `ivr2:/${clean}`;
      } else {
        yemotPath = `ivr2:/${extension}/${clean}`;
      }
      if (!yemotPath.endsWith('.wav')) {
        yemotPath += '.wav';
      }
    }

    const token = await getYemotSessionToken();
    const downloadUrl = `https://www.call2all.co.il/ym/api/DownloadFile?token=${encodeURIComponent(token)}&path=${encodeURIComponent(yemotPath)}`;
    const resp = await fetch(downloadUrl);
    if (resp.ok) {
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length > 200) {
        return buf;
      }
    }
  } catch (err) {
    console.error('Error downloading Yemot audio file:', err);
  }
  return null;
}

/**
 * Handles incoming webhook from Yemot HaMashiach.
 * Yemot makes HTTP GET/POST calls with query parameters:
 * ApiPhone, ApiDID, ApiExtension, ApiCallId, etc.
 */
export async function handleYemotRequest(
  queryParams: Record<string, any>,
  baseUrl: string,
  uploadedAudioBuffer?: Buffer
): Promise<{ yemotResponse: string; contentType: string }> {
  const phone = String(queryParams.ApiPhone || queryParams.Phone || 'unknown');
  const callId = String(queryParams.ApiCallId || queryParams.CallId || '');
  const extension = String(queryParams.ApiExtension || '6');
  const hangup = queryParams.hangup === 'yes';
  const profile = getProfileForExtension(extension);
  const isZeroCostAudioMode = ['6', '7', '8', '9', '10'].includes(extension);

  // Helper for generating clean Yemot recording command with zero background beeps and # to finish
  // Parameters according to official Yemot IVR record specification:
  // 1: valName, 2: re_enter ('no'), 3: 'record', 4: path (''), 5: file_name (''),
  // 6: no_confirm_menu ('no' = no confirmation menu, instant finish on # or silence),
  // 7: save_on_hangup ('yes' = save even if caller hangs up), 8: append (''),
  // 9: min_length ('' = completely removes minimum length requirement, fixes 'ההודעה קצרה מדי'),
  // 10: max_length (60 or 90 seconds)
  const getRecordCmd = (fileToPlay: string, varName: string) => {
    const maxSec = extension === '10' ? 90 : 60;
    return `read=${fileToPlay}=${varName},no,record,,,no,yes,,,${maxSec}`;
  };

  // Primary key for the call session: prefer ApiCallId when present (unique per phone call), else phone
  const sessionKey = (callId && callId !== 'unknown' && callId !== 'undefined')
    ? `call_${callId}`
    : `phone_${phone}`;

  // If hangup signal from Yemot
  if (hangup) {
    sessions.delete(sessionKey);
    if (phone !== 'unknown') sessions.delete(`phone_${phone}`);
    return { yemotResponse: 'hangup', contentType: 'text/plain; charset=utf-8' };
  }

  // Get or initialize session for this call
  let session = sessions.get(sessionKey);
  if (!session && phone !== 'unknown') {
    session = sessions.get(`phone_${phone}`);
  }

  // If no existing session or inactive for more than 5 minutes, create a fresh session
  if (!session || (Date.now() - (session.lastActive || 0) > 300000)) {
    session = {
      phone,
      lastCallId: callId,
      history: [],
      step: 'WELCOME',
      stepCounter: 1,
      lastActive: Date.now(),
    };
    sessions.set(sessionKey, session);
    if (phone !== 'unknown') {
      sessions.set(`phone_${phone}`, session);
    }
  }

  session.lastCallId = callId || session.lastCallId;
  session.lastActive = Date.now();

  const startTime = Date.now();

  // Find incoming input parameter matching expected step or latest val_ key
  let currentValParam = queryParams[`val_${session.stepCounter}`];
  if (currentValParam === undefined) {
    const valKeys = Object.keys(queryParams)
      .filter((k) => k.startsWith('val_'))
      .sort((a, b) => {
        const nA = parseInt(a.replace('val_', ''), 10) || 0;
        const nB = parseInt(b.replace('val_', ''), 10) || 0;
        return nB - nA;
      });
    if (valKeys.length > 0) {
      currentValParam = queryParams[valKeys[0]];
    }
  }

  const rawInput = currentValParam !== undefined
    ? currentValParam
    : (queryParams.record_file || queryParams.FileUrl || queryParams.RecordUrl || queryParams.file_name || queryParams.val_1);

  // ==========================================
  // EXTENSION 12: SPITZER LOAN CALCULATOR IVR FLOW
  // ==========================================
  if (extension === '12') {
    if (!session.loanState) {
      session.loanState = { step: 'ASK_AMOUNT' };
    }

    // Step 0: User just entered extension 12 -> ask for Loan Amount
    if (!rawInput && !uploadedAudioBuffer && !queryParams.prompt && !queryParams.text) {
      session.stepCounter = 1;
      session.loanState = { step: 'ASK_AMOUNT' };
      const promptText = formatYemotText('שלום וברוכים הבאים למחשבון שפיצר. אנא הקישו את סכום ההלוואה המבוקש בשקלים ולאחריו סולמית.');
      // read=t-text=val_1,no,Digits,,1,8,7,Sec,#,No,No
      const yemotCmd = `read=t-${promptText}=val_1,no,Digits,,1,9,8,Sec,#,No,No`;
      return { yemotResponse: yemotCmd, contentType: 'text/plain; charset=utf-8' };
    }

    // Support * as decimal point (e.g. 4*5 becomes 4.5)
    const rawClean = String(rawInput || '').replace(/[^0-9.*]/g, '');
    const digitInput = rawClean.replace(/\*/g, '.');
    const currentStep = session.loanState.step;

    if (currentStep === 'ASK_AMOUNT') {
      const amount = parseFloat(digitInput);
      if (!amount || isNaN(amount) || amount <= 0) {
        const errText = formatYemotText('הסכום שהוקש אינו תקין. אנא הקישו שוב את סכום ההלוואה בשקלים ולאחריו סולמית.');
        const yemotCmd = `read=t-${errText}=val_${session.stepCounter + 1},no,Digits,,1,9,8,Sec,#,No,No`;
        session.stepCounter += 1;
        return { yemotResponse: yemotCmd, contentType: 'text/plain; charset=utf-8' };
      }

      session.loanState.amount = amount;
      session.loanState.step = 'ASK_INTEREST';
      session.stepCounter += 1;
      const askInterestText = formatYemotText(`הסכום נקלט: ${amount.toLocaleString('he-IL')} שקלים. כעת, אנא הקישו את הריבית השנתית באחוזים, ולסיום סולמית. לריבית עם נקודה עשרונית הקישו כוכבית, למשל עבור ארבע וחצי אחוז הקישו 4 כוכבית 5 סולמית. לגמ"ח ללא ריבית הקישו 0 סולמית.`);
      const yemotCmd = `read=t-${askInterestText}=val_${session.stepCounter},no,Digits,,1,6,7,Sec,#,No,No`;
      return { yemotResponse: yemotCmd, contentType: 'text/plain; charset=utf-8' };
    }

    if (currentStep === 'ASK_INTEREST') {
      const interest = parseFloat(digitInput);
      if (isNaN(interest) || interest < 0 || interest > 100) {
        const errText = formatYemotText('אחוז הריבית שהוקש אינו תקין. אנא הקישו שוב את הריבית השנתית באחוזים ולאחריה סולמית. לנקודה הקישו כוכבית.');
        const yemotCmd = `read=t-${errText}=val_${session.stepCounter + 1},no,Digits,,1,6,7,Sec,#,No,No`;
        session.stepCounter += 1;
        return { yemotResponse: yemotCmd, contentType: 'text/plain; charset=utf-8' };
      }

      session.loanState.interest = interest;
      session.loanState.step = 'ASK_YEARS';
      session.stepCounter += 1;
      const askYearsText = formatYemotText(`ריבית של ${interest} אחוזים נקלטה. כעת, אנא הקישו את תקופת ההלוואה בשנים, ולסיום סולמית. למשל לעשר שנים הקישו 10 סולמית.`);
      const yemotCmd = `read=t-${askYearsText}=val_${session.stepCounter},no,Digits,,1,4,7,Sec,#,No,No`;
      return { yemotResponse: yemotCmd, contentType: 'text/plain; charset=utf-8' };
    }

    if (currentStep === 'ASK_YEARS') {
      const years = parseFloat(digitInput);
      if (!years || isNaN(years) || years <= 0 || years > 50) {
        const errText = formatYemotText('מספר השנים שהוקש אינו תקין. אנא הקישו את תקופת ההלוואה בשנים בין שנה לחמישים שנה, ולאחריה סולמית.');
        const yemotCmd = `read=t-${errText}=val_${session.stepCounter + 1},no,Digits,,1,4,7,Sec,#,No,No`;
        session.stepCounter += 1;
        return { yemotResponse: yemotCmd, contentType: 'text/plain; charset=utf-8' };
      }

      session.loanState.years = years;

      // Calculate Spitzer Loan!
      const calcResult = calculateSpitzerLoan({
        principal: session.loanState.amount || 100000,
        annualInterest: session.loanState.interest || 0,
        years: years,
      });

      // Log call
      const logItem: CallLog = {
        id: crypto.randomBytes(8).toString('hex'),
        callerPhone: phone,
        callerDid: queryParams.ApiDID,
        callId,
        extension: '12',
        timestamp: Date.now(),
        durationSeconds: Math.round((Date.now() - startTime) / 1000) + 12,
        questionText: `חישוב הלוואה: ${session.loanState.amount?.toLocaleString('he-IL')} ש"ח, ${session.loanState.interest}% ריבית, ${years} שנים`,
        questionAudioUrl: rawInput,
        responseText: calcResult.spokenSummary,
        status: 'completed',
        latencyMs: Date.now() - startTime,
        tokensUsed: 0,
        costEstimateUsd: 0,
        costSavedUsd: 0.16,
      };
      callLogs.push(logItem);

      // Clean session for new calculation if user wants to calculate another
      session.loanState = { step: 'ASK_AMOUNT' };
      session.stepCounter += 1;

      const formattedResultText = formatYemotText(calcResult.spokenSummary);
      const followUp = formatYemotText('לחישוב הלוואה נוספת הקישו את הסכום בשקלים ולאחריו סולמית, או נתקו.');
      const yemotCmd = `id_list_message=t-${formattedResultText}&read=t-${followUp}=val_${session.stepCounter},no,Digits,,1,9,8,Sec,#,No,No`;
      return { yemotResponse: yemotCmd, contentType: 'text/plain; charset=utf-8' };
    }
  }

  // Case 1: The user just entered the extension -> Play welcome message and prompt for question
  if (!rawInput && !uploadedAudioBuffer && !queryParams.prompt && !queryParams.text) {
    session.step = 'RECORDING';
    session.stepCounter = 1;

    if (isZeroCostAudioMode) {
      // Extensions 6, 7, 8, 9, 10: Play pre-uploaded welcome WAV (f-000) and record user voice without STT fees!
      // Plays start beep, silence during recording (zero annoying beeps), finishes on # or silence
      const yemotReadCommand = getRecordCmd('f-000', 'val_1');
      return {
        yemotResponse: yemotReadCommand,
        contentType: 'text/plain; charset=utf-8',
      };
    } else {
      // Other extensions: Text-to-speech greeting
      const welcomeText = formatYemotText(profile.welcomeMessage);
      const yemotReadCommand = `read=t-${welcomeText}=val_1,yes,voice,he-IL,no,,,15,yes`;
      return {
        yemotResponse: yemotReadCommand,
        contentType: 'text/plain; charset=utf-8',
      };
    }
  }

  // Case 2: We received input from user (spoken text from STT or audio recording or manual prompt)
  let audioToProcess: Buffer | null = uploadedAudioBuffer || null;
  let questionTranscript = '';

  if (!audioToProcess && rawInput) {
    const rawStr = String(rawInput).trim();
    // Check if input is likely an audio file reference (url, wav, record prefix, ivr path, or numeric recording index)
    const isAudioFileRef = rawStr.startsWith('http') ||
      rawStr.includes('.wav') ||
      rawStr.startsWith('ivr2:') ||
      rawStr.startsWith('/') ||
      rawStr.toLowerCase().startsWith('record') ||
      /^[a-zA-Z0-9_-]+\.wav$/i.test(rawStr) ||
      (isZeroCostAudioMode && /^\d{1,5}$/.test(rawStr));

    if (isAudioFileRef) {
      audioToProcess = await fetchYemotAudio(rawStr, extension);
    } else if (isZeroCostAudioMode && (rawStr.startsWith('http') || rawStr.includes('.wav') || rawStr.includes('/'))) {
      audioToProcess = await fetchYemotAudio(rawStr, extension);
    } else {
      // Direct text question (Hebrew, prompt, or simulator)
      questionTranscript = rawStr;
    }
  }

  // If explicit text prompt parameter
  if (!audioToProcess && !questionTranscript && (queryParams.prompt || queryParams.text)) {
    questionTranscript = String(queryParams.prompt || queryParams.text).trim();
  }

  let aiResponseText = '';
  let hadAudioQuery = false;

  let emailActionResult: { targetEmail?: string; status?: string; previewUrl?: string | false } | undefined = undefined;

  const queryOptions = {
    systemPrompt: profile.systemPrompt,
    models: profile.models,
    temperature: profile.temperature,
    maxTokens: profile.maxTokens,
    timeoutMs: profile.timeoutMs,
  };

  if (audioToProcess && audioToProcess.length > 0) {
    hadAudioQuery = true;
    // Process audio directly with Gemini (multimodal hearing - 0 STT fee!)
    const geminiResult = await processAudioQuery(
      audioToProcess,
      'audio/wav',
      session.history,
      queryOptions
    );
    aiResponseText = geminiResult.textResponse;
    questionTranscript = geminiResult.transcript || 'שאלה קולית מוקלטת';

    // If caller requested sending email (run safely without blocking the telephony flow)
    if (geminiResult.emailAction?.isEmailRequest && geminiResult.emailAction.targetEmail) {
      const emailTarget = geminiResult.emailAction.targetEmail;
      emailActionResult = {
        targetEmail: emailTarget,
        status: 'sending',
      };
      sendEmailMessage({
        to: emailTarget,
        subject: geminiResult.emailAction.subject || `מידע משיחה קולית (${profile.name}) - ימות המשיח AI`,
        text: geminiResult.emailAction.emailContent || aiResponseText,
        callerPhone: phone,
      })
        .then((res) => {
          if (emailActionResult) {
            emailActionResult.status = res.success ? 'sent' : 'failed';
            emailActionResult.previewUrl = res.previewUrl;
          }
          console.log(`[IVR Action] Email dispatch to ${emailTarget}: ${res.success ? 'SUCCESS' : 'FAILED'}`);
        })
        .catch((err) => {
          console.warn('[IVR Action] Background email error:', err);
        });
    }
  } else if (questionTranscript && questionTranscript.trim() !== '' && !['none', 'null', 'timeout', 'empty'].includes(questionTranscript.toLowerCase())) {
    const geminiResult = await processTextQuery(
      questionTranscript,
      session.history,
      queryOptions
    );
    aiResponseText = geminiResult.textResponse;
  } else {
    // No speech captured or silence
    aiResponseText = profile.noSpeechMessage;
    questionTranscript = '(לא נקלטה שאלה)';
  }

  const isValidSpeech = hadAudioQuery || (
    questionTranscript &&
    questionTranscript.trim() !== '' &&
    !questionTranscript.startsWith('(לא נקלטה') &&
    !['none', 'null', 'timeout', 'empty'].includes(questionTranscript.toLowerCase())
  );

  const isErrorResponse = aiResponseText.includes('חלה שגיאה') || aiResponseText.includes('שגיאה זמנית');

  // Update session history only if valid question was successfully answered
  if (isValidSpeech && !isErrorResponse) {
    session.history.push({ role: 'user', text: questionTranscript });
    session.history.push({ role: 'assistant', text: aiResponseText });
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }
  }

  const latency = Date.now() - startTime;
  const costSaved = isZeroCostAudioMode ? 0.16 : 0.08; // 100% saved on both STT and TTS on ext 6, 7, 8
  const costEstimate = 0.0004;

  const logItem: CallLog = {
    id: crypto.randomBytes(8).toString('hex'),
    callerPhone: phone,
    callerDid: queryParams.ApiDID,
    callId,
    extension,
    timestamp: Date.now(),
    durationSeconds: Math.round(latency / 1000) + 10,
    questionText: questionTranscript,
    questionAudioUrl: rawInput,
    responseText: aiResponseText,
    status: 'completed',
    latencyMs: latency,
    tokensUsed: Math.round((questionTranscript.length + aiResponseText.length) * 1.3),
    costEstimateUsd: costEstimate,
    costSavedUsd: costSaved,
    emailAction: emailActionResult ? {
      targetEmail: emailActionResult.targetEmail || '',
      status: emailActionResult.status || 'sent',
      previewUrl: emailActionResult.previewUrl,
    } : undefined,
  };

  callLogs.push(logItem);

  session.step = 'RECORDING';
  session.stepCounter += 1;

  const nextVarName = `val_${session.stepCounter}`;

  // Extensions 6, 7, 8: 100% Zero-cost Audio Pipeline (TTS generated on server, uploaded as WAV, played with f-)
  if (isZeroCostAudioMode) {
    if (isValidSpeech && !isErrorResponse) {
      try {
        const responseAudioBuffer = await synthesizeHebrewSpeech(aiResponseText, profile.voiceSpeed || currentSettings.voiceSpeed);
        const safeCallId = (callId || phone || String(Date.now())).replace(/[^a-zA-Z0-9_-]/g, '').slice(-10);
        const ansFileName = `ans_${safeCallId}_${session.stepCounter}`;
        
        // Upload synthesized audio file to Yemot extension (6, 7, or 8)
        const uploadOk = await uploadYemotAudio(extension, ansFileName, responseAudioBuffer);
        
        // Store in audio cache for browser simulator
        await storeAudioInCache(responseAudioBuffer, 'audio/wav');

        if (uploadOk) {
          // Yemot command: play uploaded answer file f-ans..., then play followup f-001 and record next question
          const recCmd = getRecordCmd('f-001', nextVarName);
          const yemotCommand = `id_list_message=f-${ansFileName}&${recCmd}`;
          return {
            yemotResponse: yemotCommand,
            contentType: 'text/plain; charset=utf-8',
          };
        } else {
          // Fallback: TTS command so the call NEVER hangs up or plays missing file
          const cleanAi = formatYemotText(aiResponseText);
          const recCmd = getRecordCmd('f-001', nextVarName);
          const yemotCommand = `id_list_message=t-${cleanAi}&${recCmd}`;
          return {
            yemotResponse: yemotCommand,
            contentType: 'text/plain; charset=utf-8',
          };
        }
      } catch (audioErr) {
        console.error(`Failed to generate/upload audio for ext ${extension}:`, audioErr);
        const cleanAi = formatYemotText(aiResponseText);
        const recCmd = getRecordCmd('f-001', nextVarName);
        const yemotCommand = `id_list_message=t-${cleanAi}&${recCmd}`;
        return {
          yemotResponse: yemotCommand,
          contentType: 'text/plain; charset=utf-8',
        };
      }
    } else if (!isValidSpeech) {
      // No speech recorded -> play gentle prompt and record again
      const cleanNoSpeech = formatYemotText(profile.noSpeechMessage);
      const recCmd = getRecordCmd('f-001', nextVarName);
      const yemotCommand = `id_list_message=t-${cleanNoSpeech}&${recCmd}`;
      return {
        yemotResponse: yemotCommand,
        contentType: 'text/plain; charset=utf-8',
      };
    } else {
      // Error response -> apologize and record again
      const cleanErr = formatYemotText('חלה שגיאה זמנית אנא נסו לשאול שוב');
      const recCmd = getRecordCmd('f-001', nextVarName);
      const yemotCommand = `id_list_message=t-${cleanErr}&${recCmd}`;
      return {
        yemotResponse: yemotCommand,
        contentType: 'text/plain; charset=utf-8',
      };
    }
  }

  // Extensions 2, 4, 5: Fast STT/TTS Mode
  if (isValidSpeech) {
    const cleanAiText = formatYemotText(aiResponseText);
    const followUpText = formatYemotText('לשאלה נוספת דברו לאחר הצליל ולסיום הקש סולמית או נתק');

    const yemotCommand = `id_list_message=t-${cleanAiText}&read=t-${followUpText}=${nextVarName},yes,voice,he-IL,no,,,15,yes`;
    return {
      yemotResponse: yemotCommand,
      contentType: 'text/plain; charset=utf-8',
    };
  } else {
    const noSpeechPrompt = formatYemotText(profile.noSpeechMessage);
    const yemotCommand = `read=t-${noSpeechPrompt}=${nextVarName},yes,voice,he-IL,no,,,15,yes`;
    return {
      yemotResponse: yemotCommand,
      contentType: 'text/plain; charset=utf-8',
    };
  }
}
