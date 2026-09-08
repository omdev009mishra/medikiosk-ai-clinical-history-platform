export interface StructuredMedicalHistory {
  chiefComplaint?: string;
  symptoms?: string[];
  duration?: string;
  onset?: string;
  location?: string;
  severity?: string;
  character?: string;
  timing?: string;
  progression?: string;
  associatedSymptoms?: string[];
  medicalHistory?: string;
  medications?: string;
  allergies?: string;
  previousEpisodes?: string;
  otherRelevantInformation?: string;
  [key: string]: any;
}

export interface MessageTurn {
  id: string;
  role: 'assistant' | 'user';
  message: string;
  questionNumber?: number;
  optionsUsed?: string;
  language?: string;
  timestamp: string;
}

export interface SummarySection {
  label: string;
  value: string;
}

export interface FinalMedicalSummary {
  title: string;
  chiefComplaint: string;
  sections: SummarySection[];
  disclaimer: string;
  language?: string;
}

export interface GeminiResponse {
  status: 'continue' | 'complete' | 'urgent_stop';
  language?: string;
  detectedLanguage?: string;
  inputStyle?: 'hinglish' | 'native' | 'mixed' | 'english' | string;
  questionNumber: number;
  assistantMessage: string;
  options: string[];
  riskLevel: 'normal' | 'urgent';
  urgentReason?: string;
  reasonForQuestion?: string;
  extractedFromLastAnswer?: Record<string, any>;
  structuredHistory?: StructuredMedicalHistory;
  finalSummary?: FinalMedicalSummary;
  error?: string;
}

export type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'READY';

export type AppScreen = 'welcome' | 'conversation' | 'urgent_alert' | 'summary';
