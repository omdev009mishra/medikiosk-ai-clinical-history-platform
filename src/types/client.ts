export type LanguageCode = 'hi' | 'en' | 'mr' | 'gu' | 'bn' | 'ta' | 'te';
export type IntakeMode = 'GENERAL' | 'AYUSH';
export type DataSource = 'PATIENT_VOICE' | 'PATIENT_TOUCH' | 'DOCUMENT_OCR' | 'AI_EXTRACTION' | 'DOCTOR_EDIT';
export type SummaryStatus = 'DRAFT' | 'VERIFIED' | 'REJECTED';
export type TriagePriority = 'NORMAL' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

export interface Patient {
  id: string;
  abhaId?: string;
  abhaAddress?: string;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  address?: string;
  registeredAt: string;
}

export interface ChiefComplaint {
  value: string;
  duration: string;
  source: DataSource;
  confidence?: number;
}

export interface StructuredHPI {
  site?: string;
  onset?: string;
  character?: string;
  radiation?: string;
  associatedSymptoms?: string[];
  timing?: string;
  exacerbatingFactors?: string[];
  relievingFactors?: string[];
  severity?: number;
  notes?: string;
}

export interface MedicationItem {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  sourceDocument?: string;
  source: DataSource;
}

export interface AllergyItem {
  allergen: string;
  reaction?: string;
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  source: DataSource;
}

export interface InvestigationItem {
  id: string;
  testName: string;
  result: string;
  unit?: string;
  referenceRange?: string;
  status: 'NORMAL' | 'HIGH' | 'LOW' | 'ABNORMAL' | 'PENDING';
  date?: string;
  sourceDocument?: string;
  source: DataSource;
}

export interface DashavidhaPariksha {
  prakriti?: string;
  vikriti?: string;
  sara?: string;
  samhanana?: string;
  pramana?: string;
  satmya?: string;
  sattva?: string;
  aharaShakti?: string;
  vyayamaShakti?: string;
  vaya?: string;
  agni?: string;
  koshtha?: string;
  aharaVihara?: {
    dietPreference?: string;
    foodHabits?: string;
    sleepPattern?: string;
    bowelHabit?: string;
    stressLevel?: string;
  };
}

export interface ClinicalHistoryState {
  chiefComplaint?: ChiefComplaint;
  hpi: StructuredHPI;
  pastMedicalHistory: string[];
  pastSurgicalHistory: string[];
  medications: MedicationItem[];
  allergies: AllergyItem[];
  familyHistory: string[];
  personalHistory: {
    smoking?: boolean | string;
    alcohol?: boolean | string;
    diet?: string;
    physicalActivity?: string;
  };
  reviewOfSystems: {
    cardiovascular?: string[];
    respiratory?: string[];
    gastrointestinal?: string[];
    neurological?: string[];
    musculoskeletal?: string[];
    general?: string[];
  };
  ayushHistory?: DashavidhaPariksha;
}

export interface DocumentRecord {
  id: string;
  patientId: string;
  encounterId: string;
  documentType: 'PRESCRIPTION' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'PROCEDURE_RECORD' | 'OTHER';
  fileName: string;
  mimeType: string;
  uploadDate: string;
  extractedText?: string;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  previewDataUri?: string;
  extractedEntities?: {
    diagnoses: Array<{ name: string; date?: string; confidence: number }>;
    medications: MedicationItem[];
    investigations: InvestigationItem[];
    procedures: Array<{ name: string; date?: string; provider?: string }>;
    notes?: string;
  };
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  category: 'ADMISSION' | 'PRESCRIPTION' | 'INVESTIGATION' | 'PROCEDURE' | 'DISCHARGE' | 'INTAKE';
  description: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  isAbnormal?: boolean;
}

export interface RedFlagAlert {
  id: string;
  severity: TriagePriority;
  category: 'CARDIAC' | 'NEUROLOGICAL' | 'RESPIRATORY' | 'ABDOMINAL' | 'SEPSIS' | 'TRAUMA' | 'ANAPHYLAXIS' | 'OTHER';
  title: string;
  description: string;
  matchedSymptoms: string[];
  recommendedAction: string;
  triggeredAt: string;
}

