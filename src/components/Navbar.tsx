import React, { useState } from 'react';
import { Phone, Radio, Settings, FileCode, BarChart3, ListFilter, Copy, Check, Sparkles } from 'lucide-react';

interface NavbarProps {
  activeTab: 'simulator' | 'yemot-setup' | 'cost-comparison' | 'logs' | 'tester';
  setActiveTab: (tab: 'simulator' | 'yemot-setup' | 'cost-comparison' | 'logs' | 'tester') => void;
  onOpenSettings: () => void;
  webhookUrl: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  webhookUrl,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <Phone className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <span>AI טלפוני קולי</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    ימות המשיח
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">מענה קולי חכם לטלפונים כשרים ללא אינטרנט • מבוסס Gemini</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              id="tab-simulator"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'simulator'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              סימולטור שיחה
            </button>

            <button
              id="tab-yemot-setup"
              onClick={() => setActiveTab('yemot-setup')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'yemot-setup'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              הגדרות שלוחות (4 ו-6)
            </button>

            <button
              id="tab-cost-comparison"
              onClick={() => setActiveTab('cost-comparison')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'cost-comparison'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              חיסכון בעלויות
            </button>

            <button
              id="tab-logs"
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'logs'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              יומן שיחות
            </button>

            <button
              id="tab-tester"
              onClick={() => setActiveTab('tester')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'tester'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              בדיקת Webhook
            </button>
          </nav>

          {/* Webhook URL pill & Settings */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400 font-mono text-[11px] truncate max-w-[200px]" dir="ltr">
                {webhookUrl}
              </span>
              <button
                onClick={handleCopyWebhook}
                title="העתק כתובת Webhook עבור ימות המשיח"
                className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              id="btn-settings"
              onClick={onOpenSettings}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all flex items-center gap-1.5 text-xs font-medium"
              title="הגדרות קול והוראות ל-AI"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">הגדרות</span>
            </button>
          </div>

        </div>

        {/* Mobile Nav Tabs */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1.5 border-t border-slate-800/60 scrollbar-none">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'simulator' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}
          >
            סימולטור שיחה
          </button>
          <button
            onClick={() => setActiveTab('yemot-setup')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'yemot-setup' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}
          >
            הגדרות שלוחה 4
          </button>
          <button
            onClick={() => setActiveTab('cost-comparison')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'cost-comparison' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}
          >
            חיסכון בעלויות
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'logs' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}
          >
            יומן שיחות
          </button>
          <button
            onClick={() => setActiveTab('tester')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === 'tester' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}
          >
            בדיקת Webhook
          </button>
        </div>

      </div>
    </header>
  );
};
