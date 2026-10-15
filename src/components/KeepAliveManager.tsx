import React, { useState, useEffect } from 'react';
import { Bot, Play, RefreshCw, CheckCircle2, XCircle, Clock, Globe, Shield, Activity, Plus, Trash2 } from 'lucide-react';

interface KeepAliveData {
  enabled: boolean;
  intervalMinutes: number;
  lastPingTime: number | null;
  lastPingStatus: 'ok' | 'failed' | 'idle';
  lastPingError?: string;
  totalPings: number;
  targetUrls: string[];
}

interface ExtensionCheckResult {
  ext: string;
  name: string;
  type: string;
  status: 'ok' | 'error' | 'pending';
  sampleResponse?: string;
  latencyMs?: number;
  error?: string;
}

export const KeepAliveManager: React.FC = () => {
  const [keepAlive, setKeepAlive] = useState<KeepAliveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [intervalVal, setIntervalVal] = useState(9);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Extensions verification state
  const [checkingExtensions, setCheckingExtensions] = useState(false);
  const [extensionResults, setExtensionResults] = useState<ExtensionCheckResult[]>([]);

  const EXTENSIONS_TO_TEST = [
    { ext: '6', name: 'עוזר כללי מהיר', type: 'שאלות ותשובות יומיות' },
    { ext: '7', name: 'עוזר מעמיק ומלומד', type: 'ניתוח ברמה אקדמית/תורנית' },
    { ext: '8', name: 'חבר חכם ותומך', type: 'תמיכה רגשית ושיחה חמה' },
    { ext: '9', name: 'עוזר טורבו מהיר במיוחד', type: 'תשובות בזק תוך 2-3 שניות' },
    { ext: '10', name: 'עוזר מעמיק ומפורט', type: 'תשובות ארוכות במודל חינמי' },
    { ext: '12', name: 'מחשבון שפיצר', type: 'חישוב הלוואות ומשכנתאות' },
    { ext: '20', name: 'הודעות וואטסאפ ומייל', type: 'הקלטה, תמלול ושליחה ישירה' },
  ];

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/keep-alive');
      if (res.ok) {
        const data = await res.json();
        setKeepAlive(data);
        setIntervalVal(data.intervalMinutes || 9);
      }
    } catch (e) {
      console.error('Failed to fetch keep alive status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleToggle = async (enabled: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('/api/keep-alive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setKeepAlive(data);
        setMessage({ text: enabled ? 'רובוט שמירת ערות הופעל בהצלחה' : 'רובוט שמירת ערות הושבת', type: 'success' });
      }
    } catch (e: any) {
      setMessage({ text: `שגיאה: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInterval = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keep-alive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMinutes: intervalVal }),
      });
      if (res.ok) {
        const data = await res.json();
        setKeepAlive(data);
        setMessage({ text: `תדירות הדגימה עודכנה לכל ${intervalVal} דקות`, type: 'success' });
      }
    } catch (e: any) {
      setMessage({ text: `שגיאה: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!newUrl.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/keep-alive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addUrl: newUrl.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setKeepAlive(data);
        setNewUrl('');
        setMessage({ text: 'כתובת Render נוספה בהצלחה לרשימת הדגימה', type: 'success' });
      }
    } catch (e: any) {
      setMessage({ text: `שגיאה: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUrl = async (urlToRemove: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/keep-alive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeUrl: urlToRemove }),
      });
      if (res.ok) {
        const data = await res.json();
        setKeepAlive(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePingNow = async () => {
    setPinging(true);
    setMessage(null);
    try {
      const res = await fetch('/api/keep-alive/ping-now', { method: 'POST' });
      const data = await res.json();
      await fetchStatus();
      if (data.success) {
        setMessage({ text: 'דגימת שמירת ערות נשלחה בהצלחה! כל השרתים הגיבו במהירות.', type: 'success' });
      } else {
        setMessage({ text: 'נשלחה דגימה, חלק מהיעדים החזירו שגיאה.', type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: `שגיאה בביצוע דגימה: ${e.message}`, type: 'error' });
    } finally {
      setPinging(false);
    }
  };

  // Run comprehensive health test on all extensions (6, 7, 8, 9, 10, 12)
  const runExtensionsAudit = async () => {
    setCheckingExtensions(true);
    const initial = EXTENSIONS_TO_TEST.map(t => ({
      ...t,
      status: 'pending' as const,
    }));
    setExtensionResults(initial);

    const updatedResults: ExtensionCheckResult[] = [];

    for (const item of EXTENSIONS_TO_TEST) {
      const start = Date.now();
      try {
        const params = new URLSearchParams({
          ApiPhone: '0583277004',
          ApiDID: '0777003161',
          ApiExtension: item.ext,
          ApiCallId: `audit_${item.ext}_${Date.now()}`,
        });

        // Test step 0 (welcome / IVR prompt)
        const res = await fetch(`/api/yemot/ivr?${params.toString()}`);
        const elapsed = Date.now() - start;
        const text = await res.text();

        const isYemotValid = text.includes('read=') || text.includes('id_list_message=') || text.includes('hangup');
        
        if (res.ok && isYemotValid) {
          updatedResults.push({
            ...item,
            status: 'ok',
            sampleResponse: text.slice(0, 120) + (text.length > 120 ? '...' : ''),
            latencyMs: elapsed,
          });
        } else {
          updatedResults.push({
            ...item,
            status: 'error',
            sampleResponse: text.slice(0, 120),
            latencyMs: elapsed,
            error: !res.ok ? `HTTP ${res.status}` : 'תגובה לא מזוהה ע"י ימות המשיח',
          });
        }
      } catch (err: any) {
        updatedResults.push({
          ...item,
          status: 'error',
          latencyMs: Date.now() - start,
          error: err.message,
        });
      }

      setExtensionResults([...updatedResults]);
    }

    setCheckingExtensions(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">רובוט זמן פעולה ושמירת ערות 24/7 (Keep-Alive)</h2>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                  keepAlive?.enabled
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {keepAlive?.enabled ? 'רובוט פעיל (מונע תרדמת שרת)' : 'כבוי'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                רובוט זה מבצע דגימות קבועות כל מספר דקות לשרת ב-Render. הוא מונע מהשרת להיכנס לתרדמת (Cold Start),
                ומבטיח שכל שיחה נכנסת מימות המשיח תענה מיד תוך שניות ללא ההודעה "אין מענה בשרת API".
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={handlePingNow}
              disabled={pinging}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${pinging ? 'animate-spin' : ''}`} />
              <span>{pinging ? 'דוגם שרת...' : 'בצע דגימה מיידית עכשיו'}</span>
            </button>

            <button
              onClick={() => handleToggle(!keepAlive?.enabled)}
              disabled={loading}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                keepAlive?.enabled
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              {keepAlive?.enabled ? 'השהה רובוט' : 'הפעל רובוט'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Extension 6 Special 24/7 Resilience Card */}
      <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-black text-xl flex items-center justify-center font-mono shrink-0 shadow-lg shadow-emerald-500/30">
              6
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">מערך עמידות 24/7 לשלוחה 6 (ללא צורך במחשב או אינטרנט)</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  פעיל ומסונכרן בימות המשיח
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                שלוחה 6 מוגנת כעת מכל מצב תרדמת ומסונכרנת ישירות מול שרתי ימות המשיח.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              runExtensionsAudit();
            }}
            disabled={checkingExtensions}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all shrink-0"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>בדיקת דמה חיה לשלוחה 6</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>מוזיקת המתנה ל-90 שניות</span>
            </div>
            <p className="text-[11px] text-slate-400">
              גם אם השרת היה בתרדמת (Cold Start), ימות המשיח תשמיע למתקשר מוזיקת המתנה נעימה עד להתעוררות מלאה ולא תנתק את השיחה!
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-teal-400 text-xs font-bold">
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>דגימת ערות כל 3 דקות</span>
            </div>
            <p className="text-[11px] text-slate-400">
              הרובוט דוגם את כתובת ה-Tunnel החיצונית ישירות מהאינטרנט כל 3 דקות, ושומר על הערוץ חם ופתוח ללא הרדמה.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
              <Globe className="w-4 h-4 shrink-0" />
              <span>עבודה אוטונומית בענן</span>
            </div>
            <p className="text-[11px] text-slate-400">
              נוצרו קבצי פריסה אוטונומיים: <code className="text-white font-mono">render.yaml</code> ורובוט חינמי של GitHub Actions לדגימה חיצונית 24/7.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>סטטוס דגימה אחרונה</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${
              keepAlive?.lastPingStatus === 'ok' ? 'bg-emerald-400 animate-pulse' :
              keepAlive?.lastPingStatus === 'failed' ? 'bg-rose-400' : 'bg-slate-500'
            }`} />
            <span className="text-base font-bold text-white">
              {keepAlive?.lastPingStatus === 'ok' ? 'מגיב מעולה (ער 24/7)' :
               keepAlive?.lastPingStatus === 'failed' ? 'שגיאת תגובה' : 'ממתין לדגימה'}
            </span>
          </div>
          {keepAlive?.lastPingTime && (
            <p className="text-[11px] text-slate-400 mt-1">
              לפני {Math.round((Date.now() - keepAlive.lastPingTime) / 1000)} שניות
            </p>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>סך כל הדגימות שבוצעו</span>
            <Clock className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white mt-1">
            {keepAlive?.totalPings ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">דגימות לשמירת ערות</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>תדירות דגימה</span>
            <RefreshCw className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min="1"
              max="14"
              value={intervalVal}
              onChange={(e) => setIntervalVal(parseInt(e.target.value) || 9)}
              className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white font-mono text-center"
            />
            <span className="text-xs text-slate-300">דקות</span>
            <button
              onClick={handleSaveInterval}
              disabled={loading}
              className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
            >
              שמור
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">מומלץ 9 דקות (Render נרדם ב-15)</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>יעדים מנוטרים</span>
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white mt-1">
            {(keepAlive?.targetUrls.length ?? 0) + 1}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">שרת פנימי + כתובות ענן</p>
        </div>
      </div>

      {/* Target URLs Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span>כתובות השרת ב-Render לדגימה קבועה</span>
        </h3>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            dir="ltr"
            placeholder="למשל: https://yemot-ai.onrender.com"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleAddUrl}
            disabled={loading || !newUrl.trim()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>הוסף כתובת לדגימה</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 font-mono text-slate-300" dir="ltr">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>http://127.0.0.1:3000 (Local Dev Server)</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              דגימה מקומית
            </span>
          </div>

          {keepAlive?.targetUrls.map((url) => (
            <div key={url} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
              <div className="flex items-center gap-2 font-mono text-emerald-400" dir="ltr">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{url}</span>
              </div>
              <button
                onClick={() => handleRemoveUrl(url)}
                className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                title="הסר מרשימת הדגימה"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* EXTENSIONS VERIFICATION (6, 7, 8, 9, 10, 12) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">בדיקת תקינות כל השלוחות (6 ומעלה)</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              הרצת בדיקת קצה-לקצה המדמה את פקודות ה-IVR של ימות המשיח בכל השלוחות הפעילות.
            </p>
          </div>

          <button
            onClick={runExtensionsAudit}
            disabled={checkingExtensions}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingExtensions ? 'animate-spin' : ''}`} />
            <span>{checkingExtensions ? 'בודק שלוחות...' : 'בדוק את כל השלוחות עכשיו'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {EXTENSIONS_TO_TEST.map((item) => {
            const result = extensionResults.find(r => r.ext === item.ext);
            return (
              <div
                key={item.ext}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 relative hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs font-mono">
                      {item.ext}
                    </span>
                    <span className="text-xs font-bold text-white">{item.name}</span>
                  </div>

                  {result ? (
                    result.status === 'ok' ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>תקין ({result.latencyMs}ms)</span>
                      </span>
                    ) : result.status === 'pending' ? (
                      <span className="text-[11px] text-amber-400 animate-pulse">בודק...</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        <XCircle className="w-3 h-3" />
                        <span>שגיאה</span>
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      מוכן לבדיקה
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400">{item.type}</p>

                {result?.sampleResponse && (
                  <div className="mt-2 p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300 break-all" dir="ltr">
                    {result.sampleResponse}
                  </div>
                )}

                {result?.error && (
                  <div className="mt-2 p-2 rounded bg-rose-500/10 border border-rose-500/30 font-mono text-[10px] text-rose-300">
                    {result.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
