export interface CallLog {
  id: string;
  callerPhone: string;
  callerDid?: string;
  callId?: string;
  extension: string;
  timestamp: number;
  durationSeconds: number;
  questionText?: string;
  questionAudioUrl?: string;
  responseText: string;
  responseAudioUrl?: string;
  status: 'completed' | 'processing' | 'failed';
  latencyMs: number;
  tokensUsed?: number;
  costEstimateUsd?: number;
  costSavedUsd?: number;
  emailAction?: {
    targetEmail: string;
    status: string;
    previewUrl?: string | false;
  };
}

export interface AssistantSettings {
  systemPrompt: string;
  welcomeMessage: string;
  noSpeechMessage: string;
  farewellMessage: string;
  voiceGender: 'female' | 'male';
  voiceSpeed: number;
  maxTokens: number;
  temperature: number;
  saveRecordings: boolean;
  model: string;
}

export interface YemotConfigOptions {
  extensionNumber: string;
  webhookUrl: string;
  recordTimeoutSeconds: number;
  maxRecordSeconds: number;
  beepBeforeRecord: boolean;
  allowDtmfExit: boolean;
}

export interface CallSimulationState {
  status: 'idle' | 'calling' | 'connected' | 'listening' | 'processing' | 'speaking' | 'ended';
  callerNumber: string;
  callDuration: number;
  currentStep: string;
  transcriptHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    text: string;
    audioUrl?: string;
    timestamp: number;
  }>;
}