export interface AIClinicalSummary {
  id: string;
  encounterId: string;
  patientId: string;
  status: SummaryStatus;
  generatedAt: string;
  generatedBy: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  doctorNotes?: string;
  sections: {
    chiefComplaint: string;
    historyOfPresentIllness: string;
    pastMedicalHistory: string;
    pastSurgicalHistory: string;
    drugHistory: string;
    allergyHistory: string;
    familyHistory: string;
    personalHistory: string;
    reviewOfSystems: string;
    ayushHistory?: string;
    priorInvestigations: string;
    currentMedications: string;
    medicalTimelineSummary: string;
    redFlagsIdentified: string;
    provisionalClinicalNotes?: string;
  };
}

export interface ClinicalDataQuality {
  ocrQuality?: number;
  sourceReliabilityWeight?: number;
  completenessScore?: number;
  extractionConfidence?: number;
  needsReview: boolean;
}

export interface ClinicalFact {
  id: string;
  encounterId: string;
  patientId: string;
  type: string;
  value: any;
  normalizedValue?: any;
  source: string;
  sourceReference?: string;
  createdAt: string;
  dataQuality?: ClinicalDataQuality;
  confidence: {
    overall: number;
    source?: number;
    ocr?: number;
    ai?: number;
    completeness?: number;
  };
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  verificationStatus: 'UNVERIFIED' | 'PATIENT_CONFIRMED' | 'DOCTOR_VERIFIED' | 'CONFLICTED' | 'NEEDS_REVIEW' | 'REJECTED';
  reviewRequired: boolean;
  metadata?: Record<string, any>;
}

export type InterviewStatus =
  | 'NOT_STARTED'
  | 'COLLECTING'
  | 'READY_FOR_PATIENT_REVIEW'
  | 'COMPLETED'
  | 'ESCALATED';

export type QuestionCategory =
  | 'CHIEF_COMPLAINT'
  | 'SYMPTOM_DETAILS'
  | 'HISTORY'
  | 'MEDICATIONS'
  | 'ALLERGIES'
  | 'OTHER';

