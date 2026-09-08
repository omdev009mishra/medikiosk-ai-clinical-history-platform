/**
 * Medical Interrogation Engine Type Definitions
 * Ported from medical-history-taking-assistant.zip
 * Standardized for MediKiosk Clinical History Platform
 */

export interface StructuredMedicalHistory {
  chiefComplaint?: string;
  presentIllness?: string;
  symptoms?: string[];
  duration?: string;
  onset?: string;
  location?: string;
  severity?: string;
  character?: string;
  timing?: string;
  progression?: string;
  associatedSymptoms?: string[];
  pastMedicalHistory?: string[] | string;
  pastSurgicalHistory?: string[] | string;
  medications?: string[] | string;
  allergies?: string[] | string;
  familyHistory?: string[] | string;
  socialHistory?: string[] | string;
  previousEpisodes?: string;
  redFlags?: string[];
  missingInformation?: string[];
  otherRelevantInformation?: string;
  [key: string]: any;
}

export interface MessageTurn {
  id?: string;
  role: 'assistant' | 'user';
  message: string;
  questionNumber?: number;
  optionsUsed?: string;
  language?: string;
  timestamp?: string;
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

export interface InterrogationTurnParams {
  history: MessageTurn[];
  latestAnswer: string;
  questionNumber: number;
  structuredHistory: StructuredMedicalHistory;
  language?: string;
  isInitial?: boolean;
  isLanguageSwitch?: boolean;
  /** Optional previous OCR documents / clinical records context */
  priorOcrContext?: string;
}

export interface SummaryGenerationParams {
  history: MessageTurn[];
  structuredHistory: StructuredMedicalHistory;
  language?: string;
  priorOcrContext?: string;
}

export interface ComprehensiveMedicalReport {
  chiefComplaint: string;
  presentIllness: string;
  symptoms: string[];
  duration: string;
  severity: string;
  location: string;
  associatedSymptoms: string[];
  pastMedicalHistory: string[];
  pastSurgicalHistory: string[];
  medications: string[];
  allergies: string[];
  familyHistory: string[];
  socialHistory: string[];
  redFlags: string[];
  missingInformation: string[];
  conversationStatus: 'ACTIVE' | 'COMPLETED' | 'URGENT_STOP';
  rawConversation: Array<{ role: string; content: string; timestamp?: string }>;
}
