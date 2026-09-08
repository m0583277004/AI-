import React, { useState, useEffect } from 'react';
import { AssistantSettings } from '../types';
import { X, Save, Sparkles, Sliders, Volume2, RotateCcw, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [settings, setSettings] = useState<AssistantSettings>({
    systemPrompt: '',
    welcomeMessage: '',
    noSpeechMessage: '',
    farewellMessage: '',
    voiceGender: 'male',
    voiceSpeed: 1.0,
    maxTokens: 250,
    temperature: 0.4,
    saveRecordings: true,
    model: 'gemini-3.7-flash',
  });

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => setSettings(data))
        .catch((err) => console.error('Error loading settings:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
        if (onSaved) onSaved();
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (preset: 'standard' | 'torah' | 'customer_service') => {
    if (preset === 'standard') {
      setSettings((prev) => ({
        ...prev,
        welcomeMessage: 'שלום וברוכים הבאים לעוזר הקולי החכם. אנא אמור את שאלתך לאחר הצליל, ולסיום הקש סולמית.',
        systemPrompt: `אתה עוזר קולי חכם, אדיב ותמציתי הפועל בשיחת טלפון קולית (עבור משתמשים בטלפונים כשרים ללא אינטרנט).
הנחיות חשובות למענה בשיחת טלפון:
1. ענה בעברית ברורה, טבעית ומכבדת.
2. מכיוון שהתשובה תושמע כהקלטה קולית בטלפון, ענה בתמציתיות (עד 2-3 משפטים קצרים).
3. אל תשתמש בסימוני טקסט או אימוג'ים אלא בדיבור רציף וקולח.
4. תן מידע מדויק וברור.`,
      }));
    } else if (preset === 'torah') {
      setSettings((prev) => ({
        ...prev,
        welcomeMessage: 'שלום וברוכים הבאים למוקד שאלות בהלכה ויהדות. אנא אמור את שאלתך לאחר הצליל.',
        systemPrompt: `אתה עוזר קולי תורני הפועל בקו טלפון כשר עבור ציבור שומרי תורה ומצוות.
הנחיות מיוחדות:
1. ענה בלשון כבוד, מתוך מקורות ההלכה והמסורת (שו"ע, משנה ברורה, פוסקים מקובלים).
2. הדגש בתחילת או סוף תשובה מורכבת: 'להלכה למעשה יש להיוועץ במורה הוראה'.
3. התשובה מושמעת בדיבור טלפוני - נסח אותה בצורה בהירה וקצרה.`,
      }));
    } else if (preset === 'customer_service') {
      setSettings((prev) => ({
        ...prev,
        welcomeMessage: 'שלום, הגעתם למוקד השירות והמידע הקולי. אנא אמרו את בקשתכם לאחר הצליל.',
        systemPrompt: `אתה נציג שירות לקוחות וירטואלי קולי אדיב, סבלני ויעיל.
הנחיות:
1. קבל את הלקוח בברכה ותן מענה ענייני וממוקד.
2. דבר בשפה שירותית, חמה ותמציתית המתאימה לשיחת מוקד טלפוני.`,
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">הגדרות קול והנחיות ל-AI (שלוחה 4)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            תבניות מוכנות מראש:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handlePreset('standard')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-200 text-right transition-all"
            >
              <span className="font-bold block text-emerald-400">עוזר כללי</span>
              <span className="text-[10px] text-slate-400">מענה לשאלות כלליות</span>
            </button>
            <button
              onClick={() => handlePreset('torah')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-200 text-right transition-all"
            >
              <span className="font-bold block text-emerald-400">קו הלכה ויהדות</span>
              <span className="text-[10px] text-slate-400">מותאם לטלפון כשר</span>
            </button>
            <button
              onClick={() => handlePreset('customer_service')}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-200 text-right transition-all"
            >
              <span className="font-bold block text-emerald-400">מוקד שירות</span>
              <span className="text-[10px] text-slate-400">מענה שירותי ממוקד</span>
            </button>
          </div>
        </div>

        {/* Welcome message */}
        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-slate-300">
            הודעת פתיחה מושמעת (מושמעת למתקשר בכניסה לשלוחה):
          </label>
          <input
            type="text"
            value={settings.welcomeMessage}
            onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* System Prompt */}
        <div className="space-y-1 text-xs">
          <label className="block font-semibold text-slate-300">
            הוראות מערכת ל-AI (System Prompt):
          </label>
          <textarea
            rows={5}
            value={settings.systemPrompt}
            onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
          />
        </div>

        {/* Voice & AI Parameters */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              מהירות הקראה קולית: <span className="font-mono text-emerald-400 font-bold">{settings.voiceSpeed}x</span>
            </label>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={settings.voiceSpeed}
              onChange={(e) => setSettings({ ...settings, voiceSpeed: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              מודל Gemini פעיל:
            </label>
            <input
              type="text"
              readOnly
              value={settings.model || 'gemini-3.7-flash'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400 font-mono"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <span className="text-xs text-slate-400">
            {savedSuccess && (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <Check className="w-4 h-4" /> ההגדרות נשמרו בהצלחה!
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              סגור
            </button>
            <button
              id="btn-save-settings"
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'שומר...' : 'שמור הגדרות'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
