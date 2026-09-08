import {
  ClinicalFactSource,
  ClinicalFactType,
  FactCriticality,
  ClinicalFactConfidence,
  ClinicalDataQuality,
} from '../types/clinical';

/**
 * Internal deterministic source reliability weights.
 * Used exclusively for deterministic review queue prioritization.
 * This represents source logging weight, NOT medical truth or diagnostic confidence.
 */
export const SOURCE_RELIABILITY_WEIGHTS: Record<ClinicalFactSource, number> = {
  PATIENT_SPEECH: 0.95,
  PATIENT_CONVERSATION: 0.92,
  DOCUMENT_OCR: 0.88,
  AI_EXTRACTION: 0.82,
};

/**
 * Evaluates the review criticality category of a clinical fact.
 * Criticality represents the importance of clinical review/verification, NOT disease severity.
 */
export function classifyFactCriticality(type: ClinicalFactType, value: any): FactCriticality {
  if (type === 'ALLERGY') {
    return 'HIGH';
  }

  if (type === 'MEDICATION') {
    return 'HIGH';
  }

  if (type === 'LAB_RESULT') {
    if (value?.status === 'HIGH' || value?.status === 'LOW' || value?.status === 'ABNORMAL') {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  if (type === 'DIAGNOSIS') {
    return 'HIGH';
  }

  if (type === 'SYMPTOM') {
    // Symptoms default to MEDIUM criticality for review priority.
    // Symptoms must NOT automatically become CRITICAL based on keyword string matching.
    // Red flag clinical safety alerts are evaluated separately by the red flag rule engine.
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Calculates completeness score based on presence of expected factual fields.
 * Example: Medication with Name, Dosage, Unit present but Frequency missing = 0.75 (75%).
 */
export function calculateCompleteness(type: ClinicalFactType, value: any): number {
  if (!value) return 0.25;

  if (type === 'MEDICATION') {
    let count = 0;
    const rawName = value?.name || value?.canonicalName || (typeof value === 'string' ? value : '');
    const norm = value?.normalizedValue || value;

    // 1. Medication Name
    if (rawName || norm?.canonicalName) count++;

    // 2. Dosage Amount
    const hasDosage =
      norm?.dosage?.amount !== undefined ||
      value?.dosage ||
      value?.dosageAmount !== undefined ||
      /\b\d+(\.\d+)?\s*(mg|g|gm|ml|mcg)\b/i.test(rawName);
    if (hasDosage) count++;

    // 3. Dosage Unit
    const hasUnit =
      norm?.dosage?.unit ||
      value?.unit ||
      (typeof value?.dosage === 'string' && /\b(mg|g|gm|ml|mcg)\b/i.test(value.dosage)) ||
      /\b(mg|g|gm|ml|mcg)\b/i.test(rawName);
    if (hasUnit) count++;

    // 4. Frequency
    const hasFreq =
      norm?.frequency ||
      value?.frequency ||
      /\b(od|bd|tds|qid|hs|sos|once daily|twice daily)\b/i.test(rawName);
    if (hasFreq) count++;

    return count / 4;
  }

  if (type === 'LAB_RESULT') {
    let count = 0;
    if (value.testName) count++;
    if (value.result !== undefined && value.result !== '') count++;
    if (value.unit) count++;
    if (value.date) count++;

    return count / 4;
  }

  if (type === 'ALLERGY') {
    if (value.allergen || value === 'no_allergies') return 1.0;
    return 0.5;
  }

  return 0.85;
}

/**
 * Computes structured Data Quality signals (Phase 4.1).
 * Separates OCR recognition quality, record completeness, and source reliability.
 * NEVER fabricates AI extraction confidence.
 */
export function calculateDataQuality(
  type: ClinicalFactType,
  source: ClinicalFactSource,
  value: any,
  ocrQuality?: number
): ClinicalDataQuality {
  const sourceWeight = SOURCE_RELIABILITY_WEIGHTS[source] || 0.80;
  const completeness = calculateCompleteness(type, value);
  const ocrVal = source === 'DOCUMENT_OCR' ? ocrQuality : undefined;

  const needsReview =
    (ocrVal !== undefined && ocrVal < 0.70) ||
    completeness < 0.75;

  return {
    ocrQuality: ocrVal,
    sourceReliabilityWeight: sourceWeight,
    completenessScore: Number(completeness.toFixed(2)),
    extractionConfidence: undefined, // NEVER fabricate AI confidence for uncalibrated models (MedGemma/Ollama)
    needsReview,
  };
}

/**
 * Backward-compatible helper for legacy Phase 4 consumers.
 */
export function calculateFactConfidence(
  type: ClinicalFactType,
  source: ClinicalFactSource,
  value: any,
  ocrConfidence?: number,
  aiConfidence?: number
): ClinicalFactConfidence {
  const dataQual = calculateDataQuality(type, source, value, ocrConfidence);
  const sourceWeight = dataQual.sourceReliabilityWeight || 0.80;
  const completeness = dataQual.completenessScore || 0.75;

  let compositeSum = sourceWeight * 0.5 + completeness * 0.5;
  if (dataQual.ocrQuality !== undefined) {
    compositeSum = dataQual.ocrQuality * 0.6 + completeness * 0.4;
  }

  return {
    overall: Number(compositeSum.toFixed(2)),
    source: sourceWeight,
    ocr: dataQual.ocrQuality,
    ai: undefined, // Uncalibrated AI probabilities are not fabricated
    completeness,
  };
}
