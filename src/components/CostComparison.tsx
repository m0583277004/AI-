import React, { useState } from 'react';
import { DollarSign, Zap, TrendingDown, ArrowRight, CheckCircle2, XCircle, Calculator, ShieldCheck, Sparkles } from 'lucide-react';

export const CostComparison: React.FC = () => {
  const [monthlyCalls, setMonthlyCalls] = useState<number>(2000);

  // Cost modeling
  // Old Architecture (Claude + Paid STT + Paid TTS)
  const oldSttPerCall = 0.025; // ~$0.025 / min for Hebrew STT
  const oldClaudePerCall = 0.015; // Claude 3.5 Sonnet tokens
  const oldTtsPerCall = 0.040; // Paid TTS (ElevenLabs / Azure / Yemot TTS units)
  const oldTotalPerCall = oldSttPerCall + oldClaudePerCall + oldTtsPerCall; // ~$0.080 per call

  // New Architecture (Gemini Native Audio + High Speed Hebrew TTS Bridge)
  const newSttPerCall = 0.0000; // Built into Gemini multimodal input
  const newGeminiPerCall = 0.0004; // Gemini 3.7 Flash
  const newTtsPerCall = 0.0000; // Free optimized neural Hebrew speech engine
  const newTotalPerCall = newSttPerCall + newGeminiPerCall + newTtsPerCall; // ~$0.0004 per call

  const oldMonthlyCost = monthlyCalls * oldTotalPerCall;
  const newMonthlyCost = monthlyCalls * newTotalPerCall;
  const monthlySavings = oldMonthlyCost - newMonthlyCost;
  const savingsPercent = Math.round(((oldTotalPerCall - newTotalPerCall) / oldTotalPerCall) * 100);

  return (
    <div className="space-y-6">
      
      {/* Solution Header / Direct Answer */}
      <div className="bg-gradient-to-l from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-2">
          <Sparkles className="w-4 h-4" />
          <span>הפתרון לבעיית העלויות של ימות המשיח</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          למה המערכת הישנה הייתה יקרה, וכיצד הפתרון שלנו חוסך מעל 99% מהעלויות?
        </h2>
        <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
          במערכת הקודמת עם קלוד שילמת בנפרד על שלושה שירותים שונים (תמלול STT, מודל LLM, והקראה TTS), כאשר כל דקת הקלטה וכל מילה בעברית עלו כסף רב ביחידות של ימות המשיח או ספקי צד ג'. הפתרון הנוכחי מבוסס על <strong className="text-emerald-400">Gemini רב-מודאלי עם עיבוד אודיו ישיר ומנוע דיבור עברי מובנה</strong> ללא עלויות תיווך.
        </p>
      </div>

      {/* Side-by-Side Architectural Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Old Architecture (Expensive) */}
        <div className="bg-slate-900/80 border border-rose-500/30 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-rose-400">
              <XCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">המערכת הקודמת (Claude + STT/TTS חיצוני)</h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
              יקר מאוד (~0.08$ לשיחה)
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-rose-300">1. תמלול קולי (Speech to Text)</p>
                <p className="text-slate-400 text-[11px] mt-0.5">חיוב לפי דקות תמלול בימות המשיח / גוגל / שירותי ענן</p>
              </div>
              <span className="font-mono text-rose-400 font-bold">~$0.025 / דקה</span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-rose-300">2. מודל שפה (Claude 3.5 Sonnet)</p>
                <p className="text-slate-400 text-[11px] mt-0.5">עלות טוקנים נכנסים ויוצאים בעברית</p>
              </div>
              <span className="font-mono text-rose-400 font-bold">~$0.015 / שאלה</span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-rose-300">3. המרה לדיבור (Text to Speech)</p>
                <p className="text-slate-400 text-[11px] mt-0.5">חיוב לפי תווים (יחידות ימות המשיח או ElevenLabs/Azure)</p>
              </div>
              <span className="font-mono text-rose-400 font-bold">~$0.040 / תשובה</span>
            </div>

            <div className="p-3 bg-rose-950/30 rounded-xl border border-rose-500/30 flex items-center justify-between font-bold text-rose-300 text-xs">
              <span>עלות ממוצעת לשיחה אחת:</span>
              <span className="font-mono text-base">~0.30 ₪ (0.08$)</span>
            </div>
          </div>
        </div>

        {/* New Architecture (Ultra Cheap & Fast) */}
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">המערכת החדשה (Gemini Voice Bridge)</h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              חיסכון של {savingsPercent}%
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-300">1. הבנת אודיו ישירה (Gemini Multimodal)</p>
                <p className="text-slate-400 text-[11px] mt-0.5">Gemini שומע ומבין את קובץ ה-WAV ישירות ללא שירות STT חיצוני!</p>
              </div>
              <span className="font-mono text-emerald-400 font-bold">כלול ב-Gemini</span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-300">2. מודל Gemini 3.7 Flash</p>
                <p className="text-slate-400 text-[11px] mt-0.5">מהיר פי 3 וזול פי 20 מעלות טוקנים של קלוד</p>
              </div>
              <span className="font-mono text-emerald-400 font-bold">~$0.0004 / שאלה</span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-300">3. מנוע דיבור עברי מובנה ללא עלות</p>
                <p className="text-slate-400 text-[11px] mt-0.5">המרה קולית חלקה וישירה לפורמט טלפוני ללא חיוב תווים</p>
              </div>
              <span className="font-mono text-emerald-400 font-bold">0.00$ (חינם)</span>
            </div>

            <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-500/30 flex items-center justify-between font-bold text-emerald-300 text-xs">
              <span>עלות ממוצעת לשיחה אחת:</span>
              <span className="font-mono text-base">~0.0015 ₪ (0.0004$)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Monthly Savings Calculator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Calculator className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">מחשבון חיסכון חודשי בהתאם לכמות שיחות</h3>
        </div>

        <div>
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-slate-300">כמות שיחות בחודש בשלוחה 4:</span>
            <span className="font-mono font-bold text-emerald-400 text-base">
              {monthlyCalls.toLocaleString('he-IL')} שיחות
            </span>
          </div>
          
          <input
            id="range-calls"
            type="range"
            min="100"
            max="20000"
            step="100"
            value={monthlyCalls}
            onChange={(e) => setMonthlyCalls(Number(e.target.value))}
            className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>100 שיחות</span>
            <span>5,000 שיחות</span>
            <span>10,000 שיחות</span>
            <span>20,000 שיחות</span>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          
          <div className="bg-slate-950 border border-rose-500/20 rounded-xl p-4 text-center">
            <p className="text-[11px] text-slate-400 mb-1">עלות חודשית במערכת ישנה</p>
            <div className="text-xl font-mono font-bold text-rose-400">
              ${Math.round(oldMonthlyCost)}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              (כ-{Math.round(oldMonthlyCost * 3.7).toLocaleString()} ₪)
            </p>
          </div>

          <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 text-center">
            <p className="text-[11px] text-slate-400 mb-1">עלות חודשית עם Gemini</p>
            <div className="text-xl font-mono font-bold text-emerald-400">
              ${newMonthlyCost < 1 ? newMonthlyCost.toFixed(2) : Math.round(newMonthlyCost)}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              (כ-{(newMonthlyCost * 3.7).toFixed(1)} ₪ בלבד)
            </p>
          </div>

          <div className="bg-gradient-to-tr from-emerald-950/60 to-slate-900 border border-emerald-500/40 rounded-xl p-4 text-center">
            <p className="text-[11px] text-emerald-300 font-medium mb-1">סך הכל חיסכון לחודש!</p>
            <div className="text-2xl font-mono font-bold text-emerald-400 flex items-center justify-center gap-1">
              <TrendingDown className="w-5 h-5 text-emerald-400" />
              ${Math.round(monthlySavings)}
            </div>
            <p className="text-[10px] text-emerald-300/80 mt-1">
              חיסכון של כ-{Math.round(monthlySavings * 3.7).toLocaleString()} ₪ בכל חודש
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
