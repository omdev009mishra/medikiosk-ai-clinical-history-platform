import {
  ClinicalEncounter,
  ClinicalFact,
  ClinicalFactSource,
  ClinicalBrief,
  ClinicalBriefItem,
  ClinicalBriefSection,
  ClinicalDocumentSummary,
  PatientSummarySection,
  ClinicalReviewSummary,
  ClinicalBriefProvenance,
} from '../types/clinical';
import { runValidationPipeline } from './clinicalValidationPipeline';
import { buildClinicalTimeline } from './clinicalTimelineService';

/**
 * Deterministically generates a structured, doctor-facing Clinical Brief from encounter data,
 * canonical facts, validation state, contradictions, review queue, and uploaded documents.
 */
export function generateClinicalBrief(encounter: ClinicalEncounter): ClinicalBrief {
  const generatedAt = new Date().toISOString();
  const encounterId = encounter.id;
  const patientId = encounter.patientId;

  // 1. Ensure Validation Engine pipeline has run
  const validation = encounter.validation || runValidationPipeline(encounter);
  const facts = validation.facts || [];
  const contradictions = validation.contradictions || [];
  const reviewQueue = validation.reviewQueue || [];

  // 2. Patient Summary Section
  const patientSummary: PatientSummarySection = {
    patientId,
    name: encounter.history?.chiefComplaint?.value ? 'Intake Patient' : 'Patient',
    age: 45, // default demographic unless supplied
    gender: 'Unspecified',
    tokenNumber: encounter.tokenNumber || 'TK-101',
    intakeMode: encounter.mode,
    language: encounter.language,
  };

  // 3. Section 1: Chief Complaint (Priority: PATIENT_CONFIRMED > PATIENT_SPEECH > PATIENT_CONVERSATION > DOCUMENT_OCR)
  const ccFacts = facts.filter((f) => f.type === 'SYMPTOM' || f.id.startsWith('FACT_CC_'));
  let primaryCcFact: ClinicalFact | undefined;

  if (ccFacts.length > 0) {
    primaryCcFact =
      ccFacts.find((f) => f.verificationStatus === 'PATIENT_CONFIRMED') ||
      ccFacts.find((f) => f.source === 'PATIENT_SPEECH') ||
      ccFacts.find((f) => f.source === 'PATIENT_CONVERSATION') ||
      ccFacts[0];
  }

  let chiefComplaintItem: ClinicalBriefItem | undefined;
  if (primaryCcFact) {
    const rawVal = primaryCcFact.value;
    const dispText = typeof rawVal === 'string' ? rawVal : rawVal?.value || 'Chief complaint reported';
    const durText = rawVal?.duration ? ` (Duration: ${rawVal.duration})` : '';

    chiefComplaintItem = {
      id: `BRIEF_CC_${primaryCcFact.id}`,
      factId: primaryCcFact.id,
      label: 'Chief Complaint',
      value: `Patient-reported concern: "${dispText}"${durText}`,
      rawSourceText: primaryCcFact.sourceReference || dispText,
      source: primaryCcFact.source,
      sourceReference: primaryCcFact.sourceReference || 'Patient Intake',
      verificationStatus: primaryCcFact.verificationStatus,
      reviewRequired: primaryCcFact.reviewRequired,
      criticality: primaryCcFact.criticality,
      dataQuality: primaryCcFact.dataQuality,
      doctorEditedValue: primaryCcFact.doctorEditedValue,
      metadata: { alternateFactsCount: ccFacts.length - 1 },
    };
  } else {
    chiefComplaintItem = {
      id: `BRIEF_CC_NONE`,
      label: 'Chief Complaint',
      value: 'No specific chief complaint stated.',
      source: 'PATIENT_CONVERSATION',
      verificationStatus: 'UNVERIFIED',
      reviewRequired: false,
    };
  }

  // 4. Section 2: Current Symptoms
  const symptomFacts = facts.filter((f) => f.type === 'SYMPTOM');
  const symptomItems: ClinicalBriefItem[] = symptomFacts.map((sf) => {
    const val = sf.value;
    const name = typeof val === 'string' ? val : val?.value || 'Symptom';
    const dur = val?.duration ? ` - ${val.duration}` : '';
    const sev = val?.severity ? ` (Patient-reported ${val.severity} severity)` : '';

    return {
      id: `BRIEF_SYM_${sf.id}`,
      factId: sf.id,
      label: 'Symptom',
      value: `${name}${dur}${sev}`,
      rawSourceText: name,
      source: sf.source,
      sourceReference: sf.sourceReference,
      verificationStatus: sf.verificationStatus,
      reviewRequired: sf.reviewRequired,
      criticality: sf.criticality,
      dataQuality: sf.dataQuality,
      doctorEditedValue: sf.doctorEditedValue,
    };
  });

  const currentSymptomsSection: ClinicalBriefSection = {
    id: 'SEC_SYMPTOMS',
    title: 'Current Symptoms',
    items: symptomItems,
    reviewRequired: symptomItems.some((i) => i.reviewRequired),
  };

  // 5. Section 3: History of Present Illness (Structured SOCRATES breakdown)
  const hpiItems: ClinicalBriefItem[] = [];
  if (primaryCcFact) {
    const v = primaryCcFact.value;
    hpiItems.push({
      id: 'HPI_SYMPTOM',
      label: 'Primary Symptom',
      value: typeof v === 'string' ? v : v?.value || 'Not provided',
      source: primaryCcFact.source,
      verificationStatus: primaryCcFact.verificationStatus,
      reviewRequired: false,
    });
    hpiItems.push({
      id: 'HPI_DURATION',
      label: 'Duration & Onset',
      value: v?.duration || 'Not provided',
      source: primaryCcFact.source,
      verificationStatus: primaryCcFact.verificationStatus,
      reviewRequired: false,
    });
    hpiItems.push({
      id: 'HPI_LOCATION',
      label: 'Anatomical Location',
      value: v?.location || 'Not provided',
      source: primaryCcFact.source,
      verificationStatus: primaryCcFact.verificationStatus,
      reviewRequired: false,
    });
    hpiItems.push({
      id: 'HPI_SEVERITY',
      label: 'Reported Severity',
      value: v?.severity ? `Patient-reported ${v.severity}` : 'Not provided',
      source: primaryCcFact.source,
      verificationStatus: primaryCcFact.verificationStatus,
      reviewRequired: false,
    });
    hpiItems.push({
      id: 'HPI_ASSOCIATED',
      label: 'Associated Symptoms',
      value: symptomFacts.length > 1 ? symptomFacts.slice(1).map((s) => s.value?.value || s.value).join(', ') : 'None reported',
      source: primaryCcFact.source,
      verificationStatus: primaryCcFact.verificationStatus,
      reviewRequired: false,
    });
  }

  const hpiSection: ClinicalBriefSection = {
    id: 'SEC_HPI',
    title: 'History of Present Illness',
    items: hpiItems,
    reviewRequired: false,
  };

  // 6. Section 4: Important Review Alerts
  const alertItems: ClinicalBriefItem[] = [];

  // Add Contradictions
  contradictions.forEach((c) => {
    alertItems.push({
      id: `ALERT_CONTR_${c.id}`,
      label: `Contradiction Alert (${c.category})`,
      value: `${c.description} [Status: ${c.status}]`,
      source: c.sources[0] || 'AI_EXTRACTION',
      verificationStatus: 'CONFLICTED',
      reviewRequired: true,
      criticality: c.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      metadata: { contradictionId: c.id, factIds: c.factIds },
    });
  });

  // Add Ambiguous Date & Low Quality Alerts
  reviewQueue.forEach((rq) => {
    if (!alertItems.some((a) => a.metadata?.contradictionId === rq.contradictionId)) {
      alertItems.push({
        id: `ALERT_REV_${rq.id}`,
        label: rq.title,
        value: rq.description,
        source: 'DOCUMENT_OCR',
        verificationStatus: 'NEEDS_REVIEW',
        reviewRequired: true,
        criticality: rq.criticality,
        metadata: { factId: rq.factId },
      });
    }
  });

  const reviewAlertsSection: ClinicalBriefSection = {
    id: 'SEC_ALERTS',
    title: 'Important Review Alerts',
    items: alertItems,
    reviewRequired: alertItems.length > 0,
    reviewCount: alertItems.length,
  };

  // 7. Section 5: Allergies
  const allergyFacts = facts.filter((f) => f.type === 'ALLERGY');
  const allergyItems: ClinicalBriefItem[] = [];

  if (allergyFacts.length === 0) {
    allergyItems.push({
      id: 'ALLERGY_NONE',
      label: 'Allergy Status',
      value: 'Patient reports no known allergies',
      source: 'PATIENT_CONVERSATION',
      verificationStatus: 'UNVERIFIED',
      reviewRequired: false,
    });
  } else {
    allergyFacts.forEach((af) => {
      const val = af.value;
      const allergen = typeof val === 'string' ? val : val?.allergen || 'Allergy';
      const dispText = allergen === 'no_allergies' ? 'Patient reports no known allergies' : `Reported Allergen: ${allergen}${val?.reaction ? ` (Reaction: ${val.reaction})` : ''}`;

      allergyItems.push({
        id: `BRIEF_ALL_${af.id}`,
        factId: af.id,
        label: 'Allergy Record',
        value: dispText,
        rawSourceText: allergen,
        source: af.source,
        sourceReference: af.sourceReference,
        verificationStatus: af.verificationStatus,
        reviewRequired: af.reviewRequired,
        criticality: af.criticality,
        dataQuality: af.dataQuality,
        doctorEditedValue: af.doctorEditedValue,
      });
    });
  }

  const allergiesSection: ClinicalBriefSection = {
    id: 'SEC_ALLERGIES',
    title: 'Allergies',
    items: allergyItems,
    reviewRequired: allergyItems.some((i) => i.reviewRequired),
  };

  // 8. Section 6: Current Medications (Group duplicate entities while preserving source evidence)
  const medFacts = facts.filter((f) => f.type === 'MEDICATION');
  const medMap = new Map<string, ClinicalFact[]>();

  medFacts.forEach((mf) => {
    const rawName = mf.value?.name || mf.normalizedValue?.canonicalName || 'medication';
    const cleanKey = rawName.toLowerCase().replace(/^(tab\.|cap\.|syrup\.|inj\.)\s*/i, '').trim();
    if (!medMap.has(cleanKey)) {
      medMap.set(cleanKey, []);
    }
    medMap.get(cleanKey)!.push(mf);
  });

  const medItems: ClinicalBriefItem[] = [];
  medMap.forEach((factGroup, medKey) => {
    const primary = factGroup[0];
    const norm = primary.normalizedValue;
    const medName = norm?.canonicalName ? norm.canonicalName.toUpperCase() : medKey.toUpperCase();
    const dosageStr = norm?.dosage?.amount ? `${norm.dosage.amount} ${norm.dosage.unit}` : primary.value?.dosage || 'Not provided';
    const freqStr = norm?.frequency || primary.value?.frequency || 'Not provided';

    // Check for dosage conflict in group
    const dosages = new Set(factGroup.map((f) => f.normalizedValue?.dosage?.amount || f.value?.dosage));
    const hasDosageConflict = dosages.size > 1;

    let conflictWarning = '';
    if (hasDosageConflict) {
      conflictWarning = ` ⚠️ DOSAGE CONFLICT DETECTED (${Array.from(dosages).join(' vs ')})`;
    }

    const compScore = primary.dataQuality?.completenessScore !== undefined ? Math.round(primary.dataQuality.completenessScore * 100) : 75;

    medItems.push({
      id: `BRIEF_MED_${primary.id}`,
      factId: primary.id,
      label: medName,
      value: `Dosage: ${dosageStr} | Frequency: ${freqStr} | Record Completeness: ${compScore}%${conflictWarning}`,
      rawSourceText: primary.sourceReference || medName,
      source: primary.source,
      sourceReference: primary.sourceReference || 'Intake Record',
      verificationStatus: hasDosageConflict ? 'CONFLICTED' : primary.verificationStatus,
      reviewRequired: primary.reviewRequired || hasDosageConflict,
      criticality: primary.criticality,
      dataQuality: primary.dataQuality,
      doctorEditedValue: primary.doctorEditedValue,
      metadata: {
        sourcesCount: factGroup.length,
        sources: factGroup.map((f) => ({ source: f.source, reference: f.sourceReference, dosage: f.value?.dosage || f.normalizedValue?.dosage?.amount })),
      },
    });
  });

  const medicationsSection: ClinicalBriefSection = {
    id: 'SEC_MEDICATIONS',
    title: 'Current Medications',
    items: medItems,
    reviewRequired: medItems.some((i) => i.reviewRequired),
  };

  // 9. Section 7: Past Medical History
  const pmhFacts = facts.filter((f) => f.type === 'DIAGNOSIS');
  const pmhItems: ClinicalBriefItem[] = pmhFacts.map((pf) => ({
    id: `BRIEF_PMH_${pf.id}`,
    factId: pf.id,
    label: 'Documented Diagnosis',
    value: pf.value?.name || pf.value || 'Medical Condition',
    source: pf.source,
    sourceReference: pf.sourceReference,
    verificationStatus: pf.verificationStatus,
    reviewRequired: pf.reviewRequired,
    criticality: pf.criticality,
    dataQuality: pf.dataQuality,
  }));

  const pastMedicalHistorySection: ClinicalBriefSection = {
    id: 'SEC_PMH',
    title: 'Past Medical History',
    items: pmhItems.length > 0 ? pmhItems : [{ id: 'PMH_NONE', label: 'History', value: 'No prior medical conditions documented.', source: 'PATIENT_CONVERSATION', verificationStatus: 'UNVERIFIED', reviewRequired: false }],
    reviewRequired: pmhItems.some((i) => i.reviewRequired),
  };

  // 10. Section 8: Important Laboratory Results
  const labFacts = facts.filter((f) => f.type === 'LAB_RESULT');
  const labItems: ClinicalBriefItem[] = labFacts.map((lf) => {
    const val = lf.value;
    const testName = val?.testName || lf.normalizedValue?.canonicalTestName || 'Lab Test';
    const result = val?.result !== undefined ? val.result : lf.normalizedValue?.numericResult || 'Result';
    const unit = val?.unit || lf.normalizedValue?.normalizedUnit || '';
    const refRange = val?.referenceRange ? ` (Ref: ${val.referenceRange})` : '';
    const dateStr = val?.date || lf.normalizedValue?.date ? ` - Date: ${val?.date || lf.normalizedValue?.date}` : '';

    const isAbnormal = val?.status === 'HIGH' || val?.status === 'LOW' || val?.status === 'ABNORMAL';
    const abnormalTag = isAbnormal ? ' [Outside provided reference range]' : '';

    return {
      id: `BRIEF_LAB_${lf.id}`,
      factId: lf.id,
      label: testName,
      value: `${result} ${unit}${refRange}${dateStr}${abnormalTag}`,
      rawSourceText: `${testName}: ${result} ${unit}`,
      source: lf.source,
      sourceReference: lf.sourceReference,
      verificationStatus: lf.verificationStatus,
      reviewRequired: lf.reviewRequired || isAbnormal,
      criticality: lf.criticality,
      dataQuality: lf.dataQuality,
      doctorEditedValue: lf.doctorEditedValue,
    };
  });

  const labResultsSection: ClinicalBriefSection = {
    id: 'SEC_LABS',
    title: 'Important Laboratory Results',
    items: labItems.length > 0 ? labItems : [{ id: 'LAB_NONE', label: 'Lab Reports', value: 'No prior laboratory records attached.', source: 'DOCUMENT_OCR', verificationStatus: 'UNVERIFIED', reviewRequired: false }],
    reviewRequired: labItems.some((i) => i.reviewRequired),
  };

  // 11. Section 9: Previous Documents
  const documentSummaries: ClinicalDocumentSummary[] = (encounter.documents || []).map((doc) => {
    const docFactsCount = facts.filter((f) => f.sourceReference === doc.fileName).length;
    return {
      id: doc.id,
      fileName: doc.fileName,
      documentType: doc.documentType,
      uploadDate: doc.uploadDate || encounter.createdAt,
      ocrQuality: doc.ocrConfidence !== undefined ? doc.ocrConfidence : 0.88,
      processingStatus: doc.processingStatus || 'COMPLETED',
      extractedFactsCount: docFactsCount,
      needsReview: doc.needsReview || false,
    };
  });

  // 12. Section 10: Clinical Timeline
  const timeline = buildClinicalTimeline(encounter);

  // 13. Review Summary Overview
  const urgentCount = reviewQueue.filter((r) => r.reviewPriority === 'URGENT').length;
  const highCount = reviewQueue.filter((r) => r.reviewPriority === 'HIGH').length;
  const unverifiedCount = facts.filter((f) => f.verificationStatus === 'UNVERIFIED').length;
  const openContrCount = contradictions.filter((c) => c.status === 'OPEN').length;

  const reviewSummary: ClinicalReviewSummary = {
    urgentAlertsCount: urgentCount,
    highAlertsCount: highCount,
    openContradictionsCount: openContrCount,
    unverifiedFactsCount: unverifiedCount,
    overallStatus: validation.overallValidationStatus,
  };

  // 14. Provenance
  const sourcesSet = new Set<ClinicalFactSource>();
  facts.forEach((f) => sourcesSet.add(f.source));

  const provenance: ClinicalBriefProvenance = {
    generatedAt,
    factsCount: facts.length,
    sourcesUsed: Array.from(sourcesSet),
    isLocalOnly: true,
  };

  return {
    encounterId,
    patientId,
    generatedAt,
    patientSummary,
    chiefComplaint: chiefComplaintItem,
    currentSymptoms: currentSymptomsSection,
    historyOfPresentIllness: hpiSection,
    reviewAlerts: reviewAlertsSection,
    allergies: allergiesSection,
    medications: medicationsSection,
    pastMedicalHistory: pastMedicalHistorySection,
    labResults: labResultsSection,
    documents: documentSummaries,
    timeline,
    reviewSummary,
    provenance,
  };
}