export interface InterviewQuestion {
  id: string;
  question: string;
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

export interface ClinicalContradiction {
  id: string;
  encounterId: string;
  category: 'MEDICATION' | 'ALLERGY' | 'TIMELINE' | 'LAB_RESULT' | 'DIAGNOSIS' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  factIds: string[];
  sources: string[];
  status: 'OPEN' | 'PATIENT_RESOLVED' | 'DOCTOR_RESOLVED';
  reviewRequired: boolean;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  encounterId: string;
  type: 'CONTRADICTION' | 'LOW_CONFIDENCE_FACT' | 'MISSING_CRITICAL_FIELD' | 'UNVERIFIED_CRITICAL_FACT';
  priorityScore: number;
  reviewPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  description: string;
  contradictionId?: string;
  factId?: string;
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
}

export interface EncounterValidationState {
  facts: ClinicalFact[];
  contradictions: ClinicalContradiction[];
  reviewQueue: ReviewItem[];
  overallValidationStatus: 'PASSED' | 'NEEDS_REVIEW' | 'CRITICAL_CONFLICTS';
  lastValidatedAt: string;
}

export interface ClinicalBriefItem {
  id: string;
  factId?: string;
  label: string;
  value: string;
  rawSourceText?: string;
  source: string;
  sourceReference?: string;
  verificationStatus: string;
  reviewRequired: boolean;
  criticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dataQuality?: ClinicalDataQuality;
  doctorEditedValue?: string;
  metadata?: Record<string, any>;
}

export interface ClinicalBriefSection {
  id: string;
  title: string;
  items: ClinicalBriefItem[];
  reviewRequired: boolean;
  reviewCount?: number;
  sectionNotes?: string;
}

export interface PatientSummarySection {
  patientId: string;
  name: string;
  age: number;
  gender: string;
  abhaId?: string;
  tokenNumber: string;
  intakeMode: IntakeMode;
  language: LanguageCode;
}

export interface ClinicalDocumentSummary {
  id: string;
  fileName: string;
  documentType: string;
  uploadDate: string;
  ocrQuality?: number;
  processingStatus: string;
  extractedFactsCount: number;
  needsReview: boolean;
}

export interface ClinicalReviewSummary {
  urgentAlertsCount: number;
  highAlertsCount: number;
  openContradictionsCount: number;
  unverifiedFactsCount: number;
  overallStatus: 'PASSED' | 'NEEDS_REVIEW' | 'CRITICAL_CONFLICTS';
}

export interface ClinicalBriefProvenance {
  generatedAt: string;
  factsCount: number;
  sourcesUsed: string[];
  isLocalOnly: boolean;
}

export interface ClinicalBrief {
  encounterId: string;
  patientId: string;
  generatedAt: string;
  patientSummary: PatientSummarySection;
  chiefComplaint?: ClinicalBriefItem;
  currentSymptoms: ClinicalBriefSection;
  historyOfPresentIllness: ClinicalBriefSection;
  reviewAlerts: ClinicalBriefSection;
  allergies: ClinicalBriefSection;
  medications: ClinicalBriefSection;
  pastMedicalHistory: ClinicalBriefSection;
  labResults: ClinicalBriefSection;
  documents: ClinicalDocumentSummary[];
  timeline: TimelineEvent[];
  reviewSummary: ClinicalReviewSummary;
  provenance: ClinicalBriefProvenance;
}

export interface ClinicalAuditEvent {
  id: string;
  encounterId: string;
  factId?: string;
  action: 'CREATED' | 'PATIENT_CONFIRMED' | 'DOCTOR_VERIFIED' | 'DOCTOR_EDITED' | 'DOCTOR_REJECTED' | 'FLAGGED_FOR_REVIEW';
  previousValue?: any;
  newValue?: any;
  performedByRole: 'SYSTEM' | 'PATIENT' | 'DOCTOR';
  performedById?: string;
  performedAt: string;
  notes?: string;
}

export interface ClinicalEncounter {
  id: string;
  patientId: string;
  status: 'INTAKE_IN_PROGRESS' | 'AWAITING_DOCTOR_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EMERGENCY';
  mode: IntakeMode;
  language: LanguageCode;
  tokenNumber: string;
  consent: {
    patientId: string;
    encounterId: string;
    purposes: string[];
    consentVersion: string;
    language: LanguageCode;
    method: string;
    status: 'GRANTED' | 'REVOKED';
    grantedAt: string;
  };
  history: ClinicalHistoryState;
  documents: DocumentRecord[];
  timeline: TimelineEvent[];
  alerts: RedFlagAlert[];
  summary?: AIClinicalSummary;
  validation?: EncounterValidationState;
  brief?: ClinicalBrief;
  createdAt: string;
  updatedAt: string;
  assignedDoctorId?: string;
  hisSyncStatus?: 'PENDING' | 'SYNCED' | 'FAILED';
  abdmBundleId?: string;
  triageCategory?: 'CASUALTY' | 'PRIORITY' | 'ROUTINE' | 'EMERGENCY';
  isEmergency?: boolean;
  emergencyDetails?: {
    detectedAt: string;
    matchedCategory: string;
    matchedSymptoms: string[];
    staffNotified?: boolean;
    staffNotifiedAt?: string;
    locationNotice?: string;
  };
}

export type TriageCategory = 'CASUALTY' | 'PRIORITY' | 'ROUTINE' | 'EMERGENCY';

export interface QuestionDefinition {
  id: string;
  field: string;
  category: string;
  prompt: {
    en: string;
    hi: string;
  };
  inputType: 'CHOICE' | 'SCALE_10' | 'DURATION' | 'MULTI_CHOICE' | 'TEXT_VOICE';
  options?: Array<{ label: { en: string; hi: string }; value: any; icon?: string }>;
}

export interface AuditLog {
  id: string;
  actor: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'SYSTEM';
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface DoctorUser {
  id: string;
  name: string;
  regNo: string;
  hprId: string;
  council?: string;
  qualification?: string;
  department: string;
  chamber: string;
  role: 'PHYSICIAN' | 'CHIEF_CONSULTANT' | 'RESIDENT';
  status: 'ACTIVE' | 'ON_DUTY' | 'ON_LEAVE' | 'SUSPENDED';
  phone?: string;
  email?: string;
  pin?: string;
  avatarInitials: string;
  joinedAt?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  designation: string;
  hfrFacilityId: string;
  facilityName: string;
  role: 'HOSPITAL_SUPERINTENDENT' | 'OPD_ADMIN' | 'HFR_NODAL_OFFICER';
}
