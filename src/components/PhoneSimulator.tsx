import React, { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Sparkles, Send, RotateCcw, Activity, ShieldCheck, Clock, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PhoneSimulatorProps {
  onCallCompleted?: () => void;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({ onCallCompleted }) => {
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'recording' | 'processing' | 'speaking'>('idle');
  const [phoneNumber, setPhoneNumber] = useState('058-3277004');
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [textInput, setTextInput] = useState('');
  
  const [transcriptHistory, setTranscriptHistory] = useState<Array<{
    role: 'user' | 'assistant' | 'system';
    text: string;
    audioUrl?: string;
    timestamp: string;
    latencyMs?: number;
  }>>([]);

  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Call duration timer
  useEffect(() => {
    if (callState !== 'idle') {
      timerIntervalRef.current = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
      setCallSeconds(0);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [callState]);

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start Call Flow
  const handleStartCall = () => {
    setCallState('calling');
    setTranscriptHistory([]);

    // Simulate ringing then connect
    setTimeout(() => {
      setCallState('connected');
      
      const welcomeText = 'שלום וברוכים הבאים לעוזר הקולי החכם. אנא אמור את שאלתך לאחר הצליל.';
      playAssistantResponse(
        welcomeText,
        undefined
      );
      
      setTranscriptHistory([
        {
          role: 'system',
          text: 'שיחה מחוברת למערכת ימות המשיח (שלוחה 4)',
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        {
          role: 'assistant',
          text: welcomeText,
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        }
      ]);

      // Request TTS for the welcome message
      fetch('/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: welcomeText }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.audioUrl) {
            playAudioFromUrl(data.audioUrl);
          }
        })
        .catch((e) => console.error('Welcome TTS error:', e));

    }, 1500);
  };

  // End Call
  const handleHangup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setCallState('idle');
    setIsPlayingAudio(false);
    if (onCallCompleted) onCallCompleted();
  };

  // Start recording from browser microphone
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
        await sendAudioQuery(audioBlob);
      };

      mediaRecorder.start();
      setCallState('recording');
    } catch (err) {
      console.error('Microphone access denied or failed:', err);
      alert('לא ניתנה הרשאת מיקרופון בדפדפן. ניתן להקליד את השאלה בתיבת הטקסט.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setCallState('processing');
    }
  };

  // Send audio recording to backend
  const sendAudioQuery = async (audioBlob: Blob) => {
    setCallState('processing');
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const res = await fetch('/api/voice/process', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');

      setTranscriptHistory((prev) => [
        ...prev,
        {
          role: 'user',
          text: data.transcript || 'שאלה קולית שהוקלטה במיקרופון',
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        },
        {
          role: 'assistant',
          text: data.textResponse,
          audioUrl: data.audioUrl,
          latencyMs: data.latencyMs,
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (data.audioUrl) {
        playAudioFromUrl(data.audioUrl);
      } else {
        setCallState('connected');
      }

      if (onCallCompleted) onCallCompleted();
    } catch (err: any) {
      console.error('Error sending audio query:', err);
      setTranscriptHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'סליחה, חלה שגיאה בעיבוד השאלה הקולית. אנא נסו שוב.',
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setCallState('connected');
    }
  };

  // Send text query (fallback)
  const handleSendText = async () => {
    if (!textInput.trim() || callState === 'idle' || callState === 'processing') return;

    const query = textInput.trim();
    setTextInput('');
    setCallState('processing');

    try {
      const res = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');

      setTranscriptHistory((prev) => [
        ...prev,
        {
          role: 'user',
          text: query,
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        },
        {
          role: 'assistant',
          text: data.textResponse,
          audioUrl: data.audioUrl,
          latencyMs: data.latencyMs,
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (data.audioUrl) {
        playAudioFromUrl(data.audioUrl);
      } else {
        setCallState('connected');
      }

      if (onCallCompleted) onCallCompleted();
    } catch (err) {
      console.error('Error sending text:', err);
      setCallState('connected');
    }
  };

  const playAudioFromUrl = (url: string) => {
    setCurrentAudioUrl(url);
    setCallState('speaking');
    setIsPlayingAudio(true);

    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.play().catch((err) => {
        console.error('Audio autoplay blocked:', err);
        setIsPlayingAudio(false);
        setCallState('connected');
      });
    }
  };

  const playAssistantResponse = (text: string, audioUrl?: string) => {
    if (audioUrl) {
      playAudioFromUrl(audioUrl);
    }
  };

  // Sample prompt buttons
  const sampleQuestions = [
    'מה הזמן של שקיעת החמה היום בירושלים?',
    'מה המתכון המוצלח ביותר לעוגת שמרים?',
    'ספר לי בקצרה על מהלך המהפכה התעשייתית',
    'מה ההבדל בין חמאה למרגרינה במאפים?',
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <audio
        ref={audioPlayerRef}
        onEnded={() => {
          setIsPlayingAudio(false);
          setCallState('connected');
        }}
        className="hidden"
      />

      {/* Left / Center Column: Phone Dialer Device Mockup */}
      <div className="lg:col-span-5 flex flex-col items-center">
        <div className="w-full max-w-[360px] bg-slate-900 rounded-[2.5rem] p-4 border-4 border-slate-700 shadow-2xl shadow-emerald-500/5 relative overflow-hidden ring-1 ring-slate-800">
          
          {/* Phone Top Notch / Speaker Grill */}
          <div className="flex justify-center items-center gap-2 mb-3">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full"></div>
            <div className="w-2.5 h-2.5 bg-slate-800 rounded-full"></div>
          </div>

          {/* Phone Screen Canvas */}
          <div className="bg-slate-950 rounded-[1.8rem] border border-slate-800 p-4 min-h-[460px] flex flex-col justify-between text-center relative overflow-hidden">
            
            {/* Screen Header / Status */}
            <div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-2">
                <span>019 / Kosher SIM</span>
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  HD Voice
                </span>
                <span>100%</span>
              </div>

              {/* Call Status Badge */}
              <div className="mt-2">
                {callState === 'idle' && (
                  <div className="py-2">
                    <span className="text-xs font-medium text-slate-400">חיוג למערכת ימות המשיח</span>
                    <h3 className="text-xl font-mono font-bold text-white tracking-widest mt-1">
                      {phoneNumber}
                    </h3>
                    <p className="text-[11px] text-emerald-400/90 mt-1">שלוחה 4 • מענה קולי מבוסס Gemini</p>
                  </div>
                )}

                {callState === 'calling' && (
                  <div className="py-3">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-2 border border-emerald-500/40"
                    >
                      <Phone className="w-6 h-6 animate-pulse" />
                    </motion.div>
                    <span className="text-xs text-emerald-400 font-medium animate-pulse">מחייג...</span>
                    <h3 className="text-lg font-mono font-bold text-white">{phoneNumber}</h3>
                  </div>
                )}

                {callState !== 'idle' && callState !== 'calling' && (
                  <div className="py-1">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>בשיחה פעילה • שלוחה 4</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-white mt-1">
                      {formatCallTime(callSeconds)}
                    </div>
                    
                    {/* Active State Indicator */}
                    <div className="mt-2 text-xs">
                      {callState === 'connected' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          ממתין לשאלתך...
                        </span>
                      )}
                      {callState === 'recording' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                          מקליט את השאלה... (שחרר לסיום)
                        </span>
                      )}
                      {callState === 'processing' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          מעבד תשובה ב-Gemini...
                        </span>
                      )}
                      {callState === 'speaking' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center gap-1 mx-auto w-fit">
                          <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                          משמיע תשובה קולית
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Middle Screen Display: Audio Waveform / Visualizer */}
            <div className="my-auto py-4">
              {callState === 'recording' && (
                <div className="flex items-center justify-center gap-1.5 h-16">
                  {[40, 75, 95, 60, 85, 100, 70, 90, 45, 80].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [`${h * 0.2}%`, `${h}%`, `${h * 0.4}%`] }}
                      transition={{ repeat: Infinity, duration: 0.6 + i * 0.08, ease: 'easeInOut' }}
                      className="w-1.5 bg-gradient-to-t from-rose-500 to-amber-400 rounded-full"
                    />
                  ))}
                </div>
              )}

              {callState === 'speaking' && (
                <div className="flex items-center justify-center gap-1.5 h-16">
                  {[50, 90, 70, 100, 60, 85, 95, 40, 80, 65].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [`${h * 0.3}%`, `${h}%`, `${h * 0.2}%`] }}
                      transition={{ repeat: Infinity, duration: 0.5 + i * 0.07, ease: 'easeInOut' }}
                      className="w-1.5 bg-gradient-to-t from-emerald-500 to-teal-300 rounded-full"
                    />
                  ))}
                </div>
              )}

              {callState === 'processing' && (
                <div className="flex flex-col items-center justify-center py-4 gap-2">
                  <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
                  <span className="text-xs text-amber-400">מעבד אודיו ומייצר מענה קולי...</span>
                </div>
              )}

              {(callState === 'idle' || callState === 'calling' || callState === 'connected') && (
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-right">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {callState === 'idle'
                      ? 'לחצו על כפתור החיוג כדי להתחיל שיחה ולדבר עם העוזר הקולי.'
                      : 'הקליטו את שאלתכם באמצעות כפתור המיקרופון (או הקלידו למטה).'}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Controls / Call Actions */}
            <div className="pt-2 border-t border-slate-800/80">
              {callState === 'idle' ? (
                <button
                  id="btn-call-start"
                  onClick={handleStartCall}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-transform active:scale-95 text-sm"
                >
                  <Phone className="w-5 h-5 fill-slate-950" />
                  התחל שיחה קולית
                </button>
              ) : (
                <div className="space-y-2">
                  {/* Push-to-talk Voice Button */}
                  {callState !== 'recording' ? (
                    <button
                      id="btn-voice-record-start"
                      onClick={startRecording}
                      disabled={callState === 'processing' || callState === 'calling'}
                      className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs disabled:opacity-50"
                    >
                      <Mic className="w-4 h-4" />
                      לחץ להקלטת שאלה קולית
                    </button>
                  ) : (
                    <button
                      id="btn-voice-record-stop"
                      onClick={stopRecording}
                      className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 transition-all active:scale-95 text-xs animate-pulse"
                    >
                      <MicOff className="w-4 h-4" />
                      סיים הקלטה ושלח ל-AI
                    </button>
                  )}

                  {/* Hangup button */}
                  <button
                    id="btn-call-hangup"
                    onClick={handleHangup}
                    className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs"
                  >
                    <PhoneOff className="w-4 h-4" />
                    נתק שיחה
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Phone Bottom Home Bar */}
          <div className="w-24 h-1 bg-slate-700 rounded-full mx-auto mt-3"></div>
        </div>
      </div>

      {/* Right Column: Live Transcript, Quick Prompts & Call Metrics */}
      <div className="lg:col-span-7 space-y-4">
        
        {/* Main Conversation Transcript Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
              <h2 className="text-sm font-bold text-white">תמליל השיחה בזמן אמת</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {transcriptHistory.length} הודעות
            </span>
          </div>

          {/* Transcript Scroll Area */}
          <div className="min-h-[260px] max-h-[340px] overflow-y-auto py-3 space-y-3 pr-1 scrollbar-thin">
            {transcriptHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-500">
                <Phone className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">השיחה טרם החלה. לחצו על 'התחל שיחה' כדי לשמוע את המענה הקולי.</p>
              </div>
            ) : (
              transcriptHistory.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    item.role === 'user'
                      ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-100 ml-6'
                      : item.role === 'assistant'
                      ? 'bg-slate-800/80 border border-slate-700 text-slate-100 mr-6'
                      : 'bg-slate-950 text-slate-400 text-center border border-slate-800 text-[11px]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 opacity-70 text-[10px]">
                    <span className="font-semibold">
                      {item.role === 'user' ? 'המתקשר (קול)' : item.role === 'assistant' ? 'עוזר קולי Gemini' : 'מערכת'}
                    </span>
                    <span>{item.timestamp}</span>
                  </div>
                  <p className="text-sm font-medium">{item.text}</p>
                  {item.audioUrl && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center gap-2">
                      <button
                        onClick={() => playAudioFromUrl(item.audioUrl!)}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1 transition-colors"
                      >
                        <Volume2 className="w-3 h-3" />
                        השמע שוב
                      </button>
                      {item.latencyMs && (
                        <span className="text-[10px] text-slate-400">
                          זמן תגובה: {item.latencyMs}ms
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {/* Text Input Fallback */}
          <div className="pt-3 border-t border-slate-800">
            <div className="flex gap-2">
              <input
                id="input-text-prompt"
                type="text"
                placeholder={callState === 'idle' ? 'יש להתחיל שיחה תחילה...' : 'הקלדת שאלה (לחלופין מהקלטה קולית)...'}
                value={textInput}
                disabled={callState === 'idle' || callState === 'processing'}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-40"
              />
              <button
                id="btn-send-text"
                onClick={handleSendText}
                disabled={!textInput.trim() || callState === 'idle' || callState === 'processing'}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all disabled:opacity-40 flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>שלח</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Sample Questions Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            שאלות לדוגמה לבדיקת המענה הקולי:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sampleQuestions.map((q, i) => (
              <button
                key={i}
                disabled={callState === 'idle' || callState === 'processing'}
                onClick={() => {
                  setTextInput(q);
                }}
                className="text-right p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-white text-xs transition-all disabled:opacity-40 truncate"
              >
                "{q}"
              </button>
            ))}
          </div>
        </div>

        {/* Performance & Architecture Highlights */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <div className="text-[11px] text-slate-400">מודל AI ראשי</div>
            <div className="text-xs font-bold text-white mt-0.5">Gemini 3.7 Flash</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <Clock className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <div className="text-[11px] text-slate-400">תמיכה בקבצי IVR</div>
            <div className="text-xs font-bold text-white mt-0.5">MP3 / WAV 8000Hz</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <ShieldCheck className="w-4 h-4 text-teal-400 mx-auto mb-1" />
            <div className="text-[11px] text-slate-400">תאימות טלפונית</div>
            <div className="text-xs font-bold text-white mt-0.5">100% טלפון כשר</div>
          </div>
        </div>

      </div>
    </div>
  );
};
