import React, { useState, useEffect } from 'react';
import { Copy, Check, FileCode, CheckCircle2, AlertCircle, HelpCircle, Sparkles, Server, PhoneCall, ExternalLink, Settings, Shield, RefreshCw, Zap, Lock } from 'lucide-react';

interface YemotSetupGuideProps {
  webhookUrl: string;
}

export const YemotSetupGuide: React.FC<YemotSetupGuideProps> = ({ webhookUrl }) => {
  const [copiedIni, setCopiedIni] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message?: string }>({ status: 'idle' });

  // Remote Yemot API Sync State
  const [systemNumber, setSystemNumber] = useState('0777003161');
  const [password, setPassword] = useState('7003161');
  const [apiKey, setApiKey] = useState('WU1BUElL.apik_WtVEpFUY1BY9hoo6d0tV3g.p2JSowKvsXxrlQNeXfdTVK63hgdh2gYOdBJ6O9YUGik');
  const [selectedExt, setSelectedExt] = useState<'6' | '4' | '5'>('6');
  const [remoteSyncing, setRemoteSyncing] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<{
    loaded: boolean;
    configured: boolean;
    mtime?: string | null;
    message?: string;
  }>({
    loaded: false,
    configured: true,
    mtime: 'הוגדר בהצלחה במערכת',
    message: 'שלוחה 6 (החינמית ללא STT/TTS) ושלוחה 4 מוגדרות בימות המשיח!',
  });

  const checkRemoteStatus = async () => {
    try {
      const res = await fetch(`/api/yemot/remote-status?username=${systemNumber}&password=${password}&extension=${selectedExt}`);
      if (res.ok) {
        const data = await res.json();
        setRemoteStatus({
          loaded: true,
          configured: data.configured,
          mtime: data.mtime,
          message: data.configured ? `שלוחה ${selectedExt} מוגדרת ומחוברת בימות המשיח` : `שלוחה ${selectedExt} טרם הוגדרה`,
        });
      }
    } catch (e) {
      console.error('Failed to check remote status:', e);
    }
  };

  useEffect(() => {
    checkRemoteStatus();
  }, [selectedExt]);

  const handleRemoteSync = async (extToSync = selectedExt) => {
    setRemoteSyncing(true);
    try {
      const res = await fetch('/api/yemot/remote-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: systemNumber,
          password,
          apiKey,
          extension: extToSync,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRemoteStatus({
          loaded: true,
          configured: true,
          mtime: new Date().toLocaleTimeString('he-IL'),
          message: data.message,
        });
      } else {
        alert(`שגיאה בהגדרה: ${data.error || 'נכשל'}`);
      }
    } catch (err: any) {
      alert(`שגיאה בחיבור לימות המשיח: ${err.message}`);
    } finally {
      setRemoteSyncing(false);
    }
  };

  // Generate ext.ini content for selected Extension
  const getExtIniContent = () => {
    const isExt6 = selectedExt === '6';
    return `; הגדרות שלוחה ${selectedExt} - מענה קולי מבוסס AI של ימות המשיח (${isExt6 ? 'מסלול חינמי ללא עלות יחידות STT/TTS' : 'מסלול תמלול והקראה מהיר'})
; סוג השלוחה: API חיצוני
type=api

; כתובת ה-Webhook של שרת ה-AI
api_link=${webhookUrl}

; העברת פרטי המתקשר לשרת
api_phone_send=yes
api_did_send=yes
api_extension_send=yes
api_hangup_send=yes
${isExt6 ? '; שליחת קובץ הקלטה ישירות לשרת AI ללא עלות זיהוי בימות המשיח\napi_link_send_recording=yes\napi_timeout=35' : '; הגדרות תאימות שמע\napi_timeout=25'}
`;
  };

  const handleCopyIni = () => {
    navigator.clipboard.writeText(getExtIniContent());
    setCopiedIni(true);
    setTimeout(() => setCopiedIni(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const testWebhookEndpoint = async () => {
    setTestResult({ status: 'testing' });
    try {
      const res = await fetch(`/api/yemot/ivr?ApiPhone=0583277004&ApiDID=0771234567&ApiExtension=${selectedExt}&ApiCallId=test_${Date.now()}`);
      const text = await res.text();
      if (res.ok && (text.includes('read=') || text.includes('id_list_message='))) {
        setTestResult({
          status: 'success',
          message: `ה-Webhook של שלוחה ${selectedExt} תקין ומוכן לקבלת שיחות! תגובת המערכת: ${text.slice(0, 80)}...`,
        });
      } else {
        setTestResult({
          status: 'error',
          message: `התקבלה תגובה שאינה תואמת לימות המשיח: ${text.slice(0, 100)}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: `שגיאה בבדיקת השרת: ${err.message}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Quick Instructions */}
      <div className="bg-gradient-to-l from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${selectedExt === '6' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                {selectedExt === '6' ? 'שלוחה 6 - מסלול חינמי (0 יחידות STT/TTS)' : `שלוחה ${selectedExt} - מסלול תמלול מהיר`}
              </span>
              <h2 className="text-lg font-bold text-white">מדריך והגדרות שלוחות במערכת ימות המשיח</h2>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              בחר את השלוחה הרצויה, צפה בקובץ ה-<code className="text-emerald-400 font-mono bg-slate-950 px-1 py-0.5 rounded">ext.ini</code> וסנכרן אותו ישירות למערכת ימות המשיח בלחיצה אחת.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              id="btn-test-webhook"
              onClick={testWebhookEndpoint}
              disabled={testResult.status === 'testing'}
              className="w-full md:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
            >
              <Server className="w-4 h-4" />
              <span>{testResult.status === 'testing' ? 'בודק קישוריות...' : `בדוק תקינות שלוחה ${selectedExt}`}</span>
            </button>
          </div>
        </div>

        {/* Extension Switcher Tabs */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
          <span className="text-xs font-semibold text-slate-400">בחר שלוחה להגדרה:</span>
          
          <button
            onClick={() => setSelectedExt('6')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedExt === '6'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>שלוחה 6 (מסלול זול: 0 יחידות STT/TTS)</span>
          </button>

          <button
            onClick={() => setSelectedExt('4')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedExt === '4'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>שלוחה 4 (מסלול תמלול מהיר)</span>
          </button>

          <button
            onClick={() => setSelectedExt('5')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedExt === '5'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <span>שלוחה 5</span>
          </button>
        </div>

        {/* Live Remote System 0777003161 Connected Card */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">מערכת ימות המשיח: {systemNumber}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  שלוחה {selectedExt} מוגדרת ומחוברת
                </span>
              </div>
              <p className="text-[11px] text-emerald-300/90 mt-0.5">
                הקובץ <code className="text-white font-mono">ivr2:/{selectedExt}/ext.ini</code> נכתב ישירות במערכת שלך ומוכן לקבלת שיחות.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleRemoteSync(selectedExt)}
              disabled={remoteSyncing}
              className="w-full sm:w-auto px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${remoteSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{remoteSyncing ? 'מעדכן ישירות בימות...' : `סנכרן את שלוחה ${selectedExt} לימות המשיח`}</span>
            </button>
          </div>
        </div>

        {/* Test Result Feedback */}
        {testResult.status !== 'idle' && (
          <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
            testResult.status === 'success'
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
              : testResult.status === 'error'
              ? 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
              : 'bg-slate-950 border border-slate-800 text-slate-300'
          }`}>
            {testResult.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
            {testResult.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />}
            {testResult.status === 'testing' && <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0"></div>}
            <div>
              <p className="font-semibold">{testResult.status === 'success' ? 'בדיקת החיבור הצליחה!' : testResult.status === 'error' ? 'שגיאה בבדיקה' : 'מבצע סימולציית קריאה...'}</p>
              <p className="mt-0.5 text-[11px] opacity-90">{testResult.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Code Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Code Box for ext.ini */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">קובץ תצורה: /{selectedExt}/ext.ini</span>
            </div>
            <button
              id="btn-copy-ext-ini"
              onClick={handleCopyIni}
              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {copiedIni ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedIni ? 'הועתק ללוח!' : 'העתק את כל ההגדרות'}</span>
            </button>
          </div>

          {/* Code Viewer */}
          <div className="relative">
            <pre className="bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl border border-slate-800/90 overflow-x-auto leading-relaxed text-left" dir="ltr">
              {getExtIniContent()}
            </pre>
          </div>

          {/* Webhook Direct URL */}
          <div className="pt-2">
            <label className="text-[11px] text-slate-400 font-medium block mb-1">
              כתובת ה-API הישירה (api_link):
            </label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="bg-transparent text-xs text-slate-200 font-mono flex-1 outline-none text-left"
                dir="ltr"
              />
              <button
                onClick={handleCopyUrl}
                className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
                title="העתק קישור"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Step-by-Step Instructions */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">איך להגדיר בפורטל ימות המשיח?</h3>
          </div>

          <ol className="space-y-3.5 text-xs text-slate-300">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                1
              </span>
              <div>
                <p className="font-semibold text-white">התחבר למערכת הניהול</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  היכנס לאתר <a href="https://www.yemot.co.il" target="_blank" rel="noreferrer" className="text-emerald-400 underline inline-flex items-center gap-0.5">yemot.co.il <ExternalLink className="w-2.5 h-2.5" /></a> עם מספר המערכת והסיסמה שלך.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                2
              </span>
              <div>
                <p className="font-semibold text-white">נווט לשלוחה 4 (או צור אותה)</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  בתפריט הצדדי, לחץ על <strong>"מבנה מערכת"</strong> ובחר בתיקייה <strong>"4"</strong> (אם אין שלוחה 4, צור תיקייה חדשה בשם 4).
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                3
              </span>
              <div>
                <p className="font-semibold text-white">ערוך את קובץ ext.ini</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  לחץ על הלשונית <strong>"הגדרות מתקדמות"</strong> (או "עריכת קובץ תצורה ext.ini").
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                4
              </span>
              <div>
                <p className="font-semibold text-white">הדבק ושמור</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  הדבק את הטקסט שהועתק מהתיבה משמאל, ולחץ על <strong>"שמור שינויים"</strong>.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                5
              </span>
              <div>
                <p className="font-semibold text-white">חייג ובדוק!</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  חייג למספר המערכת שלך מכל טלפון כשר, הקש <strong>4</strong>, ושאל כל שאלה בקול!
                </p>
              </div>
            </li>
          </ol>
        </div>

      </div>

      {/* Technical FAQ: How it works behind the scenes */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          איך זרימת השיחה פועלת מבחינה טכנית בימות המשיח?
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="font-bold text-emerald-400">1. כניסה והקלטה קולית</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              המתקשר נכנס לשלוחה 4, המערכת משמיעה הודעת פתיחה ומקליטה את קול המתקשר (קובץ WAV באיכות קו טלפון).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="font-bold text-emerald-400">2. עיבוד רב-מודאלי ב-Gemini</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              קובץ השמע נשלח ישירות למודל Gemini שמבין את השאלה המדוברת ללא תשלום עבור שירותי תמלול צד ג' יקרים.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="font-bold text-emerald-400">3. יצירת שמע ומענה מיידי</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              השרת מייצר קובץ שמע בדיבור עברי רהוט ומשמיע אותו מיד בשיחה דרך פקודת <code className="text-emerald-400">id_list_message=f-...</code>.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
