import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, Mail, MessageSquare, Mic, MicOff, Volume2, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Clock, User, ShieldCheck, ArrowRight } from 'lucide-react';

interface DispatchedMessage {
  id: string;
  timestamp: number;
  channel: 'whatsapp' | 'email';
  to: string;
  from: string;
  transcript: string;
  audioUrl?: string;
  status: 'sent' | 'delivered' | 'simulated' | 'failed';
  directLink?: string;
  previewUrl?: string | false;
}

export const VoiceDispatchViewer: React.FC = () => {
  const [messages, setMessages] = useState<DispatchedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Interactive Tester State
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [destination, setDestination] = useState('0583277004');
  const [senderInfo, setSenderInfo] = useState('0583277004');
  const [textMessage, setTextMessage] = useState('שלום, זו הודעה קולית לבדיקה משלוחה 20');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [audioUrlPreview, setAudioUrlPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fetchDispatchedLogs = async () => {
    try {
      // 1. Fetch from WhatsApp logs
      const waRes = await fetch('/api/whatsapp/logs');
      const waData = waRes.ok ? await waRes.json() : [];

      // 2. Fetch from general Call Logs for extension 20
      const logsRes = await fetch('/api/logs');
      const logsData = logsRes.ok ? await logsRes.json() : [];

      const combined: DispatchedMessage[] = [];

      // Add WhatsApp logs
      for (const item of waData) {
        combined.push({
          id: item.id,
          timestamp: item.timestamp,
          channel: 'whatsapp',
          to: item.to,
          from: item.from,
          transcript: item.text,
          audioUrl: item.audioUrl,
          status: item.status || 'sent',
          directLink: item.directLink,
        });
      }

      // Add Call logs from extension 20 that are emails or general dispatches
      for (const log of logsData) {
        if (log.extension === '20' && log.dispatchAction) {
          // Avoid duplicate if already in waData
          if (!combined.some(c => c.timestamp === log.timestamp)) {
            combined.push({
              id: log.id,
              timestamp: log.timestamp,
              channel: log.dispatchAction.channel,
              to: log.dispatchAction.recipient,
              from: log.callerPhone,
              transcript: log.dispatchAction.transcript || log.responseText,
              audioUrl: log.dispatchAction.audioUrl,
              status: log.dispatchAction.status || 'sent',
              previewUrl: log.dispatchAction.previewUrl,
            });
          }
        }
      }

      combined.sort((a, b) => b.timestamp - a.timestamp);
      setMessages(combined);
    } catch (err) {
      console.error('Failed to fetch dispatched logs:', err);
    }
  };

  useEffect(() => {
    fetchDispatchedLogs();
    const interval = setInterval(fetchDispatchedLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Microphone recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioBlob(audioBlob);
        setAudioUrlPreview(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setFeedback(null);
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'אין גישה למיקרופון: ' + err.message });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = async () => {
    if (!destination.trim()) {
      setFeedback({ type: 'error', text: 'אנא הזינו יעד לשליחה (מספר טלפון או כתובת מייל)' });
      return;
    }

    setSending(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append('extension', '20');
      formData.append('channel', channel);
      formData.append('target', destination.trim());
      formData.append('sender', senderInfo.trim() || '0583277004');

      if (recordedAudioBlob) {
        formData.append('audio', recordedAudioBlob, 'recording.webm');
      } else {
        formData.append('text', textMessage.trim() || 'שלום זו הודעה קולית');
      }

      const res = await fetch('/api/voice/process', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          text: `ההודעה נשלחה בהצלחה ב-${channel === 'whatsapp' ? 'וואטסאפ' : 'מייל'} אל ${destination}!`,
        });
        setRecordedAudioBlob(null);
        setAudioUrlPreview(null);
        fetchDispatchedLogs();
      } else {
        setFeedback({ type: 'error', text: data.error || 'שגיאה בשליחת ההודעה' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'שגיאת רשת: ' + err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xl font-mono shrink-0 shadow-lg shadow-emerald-500/20">
              20
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">שלוחה 20 • הקלטת הודעה קולית ושליחה לוואטסאפ או למייל</h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  פעיל ומסונכרן 24/7 בימות המשיח
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                המתקשר מקליט הודעה קולית בטלפון כשר, בוחר האם לשלוח אותה ב-WhatsApp או ב-Email,
                מקיש את מספר היעד או כתובת המייל, והמערכת מתמללת את ההודעה ושולחת אותה מיד עם קובץ השמע המקורי!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDispatchedLogs}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>רענן יומן הודעות</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Tester & Dispatched Messages Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Dispatch Simulator (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <span>הדמיה ושליחת הודעה קולית (שלוחה 20)</span>
            </h3>
            <span className="text-[11px] text-slate-400">בדיקה חיה</span>
          </div>

          {/* Channel Selector */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">ערוץ שליחה מבוקש:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setChannel('whatsapp');
                  setDestination('0583277004');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  channel === 'whatsapp'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>וואטסאפ (WhatsApp)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setChannel('email');
                  setDestination('m0583277004@gmail.com');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  channel === 'email'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>אימייל (Email)</span>
              </button>
            </div>
          </div>

          {/* Destination Input */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">
              {channel === 'whatsapp' ? 'מספר וואטסאפ של הנמען:' : 'כתובת מייל של הנמען:'}
            </label>
            <input
              type={channel === 'whatsapp' ? 'tel' : 'email'}
              dir="ltr"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={channel === 'whatsapp' ? '050-1234567' : 'name@example.com'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Sender Identity */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">
              זיהוי השולח (מספר הטלפון של המקליט):
            </label>
            <input
              type="text"
              dir="ltr"
              value={senderInfo}
              onChange={(e) => setSenderInfo(e.target.value)}
              placeholder="058-3277004"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Voice Recording / Text Message */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 block font-medium">תוכן ההודעה הקולית:</label>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                <span>{isRecording ? 'סיים הקלטה (סולמית)' : 'הקלט הודעה במיקרופון'}</span>
              </button>

              {audioUrlPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setRecordedAudioBlob(null);
                    setAudioUrlPreview(null);
                  }}
                  className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1"
                >
                  נקה הקלטה
                </button>
              )}
            </div>

            {audioUrlPreview && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-[10px] text-emerald-400 mb-1 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>הקלטה מוכנה לשליחה ותמלול:</span>
                </p>
                <audio controls src={audioUrlPreview} className="w-full h-8" />
              </div>
            )}

            {!audioUrlPreview && (
              <div>
                <textarea
                  rows={2}
                  value={textMessage}
                  onChange={(e) => setTextMessage(e.target.value)}
                  placeholder="או הקלידו את תוכן ההודעה כאן (תומר להקלטה קולית אוטומטית)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            )}
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || isRecording}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Send className={`w-4 h-4 ${sending ? 'animate-spin' : ''}`} />
            <span>{sending ? 'מעבד תמלול ושולח...' : `שלח עכשיו ל-${channel === 'whatsapp' ? 'וואטסאפ' : 'מייל'}`}</span>
          </button>
        </div>

        {/* Right Column: Feed of Sent Voice Messages (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>יומן הודעות קוליות שנשלחו (WhatsApp & Email)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                מעקב בזמן אמת אחר כל ההודעות שהוקלטו בשלוחה 20 ותומללו ב-AI
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {messages.length} הודעות
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-xs">עדיין לא נשלחו הודעות משלוחה 20.</p>
              <p className="text-[11px] text-slate-600">ניתן לבצע שיחה בטלפון לשלוחה 20 או לשלוח הודעת בדיקה בטופס משמאל.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {msg.channel === 'whatsapp' ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <MessageSquare className="w-3 h-3" />
                          <span>וואטסאפ אל {msg.to}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          <Mail className="w-3 h-3" />
                          <span>מייל אל {msg.to}</span>
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{new Date(msg.timestamp).toLocaleTimeString('he-IL')}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        נשלח בהצלחה
                      </span>

                      {msg.directLink && (
                        <a
                          href={msg.directLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold underline decoration-emerald-500/40"
                          title="פתח ישירות ב-WhatsApp Web/App"
                        >
                          <span>פתח ב-WhatsApp</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Transcript */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5 text-xs text-slate-200">
                    <p className="text-[10px] text-slate-400 mb-1 font-medium">תמלול ההודעה הקולית (Gemini AI):</p>
                    <p className="font-sans leading-relaxed">"{msg.transcript}"</p>
                  </div>

                  {/* Audio Player */}
                  {msg.audioUrl && (
                    <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/60 rounded-lg p-2">
                      <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <audio controls src={msg.audioUrl} className="w-full h-7" />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>שולח: <strong className="text-slate-300 font-mono">{msg.from || 'מערכת ימות'}</strong></span>
                    <span className="text-[10px] text-slate-500">שלוחה 20</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
