export type LanguageCode = 'hi' | 'en' | 'mr' | 'gu' | 'bn' | 'ta' | 'te';

export type IntakeMode = 'GENERAL' | 'AYUSH';

export type DataSource = 'PATIENT_VOICE' | 'PATIENT_TOUCH' | 'DOCUMENT_OCR' | 'AI_EXTRACTION' | 'DOCTOR_EDIT';

export type SummaryStatus = 'DRAFT' | 'VERIFIED' | 'REJECTED';

export type TriagePriority = 'NORMAL' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

export interface ConsentRecord {
  patientId: string;
  encounterId: string;
  purposes: Array<'HISTORY_CAPTURE' | 'DOCUMENT_PROCESSING' | 'CLINICAL_SUMMARY' | 'HIS_SHARING' | 'ABDM_RECORD'>;
  consentVersion: string;
  language: LanguageCode;
  method: 'AUDIO_GUIDED' | 'TOUCHSCREEN' | 'ASSISTED';
  status: 'GRANTED' | 'REVOKED';
  grantedAt: string;
  revokedAt?: string | null;
}

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
  verifiedIdentity?: boolean;
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
  severity?: number; // 0-10 scale
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
  prakriti?: 'Vata' | 'Pitta' | 'Kapha' | 'Vata-Pitta' | 'Pitta-Kapha' | 'Vata-Kapha' | 'Tridoshaja' | string;
  vikriti?: string;
  sara?: 'Pravara' | 'Madhyama' | 'Avara' | string;
  samhanana?: 'Pravara' | 'Madhyama' | 'Avara' | string;
  pramana?: 'Sama' | 'Visham' | string;
  satmya?: 'Oka-Satmya' | 'Sarva-Rasa-Satmya' | string;
  sattva?: 'Pravara' | 'Madhyama' | 'Avara' | string;
  aharaShakti?: 'Abhyavaharana Shakti Uttama' | 'Jarana Shakti Manda' | 'Madhyama' | string;
  vyayamaShakti?: 'Pravara' | 'Madhyama' | 'Avara' | string;
  vaya?: 'Bala' | 'Madhyama' | 'Vriddha' | string;
  agni?: 'Vishama Agni' | 'Tikshna Agni' | 'Manda Agni' | 'Sama Agni' | string;
  koshtha?: 'Krura' | 'Mridu' | 'Madhyama' | string;
  aharaVihara?: {
    dietPreference?: 'Vegetarian' | 'Non-Vegetarian' | 'Vegan' | string;
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
  ocrConfidence?: number;
  needsReview?: boolean;
  minConfidenceThreshold?: number;
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
  generatedBy: string; // e.g., 'MediKiosk AI v2.4 (gemini-3.7-flash)'
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

export type ClinicalFactType =
  | 'MEDICATION'
  | 'ALLERGY'
  | 'DIAGNOSIS'
  | 'SYMPTOM'
  | 'LAB_RESULT'
  | 'VITAL'
  | 'PROCEDURE'
  | 'MEDICAL_HISTORY'
  | 'TIMELINE_EVENT';

export type ClinicalFactSource =
  | 'PATIENT_SPEECH'
  | 'PATIENT_CONVERSATION'
  | 'DOCUMENT_OCR'
  | 'AI_EXTRACTION';

export type VerificationStatus =
  | 'UNVERIFIED'
  | 'PATIENT_CONFIRMED'
  | 'DOCTOR_VERIFIED'
  | 'CONFLICTED'
  | 'NEEDS_REVIEW'
  | 'REJECTED';

export type FactCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReviewPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ClinicalDataQuality {
  ocrQuality?: number;
  sourceReliabilityWeight?: number;
  completenessScore?: number;
  extractionConfidence?: number;
  needsReview: boolean;
}

export interface ClinicalFactConfidence {
  overall: number;
  source?: number;
  ocr?: number;
  ai?: number;
  completeness?: number;
}

export interface ClinicalFact {
  id: string;
  encounterId: string;
  patientId: string;
  type: ClinicalFactType;
  value: any;
  normalizedValue?: any;
  source: ClinicalFactSource;
  sourceReference?: string;
  createdAt: string;
  dataQuality: ClinicalDataQuality;
  confidence: ClinicalFactConfidence;
  criticality: FactCriticality;
  verificationStatus: VerificationStatus;
  reviewRequired: boolean;
  doctorEditedValue?: any;
  flaggedForReview?: boolean;
  rejectedReason?: string;
  metadata?: Record<string, any>;
}

export type ContradictionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ClinicalContradiction {
  id: string;
  encounterId: string;
  category: 'MEDICATION' | 'ALLERGY' | 'TIMELINE' | 'LAB_RESULT' | 'DIAGNOSIS' | 'OTHER';
  severity: ContradictionSeverity;
  description: string;
  factIds: string[];
  sources: ClinicalFactSource[];
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
  reviewPriority: ReviewPriority;
  title: string;
  description: string;
  contradictionId?: string;
  factId?: string;
  criticality: FactCriticality;
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
  source: ClinicalFactSource;
  sourceReference?: string;
  verificationStatus: VerificationStatus;
  reviewRequired: boolean;
  criticality?: FactCriticality;
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
  sourcesUsed: ClinicalFactSource[];
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
  consent: ConsentRecord;
  history: ClinicalHistoryState;
  documents: DocumentRecord[];
  timeline: TimelineEvent[];
  alerts: RedFlagAlert[];
  summary?: AIClinicalSummary;
  validation?: EncounterValidationState;
  brief?: ClinicalBrief;
  createdAt: string;
  updatedAt: string;
  tokenNumber: string;
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
