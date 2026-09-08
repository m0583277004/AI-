import React, { useState, useEffect } from 'react';
import { CallLog } from '../types';
import { Phone, Clock, Volume2, RotateCcw, Search, CheckCircle2, Shield, Sparkles, User, Bot, Zap, Mail, ExternalLink } from 'lucide-react';

export const CallLogs: React.FC = () => {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const playAudio = (url: string, id: string) => {
    const audio = new Audio(url);
    setPlayingAudioId(id);
    audio.play();
    audio.onended = () => setPlayingAudioId(null);
    audio.onerror = () => setPlayingAudioId(null);
  };

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.callerPhone.toLowerCase().includes(term) ||
      (log.questionText && log.questionText.toLowerCase().includes(term)) ||
      (log.responseText && log.responseText.toLowerCase().includes(term)) ||
      (log.emailAction?.targetEmail && log.emailAction.targetEmail.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">יומן שיחות והקלטות בזמן אמת</h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-medium">
              {logs.length} שיחות
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            מעקב אחר שיחות נכנסות משלוחות ימות המשיח, זיהוי קולי ושליחת מיילים אוטומטית
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="חיפוש לפי טלפון, מייל או תוכן..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={fetchLogs}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors shrink-0"
            title="רענן יומן"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs List */}
      {logs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
          <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <h3 className="text-sm font-semibold text-slate-400">טרם התקבלו שיחות</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            כאשר מתקשר יחייג לשלוחה 6 במערכת ימות המשיח או תבצע שיחה בסימולטור, פרטי השיחה, ההקלטה והתשובה יופיעו כאן בזמן אמת.
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
          <p className="text-xs">לא נמצאו שיחות התואמות לחיפוש "{searchTerm}"</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 transition-all hover:border-slate-700"
            >
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white tracking-wider" dir="ltr">
                        {log.callerPhone}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        שלוחה {log.extension}
                      </span>
                      {log.emailAction && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-blue-400" />
                          נשלח מייל: {log.emailAction.targetEmail}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString('he-IL')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    {log.latencyMs}ms
                  </span>
                  <span className="text-[11px] font-mono px-2 py-1 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 font-medium">
                    חיסכון: ~0.30 ₪
                  </span>
                </div>
              </div>

              {/* Conversation body */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                
                {/* Caller Question */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      שאלת המתקשר (קול/טקסט):
                    </span>
                  </div>
                  <p className="text-slate-200 font-medium leading-relaxed">
                    {log.questionText || '(לא זוהה טקסט)'}
                  </p>
                  {log.questionAudioUrl && (
                    <div className="pt-1">
                      <button
                        onClick={() => playAudio(log.questionAudioUrl!, `q-${log.id}`)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded flex items-center gap-1 transition-colors"
                      >
                        <Volume2 className="w-3 h-3" />
                        השמע הקלטת מקור
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Spoken Answer */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <Bot className="w-3 h-3" />
                      מענה קולי שהושמע בטלפון:
                    </span>
                    {log.responseAudioUrl && (
                      <button
                        onClick={() => playAudio(log.responseAudioUrl!, `a-${log.id}`)}
                        className={`px-2.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all ${
                          playingAudioId === `a-${log.id}`
                            ? 'bg-emerald-500 text-slate-950 animate-pulse'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        <Volume2 className="w-3 h-3" />
                        {playingAudioId === `a-${log.id}` ? 'משמיע...' : 'השמע תשובה'}
                      </button>
                    )}
                  </div>
                  <p className="text-slate-200 font-medium leading-relaxed">
                    {log.responseText}
                  </p>

                  {log.emailAction && (
                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-blue-300">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        נשלח בהצלחה ל: <strong className="font-mono text-white">{log.emailAction.targetEmail}</strong>
                      </span>
                      {log.emailAction.previewUrl && (
                        <a
                          href={log.emailAction.previewUrl as string}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                        >
                          תצוגת מייל מקדימה
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
