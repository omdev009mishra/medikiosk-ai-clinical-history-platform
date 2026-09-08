/**
 * Medical AI Prompts for MedGemma 1.5 (Medical Extraction & Summarization Engine)
 */

export const MEDICAL_EXTRACTION_SYSTEM_PROMPT = `You are an AI Clinical History Extraction Engine for MediKiosk (Ministry of Ayush / AIIMS / AIIA standards).
Extract structured clinical information from the patient's utterance accurately.
Never invent unrecorded clinical facts. Return ONLY valid JSON matching the requested schema.`;

export function buildClinicalExtractionPrompt(prompt: string, context: string = ''): string {
  return `Patient Context: ${context}
Patient Input: "${prompt}"

Return ONLY a valid JSON object matching this schema exactly:
{
  "chiefComplaint": { "value": string, "duration": string },
  "hpiUpdates": {
    "site": string,
    "onset": string,
    "character": string,
    "radiation": string,
    "severity": number,
    "associatedSymptoms": string[],
    "timing": string,
    "exacerbatingFactors": string[],
    "relievingFactors": string[]
  },
  "pastMedicalHistory": string[],
  "pastSurgicalHistory": string[],
  "medications": Array<{ "name": string, "dosage": string, "frequency": string }>,
  "allergies": Array<{ "allergen": string, "reaction": string }>,
  "ayushFindings": {
    "prakriti": string,
    "agni": string,
    "koshtha": string,
    "aharaHabits": string
  },
  "suggestedNextQuestion": {
    "en": string,
    "hi": string
  },
  "potentialEmergency": boolean,
  "emergencyRationale": string
}`;
}

export const DOCUMENT_OCR_SYSTEM_PROMPT = `You are a medical document digitization engine for hospital records (Prescriptions, Laboratory Reports, Discharge Summaries, Procedure Notes).
Analyze the provided document text or image, perform OCR/reading, and extract structured clinical entities.
Highlight abnormal lab investigations strictly by comparing the result with standard or provided reference ranges (status: NORMAL, HIGH, LOW, ABNORMAL).
Extract all medications, diagnoses, and procedures accurately. Never invent missing clinical facts.
Return ONLY a valid JSON object.`;

export function buildDocumentExtractionPrompt(documentText: string, documentType: string): string {
  return `Document Classification: ${documentType}
Document Content:
${documentText}

Return ONLY a valid JSON object matching this schema:
{
  "ocrText": string,
  "documentDate": string,
  "diagnoses": Array<{ "name": string, "date": string, "confidence": number }>,
  "medications": Array<{ "name": string, "dosage": string, "frequency": string, "route": string, "duration": string }>,
  "investigations": Array<{
    "testName": string,
    "result": string,
    "unit": string,
    "referenceRange": string,
    "status": "NORMAL" | "HIGH" | "LOW" | "ABNORMAL"
  }>,
  "procedures": Array<{ "name": string, "date": string, "provider": string }>,
  "clinicalNotes": string
}`;
}

export const PHYSICIAN_SUMMARY_SYSTEM_PROMPT = `You are a Senior Clinical Documentation & Case-Taking Specialist for the All India Institute of Ayurveda & Ministry of Ayush.
Synthesize the verified clinical state, past documents, timeline, and red-flag alerts into a concise, physician-ready clinical summary (Draft status).
Format must follow institutional case-taking standards.
Do NOT fabricate any unrecorded facts. Keep exact provenance.
Return ONLY a valid JSON object.`;

export function buildPhysicianSummaryPrompt(clinicalData: any): string {
  return `Clinical State Input:
${JSON.stringify(clinicalData, null, 2)}

Return ONLY a valid JSON object with the following fields:
{
  "chiefComplaint": string,
  "historyOfPresentIllness": string,
  "pastMedicalHistory": string,
  "pastSurgicalHistory": string,
  "drugHistory": string,
  "allergyHistory": string,
  "familyHistory": string,
  "personalHistory": string,
  "reviewOfSystems": string,
  "ayushHistory": string,
  "priorInvestigations": string,
  "currentMedications": string,
  "medicalTimelineSummary": string,
  "redFlagsIdentified": string,
  "provisionalClinicalNotes": string
}`;
}
