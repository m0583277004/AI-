import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { PhoneSimulator } from './components/PhoneSimulator';
import { YemotSetupGuide } from './components/YemotSetupGuide';
import { CostComparison } from './components/CostComparison';
import { CallLogs } from './components/CallLogs';
import { WebhookTester } from './components/WebhookTester';
import { SettingsModal } from './components/SettingsModal';
import { Phone, CheckCircle2, TrendingDown, Clock, Zap, Sparkles, Radio, ArrowLeft } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'yemot-setup' | 'cost-comparison' | 'logs' | 'tester'>('simulator');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [stats, setStats] = useState<{
    totalCalls: number;
    totalDurationMinutes: number;
    totalSavedUsd: number;
    avgLatencyMs: number;
    activeModel: string;
  }>({
    totalCalls: 0,
    totalDurationMinutes: 0,
    totalSavedUsd: 0,
    avgLatencyMs: 0,
    activeModel: 'gemini-3.7-flash',
  });

  const [webhookUrl, setWebhookUrl] = useState<string>('');

  useEffect(() => {
    // Fetch live public webhook URL
    const fetchWebhookUrl = async () => {
      try {
        const res = await fetch('/api/tunnel/info');
        if (res.ok) {
          const data = await res.json();
          if (data.webhookUrl) {
            setWebhookUrl(data.webhookUrl);
            return;
          }
        }
      } catch (e) {}
      const origin = window.location.origin;
      setWebhookUrl(`${origin}/api/yemot/ivr`);
    };

    fetchWebhookUrl();
    const tunnelInterval = setInterval(fetchWebhookUrl, 5000);

    fetchStats();
    const interval = setInterval(fetchStats, 6000);
    return () => {
      clearInterval(interval);
      clearInterval(tunnelInterval);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Heebo',sans-serif]">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        webhookUrl={webhookUrl}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">שיחות שטופלו</p>
              <p className="text-base font-bold font-mono text-white mt-0.5">{stats.totalCalls}</p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <TrendingDown className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">חיסכון משוער</p>
              <p className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                ${stats.totalSavedUsd.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">זמן תגובה ממוצע</p>
              <p className="text-base font-bold font-mono text-white mt-0.5">
                {stats.avgLatencyMs > 0 ? `${stats.avgLatencyMs}ms` : '< 1.2s'}
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">שלוחה בימות</p>
              <p className="text-base font-bold text-teal-400 mt-0.5 flex items-center gap-1">
                <span>שלוחה 4</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              </p>
            </div>
          </div>

        </div>

        {/* Tab Content Display */}
        {activeTab === 'simulator' && (
          <PhoneSimulator onCallCompleted={fetchStats} />
        )}

        {activeTab === 'yemot-setup' && (
          <YemotSetupGuide webhookUrl={webhookUrl} />
        )}

        {activeTab === 'cost-comparison' && (
          <CostComparison />
        )}

        {activeTab === 'logs' && (
          <CallLogs />
        )}

        {activeTab === 'tester' && (
          <WebhookTester webhookUrl={webhookUrl} />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/50 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AI טלפוני קולי • מותאם במיוחד למערכות IVR של ימות המשיח ולטלפונים כשרים ללא אינטרנט</span>
          <span className="font-mono text-[11px]">מופעל ע"י Google Gemini 3.7 Flash</span>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={fetchStats}
      />

    </div>
  );
}
