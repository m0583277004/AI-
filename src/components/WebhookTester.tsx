import React, { useState } from 'react';
import { Play, RotateCcw, Radio, Send, CheckCircle2, AlertCircle, FileCode, Terminal } from 'lucide-react';

interface WebhookTesterProps {
  webhookUrl: string;
}

export const WebhookTester: React.FC<WebhookTesterProps> = ({ webhookUrl }) => {
  const [phone, setPhone] = useState('0583277004');
  const [did, setDid] = useState('0771234567');
  const [extension, setExtension] = useState('4');
  const [callId, setCallId] = useState('test_call_101');
  const [prompt, setPrompt] = useState('מה הברכה על פרי עץ האתרוג?');
  const [recordFileUrl, setRecordFileUrl] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [audioUrlToPlay, setAudioUrlToPlay] = useState<string | null>(null);

  const handleSendTest = async () => {
    setLoading(true);
    setResponseOutput(null);
    setAudioUrlToPlay(null);

    try {
      const params = new URLSearchParams({
        ApiPhone: phone,
        ApiDID: did,
        ApiExtension: extension,
        ApiCallId: callId,
      });

      if (prompt) params.append('prompt', prompt);
      if (recordFileUrl) params.append('record_file', recordFileUrl);

      const url = `/api/yemot/ivr?${params.toString()}`;
      const res = await fetch(url);
      const text = await res.text();

      setResponseOutput(text);

      // Check if there is an audio URL inside response
      const audioMatch = text.match(/f-(https?:\/\/[^\s&]+|\/api\/yemot\/audio\/[^\s&]+)/);
      if (audioMatch && audioMatch[1]) {
        setAudioUrlToPlay(audioMatch[1]);
      }

    } catch (err: any) {
      setResponseOutput(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
          <Terminal className="w-4 h-4" />
          <span>כלי דיבוג ובדיקות מפתחים עבור ימות המשיח</span>
        </div>
        <h2 className="text-base font-bold text-white">סימולטור קריאות Webhook של ימות המשיח</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          שלח בקשות בדיקה המדמות בדיוק את הפניות של שרתי ימות המשיח ובחן את התחביר המוחזר (<code className="text-emerald-400">read=...</code>, <code className="text-emerald-400">id_list_message=...</code>).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Form Params */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-xs font-bold text-white pb-2 border-b border-slate-800">
            פרמטרים של השיחה (Query Parameters)
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">מספר טלפון (ApiPhone):</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">מספר מערכת (ApiDID):</label>
              <input
                type="text"
                value={did}
                onChange={(e) => setDid(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">מספר שלוחה (ApiExtension):</label>
              <input
                type="text"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">מזהה שיחה (ApiCallId):</label>
              <input
                type="text"
                value={callId}
                onChange={(e) => setCallId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-[11px] text-slate-400 mb-1">שאלה לבדיקה (prompt):</label>
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="הקלד שאלה שתשלח ל-Gemini כאילו הוקלטה בטלפון..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2">
            <button
              id="btn-run-webhook-test"
              onClick={handleSendTest}
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>{loading ? 'שולח ומעבד ב-Gemini...' : 'שלח קריאת בדיקה ל-Webhook'}</span>
            </button>
          </div>
        </div>

        {/* Output Box */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white">תגובה גולמית לימות המשיח (Response Output)</h3>
            </div>
          </div>

          {responseOutput ? (
            <div className="space-y-3">
              <pre className="bg-slate-950 text-emerald-300 font-mono text-xs p-4 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed text-left" dir="ltr">
                {responseOutput}
              </pre>

              {audioUrlToPlay && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-300 block">נוצר קובץ שמע לתשובה!</span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-xs block" dir="ltr">
                      {audioUrlToPlay}
                    </span>
                  </div>
                  <audio controls src={audioUrlToPlay} className="h-8 max-w-[200px]" />
                </div>
              )}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
              <Terminal className="w-8 h-8 mb-2 opacity-30" />
              <p>לחץ על 'שלח קריאת בדיקה' כדי לראות את הפלט שיוחזר לטלפון.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
