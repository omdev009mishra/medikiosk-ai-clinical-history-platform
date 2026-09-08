import {
  ClinicalEncounter,
  ClinicalFact,
  ClinicalFactSource,
  EncounterValidationState,
} from '../types/clinical';
import {
  normalizeMedication,
  normalizeLabResult,
  normalizeDate,
} from './clinicalNormalizationService';
import {
  classifyFactCriticality,
  calculateDataQuality,
  calculateFactConfidence,
} from './confidenceScoringService';
import { detectContradictions } from './contradictionDetectionService';
import { buildReviewQueue } from './reviewQueueService';

/**
 * Runs the complete Clinical Validation & Cross-Source Data Reconciliation Pipeline for an encounter.
 */
export function runValidationPipeline(encounter: ClinicalEncounter): EncounterValidationState {
  const facts: ClinicalFact[] = [];
  const encounterId = encounter.id;
  const patientId = encounter.patientId;
  const createdAt = new Date().toISOString();

  // 1. EXTRACT FACTS FROM CLINICAL HISTORY (Patient Conversation / Voice)
  const history = encounter.history;

  if (history?.chiefComplaint?.value) {
    const src: ClinicalFactSource = history.chiefComplaint.source === 'PATIENT_VOICE' ? 'PATIENT_SPEECH' : 'PATIENT_CONVERSATION';
    const dataQual = calculateDataQuality('SYMPTOM', src, history.chiefComplaint);
    const conf = calculateFactConfidence('SYMPTOM', src, history.chiefComplaint);
    const crit = classifyFactCriticality('SYMPTOM', history.chiefComplaint);

    facts.push({
      id: `FACT_CC_${encounterId}_1`,
      encounterId,
      patientId,
      type: 'SYMPTOM',
      value: history.chiefComplaint,
      normalizedValue: { value: history.chiefComplaint.value.toLowerCase().trim(), duration: history.chiefComplaint.duration },
      source: src,
      sourceReference: 'Patient Intake Interview',
      createdAt,
      dataQuality: dataQual,
      confidence: conf,
      criticality: crit,
      verificationStatus: 'UNVERIFIED',
      reviewRequired: dataQual.needsReview,
    });
  }

  // Extract Medications from History
  if (history?.medications && Array.isArray(history.medications)) {
    history.medications.forEach((med, idx) => {
      const src: ClinicalFactSource = med.source === 'DOCUMENT_OCR' ? 'DOCUMENT_OCR' : 'PATIENT_CONVERSATION';
      const normMed = normalizeMedication(med.name, med.dosage, med.frequency, med.route);
      const dataQual = calculateDataQuality('MEDICATION', src, med, src === 'DOCUMENT_OCR' ? 0.88 : undefined);
      const conf = calculateFactConfidence('MEDICATION', src, med, src === 'DOCUMENT_OCR' ? 0.88 : undefined);
      const crit = classifyFactCriticality('MEDICATION', med);

      facts.push({
        id: `FACT_MED_HIST_${encounterId}_${idx}`,
        encounterId,
        patientId,
        type: 'MEDICATION',
        value: med,
        normalizedValue: normMed,
        source: src,
        sourceReference: med.sourceDocument || 'Patient Self-Report',
        createdAt,
        dataQuality: dataQual,
        confidence: conf,
        criticality: crit,
        verificationStatus: 'UNVERIFIED',
        reviewRequired: dataQual.needsReview,
      });
    });
  }

  // Extract Allergies from History
  if (history?.allergies && Array.isArray(history.allergies)) {
    history.allergies.forEach((al, idx) => {
      const src: ClinicalFactSource = al.source === 'PATIENT_VOICE' ? 'PATIENT_SPEECH' : 'PATIENT_CONVERSATION';
      const dataQual = calculateDataQuality('ALLERGY', src, al);
      const conf = calculateFactConfidence('ALLERGY', src, al);
      const crit = classifyFactCriticality('ALLERGY', al);

      facts.push({
        id: `FACT_ALLERGY_${encounterId}_${idx}`,
        encounterId,
        patientId,
        type: 'ALLERGY',
        value: al,
        normalizedValue: { allergen: al.allergen.toLowerCase().trim(), reaction: al.reaction },
        source: src,
        sourceReference: 'Allergy Screening',
        createdAt,
        dataQuality: dataQual,
        confidence: conf,
        criticality: crit,
        verificationStatus: 'UNVERIFIED',
        reviewRequired: true, // Allergies always flagged for verification
      });
    });
  }

  // 2. EXTRACT FACTS FROM UPLOADING MEDICAL DOCUMENTS (PaddleOCR & MedGemma)
  if (encounter.documents && Array.isArray(encounter.documents)) {
    encounter.documents.forEach((doc) => {
      const ocrConf = doc.ocrConfidence !== undefined ? doc.ocrConfidence : 0.88;
      const entities = doc.extractedEntities;

      if (entities) {
        // Document Medications
        (entities.medications || []).forEach((m, idx) => {
          const normMed = normalizeMedication(m.name, m.dosage, m.frequency, m.route);
          const dataQual = calculateDataQuality('MEDICATION', 'DOCUMENT_OCR', m, ocrConf);
          const conf = calculateFactConfidence('MEDICATION', 'DOCUMENT_OCR', m, ocrConf);
          const crit = classifyFactCriticality('MEDICATION', m);

          facts.push({
            id: `FACT_MED_DOC_${doc.id}_${idx}`,
            encounterId,
            patientId,
            type: 'MEDICATION',
            value: m,
            normalizedValue: normMed,
            source: 'DOCUMENT_OCR',
            sourceReference: doc.fileName,
            createdAt,
            dataQuality: dataQual,
            confidence: conf,
            criticality: crit,
            verificationStatus: doc.needsReview ? 'NEEDS_REVIEW' : 'UNVERIFIED',
            reviewRequired: doc.needsReview || dataQual.needsReview,
          });
        });

        // Document Lab Investigations
        (entities.investigations || []).forEach((inv, idx) => {
          const normLab = normalizeLabResult(inv.testName, inv.result, inv.unit, inv.referenceRange);
          const normDate = normalizeDate(inv.date || '');
          const dataQual = calculateDataQuality('LAB_RESULT', 'DOCUMENT_OCR', inv, ocrConf);
          const conf = calculateFactConfidence('LAB_RESULT', 'DOCUMENT_OCR', inv, ocrConf);
          const crit = classifyFactCriticality('LAB_RESULT', inv);

          const needsRev = doc.needsReview || normDate.isAmbiguous || dataQual.needsReview;

          facts.push({
            id: `FACT_LAB_DOC_${doc.id}_${idx}`,
            encounterId,
            patientId,
            type: 'LAB_RESULT',
            value: inv,
            normalizedValue: { ...normLab, date: normDate.isoDate || inv.date },
            source: 'DOCUMENT_OCR',
            sourceReference: doc.fileName,
            createdAt,
            dataQuality: dataQual,
            confidence: conf,
            criticality: crit,
            verificationStatus: needsRev ? 'NEEDS_REVIEW' : 'UNVERIFIED',
            reviewRequired: needsRev,
            metadata: { isAmbiguousDate: normDate.isAmbiguous },
          });
        });

        // Document Diagnoses
        (entities.diagnoses || []).forEach((diag, idx) => {
          const dataQual = calculateDataQuality('DIAGNOSIS', 'DOCUMENT_OCR', diag, ocrConf);
          const conf = calculateFactConfidence('DIAGNOSIS', 'DOCUMENT_OCR', diag, ocrConf);
          const crit = classifyFactCriticality('DIAGNOSIS', diag);

          facts.push({
            id: `FACT_DIAG_DOC_${doc.id}_${idx}`,
            encounterId,
            patientId,
            type: 'DIAGNOSIS',
            value: diag,
            normalizedValue: { name: diag.name.toLowerCase().trim() },
            source: 'DOCUMENT_OCR',
            sourceReference: doc.fileName,
            createdAt,
            dataQuality: dataQual,
            confidence: conf,
            criticality: crit,
            verificationStatus: doc.needsReview ? 'NEEDS_REVIEW' : 'UNVERIFIED',
            reviewRequired: doc.needsReview || dataQual.needsReview,
          });
        });
      }
    });
  }

  // Preserve existing fact verification status and resolved contradictions if previously recorded
  const existingFactsMap = new Map<string, string>();
  if (encounter.validation?.facts) {
    encounter.validation.facts.forEach((f) => existingFactsMap.set(f.id, f.verificationStatus));
  }

  // 3. RUN CONTRADICTION DETECTION ENGINE
  const contradictions = detectContradictions(facts);

  // Mark facts involved in contradictions as CONFLICTED unless explicitly verified
  const conflictedFactIds = new Set<string>();
  contradictions.forEach((c) => c.factIds.forEach((fid) => conflictedFactIds.add(fid)));

  facts.forEach((f) => {
    const existingStatus = existingFactsMap.get(f.id);
    if (existingStatus && existingStatus !== 'UNVERIFIED') {
      f.verificationStatus = existingStatus as any;
      if (existingStatus === 'PATIENT_CONFIRMED' || existingStatus === 'DOCTOR_VERIFIED') {
        f.reviewRequired = false;
      }
    } else if (conflictedFactIds.has(f.id)) {
      f.verificationStatus = 'CONFLICTED';
      f.reviewRequired = true;
    }
  });

  // 4. BUILD PRIORITIZED REVIEW QUEUE
  const reviewQueue = buildReviewQueue(encounterId, facts, contradictions);

  // Determine overall validation status
  let overallValidationStatus: 'PASSED' | 'NEEDS_REVIEW' | 'CRITICAL_CONFLICTS' = 'PASSED';
  if (contradictions.some((c) => c.severity === 'CRITICAL' && c.status === 'OPEN')) {
    overallValidationStatus = 'CRITICAL_CONFLICTS';
  } else if (reviewQueue.some((r) => r.status === 'OPEN')) {
    overallValidationStatus = 'NEEDS_REVIEW';
  }

  return {
    facts,
    contradictions,
    reviewQueue,
    overallValidationStatus,
    lastValidatedAt: createdAt,
  };
}
