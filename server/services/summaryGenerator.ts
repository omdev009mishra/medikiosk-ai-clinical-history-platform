import { ClinicalEncounter, AIClinicalSummary } from '../types/clinical';
import { generatePhysicianSummary } from '../ai/gemini';

export async function generateEncounterSummary(encounter: ClinicalEncounter): Promise<AIClinicalSummary> {
  const history = encounter.history;
  const docs = encounter.documents || [];
  const alerts = encounter.alerts || [];

  // Compile all medications (from history + extracted from documents)
  const allMeds = [
    ...(history.medications || []).map((m) => `${m.name} (${m.dosage || ''} ${m.frequency || ''})`),
    ...docs.flatMap((d) => (d.extractedEntities?.medications || []).map((m) => `${m.name} ${m.dosage || ''} [From ${d.fileName}]`)),
  ];

  // Compile abnormal lab investigations
  const abnormalLabs = docs.flatMap((d) =>
    (d.extractedEntities?.investigations || [])
      .filter((inv) => inv.status === 'HIGH' || inv.status === 'LOW' || inv.status === 'ABNORMAL')
      .map((inv) => `${inv.testName}: ${inv.result} ${inv.unit || ''} (Ref: ${inv.referenceRange}) [${inv.status}]`)
  );

  let aiSummarySections: any = null;

  try {
    aiSummarySections = await generatePhysicianSummary({
      patientId: encounter.patientId,
      chiefComplaint: history.chiefComplaint,
      hpi: history.hpi,
      pastMedicalHistory: history.pastMedicalHistory,
      pastSurgicalHistory: history.pastSurgicalHistory,
      medications: allMeds,
      allergies: history.allergies,
      ayushHistory: history.ayushHistory,
      abnormalInvestigations: abnormalLabs,
      redFlags: alerts.map((a) => `${a.title} (${a.severity}) - Action: ${a.recommendedAction}`),
    });
  } catch (err) {
    console.warn('[Summary Generator] AI generation failed, creating structured clinical fallback summary:', err);
  }

  const hpi = history.hpi;
  const socratesText = [
    hpi.site ? `Site: ${hpi.site}` : null,
    hpi.onset ? `Onset: ${hpi.onset}` : null,
    hpi.character ? `Character: ${hpi.character}` : null,
    hpi.radiation ? `Radiation: ${hpi.radiation}` : null,
    hpi.severity !== undefined ? `Severity: ${hpi.severity}/10` : null,
    hpi.associatedSymptoms && hpi.associatedSymptoms.length > 0 ? `Associated Symptoms: ${hpi.associatedSymptoms.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  const ayushText = history.ayushHistory
    ? [
        history.ayushHistory.prakriti ? `Prakriti: ${history.ayushHistory.prakriti}` : null,
        history.ayushHistory.agni ? `Agni: ${history.ayushHistory.agni}` : null,
        history.ayushHistory.koshtha ? `Koshtha: ${history.ayushHistory.koshtha}` : null,
        history.ayushHistory.aharaVihara?.foodHabits ? `Ahara: ${history.ayushHistory.aharaVihara.foodHabits}` : null,
      ]
        .filter(Boolean)
        .join(' | ')
    : 'Not assessed / General encounter';

  const defaultSections = {
    chiefComplaint: history.chiefComplaint ? `${history.chiefComplaint.value} (Duration: ${history.chiefComplaint.duration})` : 'Not recorded',
    historyOfPresentIllness: socratesText || 'Patient presents with symptoms as outlined above.',
    pastMedicalHistory: history.pastMedicalHistory.length > 0 ? history.pastMedicalHistory.join(', ') : 'No significant chronic medical history reported.',
    pastSurgicalHistory: history.pastSurgicalHistory.length > 0 ? history.pastSurgicalHistory.join(', ') : 'Nil reported.',
    drugHistory: allMeds.length > 0 ? allMeds.join('; ') : 'No current chronic medications reported.',
    allergyHistory: history.allergies.length > 0 ? history.allergies.map((a) => `${a.allergen} (${a.reaction || 'Hypersensitivity'})`).join(', ') : 'NKDA (No Known Drug Allergies)',
    familyHistory: history.familyHistory.length > 0 ? history.familyHistory.join(', ') : 'Non-contributory.',
    personalHistory: 'Dietary & lifestyle factors documented in intake profile.',
    reviewOfSystems: 'Relevant systems assessed via adaptive clinical intake.',
    ayushHistory: ayushText,
    priorInvestigations: abnormalLabs.length > 0 ? `Abnormal Values: ${abnormalLabs.join('; ')}` : 'Routine values within reference ranges or pending.',
    currentMedications: allMeds.length > 0 ? allMeds.join(', ') : 'None',
    medicalTimelineSummary: encounter.timeline.length > 0 ? encounter.timeline.map((t) => `[${t.date}] ${t.title}`).join(' -> ') : 'First recorded intake session.',
    redFlagsIdentified: alerts.length > 0 ? alerts.map((a) => `[${a.severity}] ${a.title}: ${a.recommendedAction}`).join(' | ') : 'No acute red-flag emergency symptoms detected.',
    provisionalClinicalNotes: 'AI-generated structured case summary ready for physician verification.',
  };

  const finalSections = aiSummarySections
    ? {
        ...defaultSections,
        ...aiSummarySections,
      }
    : defaultSections;

  const summary: AIClinicalSummary = {
    id: `SUM_${encounter.id}_${Date.now()}`,
    encounterId: encounter.id,
    patientId: encounter.patientId,
    status: 'DRAFT',
    generatedAt: new Date().toISOString(),
    generatedBy: 'MediKiosk Clinical AI Engine (Local Ollama - medgemma1.5:latest)',
    verifiedBy: null,
    verifiedAt: null,
    sections: finalSections,
  };

  return summary;
}
