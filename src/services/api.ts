import {
  Patient,
  ClinicalEncounter,
  AuditLog,
  QuestionDefinition,
  AIClinicalSummary,
  DocumentRecord,
  DoctorUser,
  AdminUser,
} from '../types/client';

const API_BASE = '/api';

export const api = {
  // Auth
  async loginDoctor(pin: string = '1234', doctorId: string = 'DOC_DR_VERMA') {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'DOCTOR', pin, doctorId }),
    });
    return res.json();
  },

  async loginAdmin(pin: string = '9999'): Promise<{ success: boolean; token?: string; admin?: AdminUser; error?: { message: string } }> {
    const res = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    return res.json();
  },

  // Healthcare Professionals & HPR Registry (Admin)
  async getDoctors(): Promise<{ success: boolean; data: DoctorUser[] }> {
    const res = await fetch(`${API_BASE}/doctors`);
    return res.json();
  },

  async getDoctor(id: string): Promise<{ success: boolean; data: DoctorUser }> {
    const res = await fetch(`${API_BASE}/doctors/${id}`);
    return res.json();
  },

  async registerDoctor(doctorData: Partial<DoctorUser>): Promise<{ success: boolean; data: DoctorUser; error?: { message: string } }> {
    const res = await fetch(`${API_BASE}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctorData),
    });
    return res.json();
  },

  async updateDoctor(id: string, updates: Partial<DoctorUser>): Promise<{ success: boolean; data: DoctorUser; error?: { message: string } }> {
    const res = await fetch(`${API_BASE}/doctors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteDoctor(id: string): Promise<{ success: boolean; message?: string; error?: { message: string } }> {
    const res = await fetch(`${API_BASE}/doctors/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async verifyHPR(hprId: string, regNo?: string, council?: string) {
    const res = await fetch(`${API_BASE}/hpr/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hprId, regNo, council }),
    });
    return res.json();
  },

  // Patients
  async getPatients(): Promise<{ success: boolean; data: Patient[] }> {
    const res = await fetch(`${API_BASE}/patients`);
    return res.json();
  },

  async getPatient(id: string): Promise<{ success: boolean; data: Patient }> {
    const res = await fetch(`${API_BASE}/patients/${id}`);
    return res.json();
  },

  async createPatient(patient: Partial<Patient>): Promise<{ success: boolean; data: Patient; error?: string }> {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    });
    return res.json();
  },

  // Encounters
  async createEncounter(patientId: string, mode: 'GENERAL' | 'AYUSH' = 'GENERAL', language: string = 'hi'): Promise<{ success: boolean; data: ClinicalEncounter }> {
    const res = await fetch(`${API_BASE}/encounters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, mode, language }),
    });
    return res.json();
  },

  async getEncounter(id: string): Promise<{ success: boolean; data: { encounter: ClinicalEncounter; patient: Patient } }> {
    const res = await fetch(`${API_BASE}/encounters/${id}`);
    return res.json();
  },

  async updateConsent(encounterId: string, status: 'GRANTED' | 'REVOKED' = 'GRANTED', method: string = 'AUDIO_GUIDED') {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, method }),
    });
    return res.json();
  },

  // History & Intake
  async startHistory(encounterId: string, complaintText?: string, mode?: 'GENERAL' | 'AYUSH') {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/history/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complaintText, mode }),
    });
    return res.json();
  },

  async answerQuestion(
    encounterId: string,
    questionId: string,
    answer: any,
    source: 'PATIENT_TOUCH' | 'PATIENT_VOICE' = 'PATIENT_TOUCH',
    answeredIds: string[] = [],
    rawUtterance?: string
  ) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/history/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answer, source, answeredIds, rawUtterance }),
    });
    return res.json();
  },

  // Documents
  async uploadDocument(
    encounterId: string,
    documentData: {
      documentType: 'PRESCRIPTION' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'PROCEDURE_RECORD' | 'OTHER';
      fileName: string;
      mimeType?: string;
      base64Data?: string;
      rawText?: string;
    }
  ): Promise<{ success: boolean; data: { document: DocumentRecord; allTimeline: any[] } }> {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(documentData),
    });
    return res.json();
  },

  // Summary & Verification
  async generateSummary(encounterId: string): Promise<{ success: boolean; data: AIClinicalSummary }> {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/summary/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  async editSummary(encounterId: string, updatedSections: Record<string, string>, doctorNotes?: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/summary/edit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedSections, doctorNotes }),
    });
    return res.json();
  },

  async confirmSummary(encounterId: string, doctorId: string, doctorNotes?: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/summary/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId, doctorNotes }),
    });
    return res.json();
  },

  async rejectSummary(encounterId: string, doctorId: string, reason: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/summary/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId, reason }),
    });
    return res.json();
  },

  // Doctor queue
  async getDoctorQueue(): Promise<{ success: boolean; data: any[] }> {
    const res = await fetch(`${API_BASE}/doctor/encounters`);
    return res.json();
  },

  // ABDM & HIS
  async verifyABHA(abhaNumberOrAddress: string) {
    const res = await fetch(`${API_BASE}/abdm/verify-abha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abhaNumberOrAddress }),
    });
    return res.json();
  },

  async getFHIRBundle(encounterId: string) {
    const res = await fetch(`${API_BASE}/abdm/export-fhir/${encounterId}`);
    return res.json();
  },

  async syncHIS(encounterId: string) {
    const res = await fetch(`${API_BASE}/his/sync/${encounterId}`, {
      method: 'POST',
    });
    return res.json();
  },

  // Audit
  async getAuditLogs(): Promise<{ success: boolean; data: AuditLog[] }> {
    const res = await fetch(`${API_BASE}/audit/logs`);
    return res.json();
  },

  // Speech Recognition (Faster-Whisper Proxy)
  async transcribeSpeech(base64Audio: string, mimeType: string = 'audio/webm', fileName: string = 'recording.webm', language?: string) {
    const res = await fetch(`${API_BASE}/speech/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Audio, mimeType, fileName, language }),
    });
    return res.json();
  },

  // Clinical Validation & Reconciliation (Phase 4)
  async getEncounterValidation(encounterId: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/validation`);
    return res.json();
  },

  async patientConfirmFact(encounterId: string, factId: string, confirmed: boolean = true) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/facts/${factId}/patient-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed }),
    });
    return res.json();
  },

  async resolveReviewItem(encounterId: string, reviewId: string, doctorId: string = 'DOC_DR_VERMA', resolutionNote?: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/review-items/${reviewId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId, resolutionNote }),
    });
    return res.json();
  },

  // Phase 5 — Clinical Brief & Doctor Actions
  async getClinicalBrief(encounterId: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/clinical-brief`);
    return res.json();
  },

  async getAuditTrail(encounterId: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/audit-trail`);
    return res.json();
  },

  async doctorConfirmFact(encounterId: string, factId: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/facts/${factId}/doctor-confirm`, {
      method: 'POST',
    });
    return res.json();
  },

  async doctorEditFact(encounterId: string, factId: string, editedValue: any) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/facts/${factId}/doctor-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editedValue }),
    });
    return res.json();
  },

  async doctorRejectFact(encounterId: string, factId: string, reason?: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/facts/${factId}/doctor-reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },

  async doctorFlagFact(encounterId: string, factId: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/facts/${factId}/flag`, {
      method: 'POST',
    });
    return res.json();
  },

  // Phase 6 — Patient Registration, Encounter Lifecycle, Auth & Dashboard
  async registerPatient(patientData: {
    fullName: string;
    dateOfBirth: string;
    gender: string;
    phoneNumber: string;
    abhaId?: string;
  }) {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData),
    });
    return res.json();
  },

  async searchPatients(query: string) {
    const res = await fetch(`${API_BASE}/patients/search?query=${encodeURIComponent(query)}`);
    return res.json();
  },

  async getPatientById(patientId: string) {
    const res = await fetch(`${API_BASE}/patients/${patientId}`);
    return res.json();
  },

  async getPatientHistory(patientId: string) {
    const res = await fetch(`${API_BASE}/patients/${patientId}/history`);
    return res.json();
  },

  async createPatientEncounter(patientId: string, options: { mode?: string; language?: string }) {
    const res = await fetch(`${API_BASE}/patients/${patientId}/encounters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    return res.json();
  },

  async completeEncounter(encounterId: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/complete`, {
      method: 'POST',
    });
    return res.json();
  },

  async loginUser(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async getCurrentUser() {
    const res = await fetch(`${API_BASE}/auth/me`);
    return res.json();
  },

  async getDashboardOverview() {
    const res = await fetch(`${API_BASE}/dashboard/overview`);
    return res.json();
  },

  // Phase 7 — Adaptive AI Clinical Interview Engine
  async startAdaptiveInterview(encounterId: string, language: string = 'en') {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/interview/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    });
    return res.json();
  },

  async respondAdaptiveInterview(
    encounterId: string,
    answer: string,
    language: string = 'en',
    askedQuestionIds: string[] = []
  ) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/interview/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer, language, askedQuestionIds }),
    });
    return res.json();
  },

  async getAdaptiveInterviewState(encounterId: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/interview`);
    return res.json();
  },

  async completeAdaptiveInterview(encounterId: string) {
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/interview/complete`, {
      method: 'POST',
    });
    return res.json();
  },

  // Direct Medical Interrogation Endpoints (Ported from ZIP)
  async getNextMedicalQuestion(params: {
    history: any[];
    latestAnswer: string;
    questionNumber: number;
    structuredHistory: any;
    language?: string;
    isInitial?: boolean;
    isLanguageSwitch?: boolean;
  }) {
    const res = await fetch(`${API_BASE}/medical/next-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async requestMedicalSummary(params: {
    history: any[];
    structuredHistory: any;
    language?: string;
  }) {
    const res = await fetch(`${API_BASE}/medical/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },
};
