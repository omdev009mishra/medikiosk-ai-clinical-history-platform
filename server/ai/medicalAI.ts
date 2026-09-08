/**
 * Medical AI Service
 * Powered by medgemma1.5:latest for clinical entity extraction, document processing, and case summarization.
 */

import { generateJSON, getOllamaConfig } from './ollama';
import {
  MEDICAL_EXTRACTION_SYSTEM_PROMPT,
  buildClinicalExtractionPrompt,
  DOCUMENT_OCR_SYSTEM_PROMPT,
  buildDocumentExtractionPrompt,
  PHYSICIAN_SUMMARY_SYSTEM_PROMPT,
  buildPhysicianSummaryPrompt,
} from './prompts/medicalPrompts';

export interface StructuredClinicalExtraction {
  chiefComplaint?: { value?: string; duration?: string };
  hpiUpdates?: {
    site?: string;
    onset?: string;
    character?: string;
    radiation?: string;
    severity?: number;
    associatedSymptoms?: string[];
    timing?: string;
    exacerbatingFactors?: string[];
    relievingFactors?: string[];
  };
  pastMedicalHistory?: string[];
  pastSurgicalHistory?: string[];
  medications?: Array<{ name: string; dosage?: string; frequency?: string }>;
  allergies?: Array<{ allergen: string; reaction?: string }>;
  ayushFindings?: {
    prakriti?: string;
    agni?: string;
    koshtha?: string;
    aharaHabits?: string;
  };
  suggestedNextQuestion?: {
    en?: string;
    hi?: string;
  };
  potentialEmergency?: boolean;
  emergencyRationale?: string;
}

export interface DocumentExtractionResult {
  ocrText: string;
  documentDate?: string;
  diagnoses?: Array<{ name: string; date?: string; confidence?: number }>;
  medications?: Array<{ name: string; dosage?: string; frequency?: string; route?: string; duration?: string }>;
  investigations?: Array<{
    testName: string;
    result: string;
    unit?: string;
    referenceRange?: string;
    status?: 'NORMAL' | 'HIGH' | 'LOW' | 'ABNORMAL';
  }>;
  procedures?: Array<{ name: string; date?: string; provider?: string }>;
  clinicalNotes?: string;
}

export interface PhysicianSummarySections {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  pastSurgicalHistory: string;
  drugHistory: string;
  allergyHistory: string;
  familyHistory: string;
  personalHistory: string;
  reviewOfSystems: string;
  ayushHistory: string;
  priorInvestigations: string;
  currentMedications: string;
  medicalTimelineSummary: string;
  redFlagsIdentified: string;
  provisionalClinicalNotes: string;
}

/**
 * Extracts structured clinical history from patient voice/text input using MedGemma 1.5.
 */
export async function extractClinicalInformation(
  prompt: string,
  context: string = ''
): Promise<StructuredClinicalExtraction | null> {
  const config = getOllamaConfig();
  const extractionPrompt = buildClinicalExtractionPrompt(prompt, context);

  try {
    const result = await generateJSON<StructuredClinicalExtraction>({
      model: config.medicalModel,
      prompt: extractionPrompt,
      systemPrompt: MEDICAL_EXTRACTION_SYSTEM_PROMPT,
      temperature: 0.1,
    });

    return result;
  } catch (err) {
    console.error('[Medical AI Extraction Error]:', err);
    return null;
  }
}

/**
 * Performs OCR analysis and medical entity extraction from document text or image base64 using MedGemma 1.5.
 */
export async function extractDocumentData(
  documentTextOrImageBase64: string,
  documentType: string,
  isBase64Image: boolean = false
): Promise<DocumentExtractionResult | null> {
  const config = getOllamaConfig();

  let prompt: string;
  let imageBase64: string | undefined = undefined;

  if (isBase64Image) {
    imageBase64 = documentTextOrImageBase64;
    prompt = `Analyze the provided image of document type: ${documentType}. Extract text, medications, laboratory results, diagnoses, and procedures.`;
  } else {
    prompt = buildDocumentExtractionPrompt(documentTextOrImageBase64, documentType);
  }

  try {
    const result = await generateJSON<DocumentExtractionResult>({
      model: config.medicalModel,
      prompt,
      systemPrompt: DOCUMENT_OCR_SYSTEM_PROMPT,
      imageBase64,
      temperature: 0.1,
    });

    return result;
  } catch (err) {
    console.error('[Medical AI Document Processing Error]:', err);
    return null;
  }
}

/**
 * Generates institutional case-taking summary using MedGemma 1.5.
 */
export async function generatePhysicianSummary(clinicalData: any): Promise<PhysicianSummarySections | null> {
  const config = getOllamaConfig();
  const prompt = buildPhysicianSummaryPrompt(clinicalData);

  try {
    const result = await generateJSON<PhysicianSummarySections>({
      model: config.medicalModel,
      prompt,
      systemPrompt: PHYSICIAN_SUMMARY_SYSTEM_PROMPT,
      temperature: 0.1,
    });

    return result;
  } catch (err) {
    console.error('[Medical AI Summary Error]:', err);
    return null;
  }
}
