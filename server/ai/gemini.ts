/**
 * Compatibility Bridge Layer
 * 
 * Replaces legacy Google Gemini SDK dependency with the local Ollama AI architecture.
 * Preserves original function signatures so existing services (clinicalEngine, documentProcessor, summaryGenerator)
 * function seamlessly without breaking changes.
 */

import {
  extractClinicalInformation,
  extractDocumentData,
  generatePhysicianSummary as generatePhysicianSummaryOllama,
} from './medicalAI';

/**
 * Legacy Gemini client accessor.
 * Kept for backwards compatibility. Local Ollama does not require Google GenAI client initialization.
 */
export function getGeminiClient(): null {
  return null;
}

/**
 * Generates structured clinical extraction using local MedGemma 1.5.
 */
export async function generateClinicalExtraction(prompt: string, context: string = ''): Promise<any> {
  return extractClinicalInformation(prompt, context);
}

/**
 * Generates document OCR and structured medical entity extraction using local MedGemma 1.5.
 */
export async function generateDocumentOCRAndExtraction(
  documentTextOrImageBase64: string,
  documentType: string,
  isBase64Image: boolean = false
): Promise<any> {
  return extractDocumentData(documentTextOrImageBase64, documentType, isBase64Image);
}

/**
 * Generates institutional physician summary using local MedGemma 1.5.
 */
export async function generatePhysicianSummary(clinicalData: any): Promise<any> {
  return generatePhysicianSummaryOllama(clinicalData);
}
