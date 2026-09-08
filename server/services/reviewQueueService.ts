import { ClinicalFact, ClinicalContradiction, ReviewItem, ReviewPriority } from '../types/clinical';

/**
 * Maps numeric priority scores to non-misleading review priority categories.
 */
export function mapScoreToReviewPriority(score: number): ReviewPriority {
  if (score >= 90) return 'URGENT';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Builds a prioritized review queue from contradictions and low data quality facts using deterministic scoring.
 * Review priorities represent clinical triage urgency for human verification, NOT medical disease probability.
 */
export function buildReviewQueue(
  encounterId: string,
  facts: ClinicalFact[],
  contradictions: ClinicalContradiction[]
): ReviewItem[] {
  const queue: ReviewItem[] = [];

  // 1. Add Contradictions to Review Queue
  for (const contr of contradictions) {
    let priorityScore = 40;
    if (contr.severity === 'CRITICAL') priorityScore = 100;
    else if (contr.severity === 'HIGH') priorityScore = 80;
    else if (contr.severity === 'MEDIUM') priorityScore = 50;

    const reviewPriority = mapScoreToReviewPriority(priorityScore);

    queue.push({
      id: `REV_CONTR_${contr.id}`,
      encounterId,
      type: 'CONTRADICTION',
      priorityScore,
      reviewPriority,
      title: `Data Conflict: ${contr.category}`,
      description: contr.description,
      contradictionId: contr.id,
      criticality: contr.severity,
      status: contr.status === 'OPEN' ? 'OPEN' : 'RESOLVED',
      createdAt: contr.createdAt,
    });
  }

  // 2. Add Low Data Quality Facts & Unverified Critical Facts to Review Queue
  for (const fact of facts) {
    const dq = fact.dataQuality;
    const isLowOcr = dq?.ocrQuality !== undefined && dq.ocrQuality < 0.70;
    const isLowComp = dq?.completenessScore !== undefined && dq.completenessScore < 0.75;
    const isNeedsReview = fact.verificationStatus === 'NEEDS_REVIEW' || isLowOcr || isLowComp;

    if (isNeedsReview) {
      let priorityScore = 30;
      if (fact.criticality === 'CRITICAL') priorityScore = 75;
      else if (fact.criticality === 'HIGH') priorityScore = 60;
      else if (fact.criticality === 'MEDIUM') priorityScore = 40;

      const factValStr = typeof fact.value === 'string' ? fact.value : fact.value?.name || fact.value?.testName || fact.value?.value || 'Clinical Fact';

      let title = `Review Required: ${fact.type}`;
      if (isLowOcr) {
        title = `OCR Quality Review (${Math.round((dq?.ocrQuality || 0) * 100)}% Readability): ${fact.type}`;
      } else if (isLowComp) {
        title = `Record Completeness Review (${Math.round((dq?.completenessScore || 0) * 100)}% Complete): ${fact.type}`;
      }

      const reviewPriority = mapScoreToReviewPriority(priorityScore);

      queue.push({
        id: `REV_FACT_${fact.id}`,
        encounterId,
        type: 'LOW_CONFIDENCE_FACT',
        priorityScore,
        reviewPriority,
        title,
        description: `Source: ${fact.source} (${fact.sourceReference || 'Intake'}). Value: "${factValStr}". Preserved for physician verification.`,
        factId: fact.id,
        criticality: fact.criticality,
        status: fact.verificationStatus === 'DOCTOR_VERIFIED' || fact.verificationStatus === 'PATIENT_CONFIRMED' ? 'RESOLVED' : 'OPEN',
        createdAt: fact.createdAt,
      });
    }
  }

  // Sort descending by priorityScore
  return queue.sort((a, b) => b.priorityScore - a.priorityScore);
}
