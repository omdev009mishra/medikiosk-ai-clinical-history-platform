import { ClinicalFact, ClinicalContradiction, ContradictionSeverity } from '../types/clinical';

/**
 * Detects cross-source data contradictions across canonical clinical facts.
 * Never deletes or overwrites conflicting facts; preserves both alongside source provenance.
 */
export function detectContradictions(facts: ClinicalFact[]): ClinicalContradiction[] {
  const contradictions: ClinicalContradiction[] = [];

  // Group facts by type
  const allergyFacts = facts.filter((f) => f.type === 'ALLERGY');
  const medicationFacts = facts.filter((f) => f.type === 'MEDICATION');
  const labFacts = facts.filter((f) => f.type === 'LAB_RESULT');
  const timelineFacts = facts.filter((f) => f.type === 'TIMELINE_EVENT' || f.type === 'SYMPTOM');

  // 1. ALLERGY CONTRADICTIONS
  // Compare "No allergies" reported by patient vs documented allergen records
  const noAllergyFact = allergyFacts.find((f) => {
    const val = String(f.value?.allergen || f.value || '').toLowerCase();
    return val === 'no_allergies' || val.includes('no known allergy') || val.includes('nkda') || val === 'none';
  });

  const specificAllergyFacts = allergyFacts.filter((f) => {
    const val = String(f.value?.allergen || f.value || '').toLowerCase();
    return val !== 'no_allergies' && !val.includes('no known allergy') && val !== 'nkda' && val !== 'none';
  });

  if (noAllergyFact && specificAllergyFacts.length > 0) {
    for (const specificFact of specificAllergyFacts) {
      const allergenName = specificFact.value?.allergen || specificFact.value;
      contradictions.push({
        id: `CONTR_ALLERGY_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        encounterId: specificFact.encounterId,
        category: 'ALLERGY',
        severity: 'CRITICAL',
        description: `Allergy Discrepancy: ${noAllergyFact.source} reports "No known allergies", but ${specificFact.source} (${specificFact.sourceReference || 'Document'}) documents an active allergy to "${allergenName}".`,
        factIds: [noAllergyFact.id, specificFact.id],
        sources: Array.from(new Set([noAllergyFact.source, specificFact.source])),
        status: 'OPEN',
        reviewRequired: true,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 2. MEDICATION CONTRADICTIONS
  // Group medications by canonical name
  const medGroups: Record<string, ClinicalFact[]> = {};
  for (const mFact of medicationFacts) {
    const canonicalName = mFact.normalizedValue?.canonicalName || String(mFact.value?.name || mFact.value).toLowerCase().trim();
    if (canonicalName) {
      if (!medGroups[canonicalName]) medGroups[canonicalName] = [];
      medGroups[canonicalName].push(mFact);
    }
  }

  for (const [canonicalName, mFacts] of Object.entries(medGroups)) {
    if (mFacts.length > 1) {
      // Check if dosages or frequencies differ across sources
      const dosages = mFacts.map((f) => f.normalizedValue?.dosage?.amount || f.value?.dosage);
      const frequencies = mFacts.map((f) => f.normalizedValue?.frequency || f.value?.frequency);

      const uniqueDosages = Array.from(new Set(dosages.filter(Boolean)));
      const uniqueFreqs = Array.from(new Set(frequencies.filter(Boolean)));

      if (uniqueDosages.length > 1 || uniqueFreqs.length > 1) {
        const sourceDetails = mFacts
          .map((f) => `${f.source} (${f.value?.name} ${f.value?.dosage || ''} ${f.value?.frequency || ''})`)
          .join(' vs ');

        contradictions.push({
          id: `CONTR_MED_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          encounterId: mFacts[0].encounterId,
          category: 'MEDICATION',
          severity: 'HIGH',
          description: `Medication Regimen Discrepancy for "${mFacts[0].value?.name || canonicalName}": Differing dosage/frequency across sources: ${sourceDetails}.`,
          factIds: mFacts.map((f) => f.id),
          sources: Array.from(new Set(mFacts.map((f) => f.source))),
          status: 'OPEN',
          reviewRequired: true,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // 3. LAB RESULT CONTRADICTIONS
  // Lab results on DIFFERENT dates are historical observations, NOT contradictions.
  // Lab results on the SAME date with conflicting values are flagged.
  const labGroups: Record<string, ClinicalFact[]> = {};
  for (const lFact of labFacts) {
    const testName = lFact.normalizedValue?.canonicalTestName || String(lFact.value?.testName || '').toLowerCase().trim();
    const date = lFact.normalizedValue?.date || lFact.value?.date || 'UNDATED';
    const key = `${testName}_${date}`;
    if (testName) {
      if (!labGroups[key]) labGroups[key] = [];
      labGroups[key].push(lFact);
    }
  }

  for (const [key, lFacts] of Object.entries(labGroups)) {
    if (lFacts.length > 1) {
      const results = lFacts.map((f) => f.value?.result);
      const uniqueResults = Array.from(new Set(results));
      if (uniqueResults.length > 1) {
        const testName = lFacts[0].value?.testName || key.split('_')[0];
        contradictions.push({
          id: `CONTR_LAB_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          encounterId: lFacts[0].encounterId,
          category: 'LAB_RESULT',
          severity: 'HIGH',
          description: `Conflicting Laboratory Values for "${testName}" on the same date: ${lFacts.map((f) => `${f.source}: ${f.value?.result} ${f.value?.unit || ''}`).join(' vs ')}.`,
          factIds: lFacts.map((f) => f.id),
          sources: Array.from(new Set(lFacts.map((f) => f.source))),
          status: 'OPEN',
          reviewRequired: true,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // 4. TIMELINE / ONSET CONTRADICTIONS
  // Check onset duration differences (e.g. "2 hours" vs "3 weeks")
  const durationFacts = timelineFacts.filter((f) => f.value?.duration || f.value?.onset);
  if (durationFacts.length > 1) {
    const durations = durationFacts.map((f) => String(f.value?.duration || f.value?.onset).toLowerCase());
    const hasRecent = durations.some((d) => d.includes('hour') || d.includes('today') || d.includes('yesterday'));
    const hasChronic = durations.some((d) => d.includes('week') || d.includes('month') || d.includes('year'));

    if (hasRecent && hasChronic) {
      contradictions.push({
        id: `CONTR_TL_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        encounterId: durationFacts[0].encounterId,
        category: 'TIMELINE',
        severity: 'MEDIUM',
        description: `Symptom Timeline Discrepancy: ${durationFacts.map((f) => `${f.source} reports "${f.value?.duration || f.value?.onset}"`).join(' vs ')}.`,
        factIds: durationFacts.map((f) => f.id),
        sources: Array.from(new Set(durationFacts.map((f) => f.source))),
        status: 'OPEN',
        reviewRequired: true,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return contradictions;
}
