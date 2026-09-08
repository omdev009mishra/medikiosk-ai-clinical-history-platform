export type InterviewStatus =
  | 'NOT_STARTED'
  | 'ACTIVE'
  | 'PATIENT_FINISHING'
  | 'READY_TO_COMPLETE'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'ERROR';

export interface InterviewOption {
  id: string;
  label: string;
  value: string;
}

export interface StandardizedQuestion {
  id: string;
  questionId: string;
  question: string;
  domain: string;
  field: string;
  text: string;
  answerType: 'TEXT' | 'YES_NO' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'SCALE';
  options: InterviewOption[];
  needsClarification?: boolean;
}

export interface StandardizedCompletion {
  detected: boolean;
  confirmationRequired?: boolean;
  reason?: string;
}

export interface InterviewTurnResponse {
  interviewStatus: string;
  status?: string;
  question: StandardizedQuestion;
  completion: StandardizedCompletion;
  completionDetected?: boolean;
  aiResponse: {
    message: string;
    question: string;
    expectsFreeText: boolean;
    suggestedAnswerType: string;
    options: InterviewOption[];
  };
  nextQuestion?: string;
  knownFacts: unknown[];
  state: InterviewState;
}

export type QuestionCategory =
  | 'CHIEF_COMPLAINT'
  | 'SYMPTOM_DETAILS'
  | 'HISTORY'
  | 'MEDICATIONS'
  | 'ALLERGIES'
  | 'OTHER';

export interface InterviewQuestion {
  id: string;
  questionId?: string;
  question: string;
  domain?: string;
  field?: string;
  purpose: string;
  category: QuestionCategory;
  askedAt: string;
}

export interface InterviewMessage {
  role: 'PATIENT' | 'ASSISTANT';
  content: string;
  timestamp: string;
}

export interface InterviewState {
  encounterId: string;
  status: InterviewStatus;
  chiefComplaint?: string;
  conversationHistory: InterviewMessage[];
  knownInformation: Record<string, any>;
  missingInformation: string[];
  askedQuestions: InterviewQuestion[];
  generatedFacts: string[];
  questionCount: number;
  maxQuestions: number;
  safetyFlags: Array<{ trigger: string; source: string; timestamp: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewAnalysis {
  chiefComplaint?: string;
  knownInformation: {
    duration?: string;
    location?: string;
    severity?: string | number;
    onset?: string;
    associatedSymptoms?: string[];
    patientProvidedDetails?: string[];
  };
  missingInformation: string[];
  nextQuestionNeeded: boolean;
  nextQuestion?: {
    question: string;
    purpose: string;
    category: QuestionCategory;
  };
  interviewComplete: boolean;
  safetySignals: string[];
}
