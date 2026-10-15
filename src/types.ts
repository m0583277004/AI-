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
  dispatchAction?: {
    channel: 'whatsapp' | 'email';
    recipient: string;
    sender?: string;
    status: 'sent' | 'delivered' | 'simulated' | 'failed';
    previewUrl?: string | false;
    audioUrl?: string;
    transcript?: string;
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
  defaultWhatsAppSender?: string;
  defaultEmailSender?: string;
  defaultRecipientEmail?: string;
  whatsappProvider?: 'simulated' | 'green-api' | 'callmebot' | 'twilio' | 'custom-webhook';
  whatsappApiKey?: string;
}

export interface YemotConfigOptions {
  extensionNumber: string;
  webhookUrl: string;
  recordTimeoutSeconds: number;
  maxRecordSeconds: number;
  beepBeforeRecord: boolean;
  allowDtmfExit: boolean;
}

export interface ExtensionProfile {
  extension: string;
  name: string;
  description: string;
  badge: string;
  modelType: string;
  welcomeMessage: string;
  noSpeechMessage: string;
  systemPrompt: string;
  models: string[];
  temperature: number;
  maxTokens: number;
  voiceSpeed: number;
  timeoutMs: number;
}
