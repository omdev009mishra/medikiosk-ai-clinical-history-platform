import { ClinicalEncounter, TimelineEvent } from '../types/clinical';
import { normalizeDate } from './clinicalNormalizationService';

/**
 * Clinical Timeline Service
 * Builds a unified chronological timeline of all health events, documents, labs, and intake interactions.
 */
export function buildClinicalTimeline(encounter: ClinicalEncounter): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 1. Current Intake Event
  events.push({
    id: `EV_INTAKE_${encounter.id}`,
    date: encounter.createdAt || new Date().toISOString(),
    title: 'MediKiosk Intake Started',
    category: 'INTAKE',
    description: `Patient initiated self-service intake (${encounter.mode} mode, ${encounter.language.toUpperCase()})`,
  });

  // 2. Chief Complaint Event
  if (encounter.history?.chiefComplaint?.value) {
    events.push({
      id: `EV_CC_${encounter.id}`,
      date: encounter.createdAt || new Date().toISOString(),
      title: `Chief Complaint Reported: ${encounter.history.chiefComplaint.value}`,
      category: 'INTAKE',
      description: `Duration: ${encounter.history.chiefComplaint.duration || 'Not specified'}`,
    });
  }

  // 3. Document Uploads
  if (encounter.documents && Array.isArray(encounter.documents)) {
    encounter.documents.forEach((doc) => {
      const ocrQualPct = doc.ocrConfidence !== undefined ? Math.round(doc.ocrConfidence * 100) : 88;
      events.push({
        id: `EV_DOC_${doc.id}`,
        date: doc.uploadDate || encounter.createdAt,
        title: `Document Uploaded: ${doc.fileName}`,
        category: doc.documentType === 'PRESCRIPTION' ? 'PRESCRIPTION' : doc.documentType === 'LAB_REPORT' ? 'INVESTIGATION' : 'INTAKE',
        description: `Type: ${doc.documentType} (PaddleOCR Quality: ${ocrQualPct}%)`,
        sourceDocumentId: doc.id,
        sourceDocumentName: doc.fileName,
      });

      // Extracted Lab Investigations Timeline Events
      if (doc.extractedEntities?.investigations) {
        doc.extractedEntities.investigations.forEach((inv, idx) => {
          const normDate = normalizeDate(inv.date || '');
          const eventDate = normDate.isoDate || doc.uploadDate || encounter.createdAt;
          const isAbnormal = inv.status === 'HIGH' || inv.status === 'LOW' || inv.status === 'ABNORMAL';

          events.push({
            id: `EV_LAB_${doc.id}_${idx}`,
            date: eventDate,
            title: `Lab Test: ${inv.testName}`,
            category: 'INVESTIGATION',
            description: `Result: ${inv.result} ${inv.unit} (Ref: ${inv.referenceRange || 'N/A'})${normDate.isAmbiguous ? ' ⚠️ Ambiguous Date' : ''}`,
            sourceDocumentId: doc.id,
            sourceDocumentName: doc.fileName,
            isAbnormal,
          });
        });
      }
    });
  }

  // 4. Historical Medications
  if (encounter.history?.medications && Array.isArray(encounter.history.medications)) {
    encounter.history.medications.forEach((med, idx) => {
      events.push({
        id: `EV_MED_${encounter.id}_${idx}`,
        date: (med as any).prescribedDate || encounter.createdAt,
        title: `Medication Documented: ${med.name}`,
        category: 'PRESCRIPTION',
        description: `Dosage: ${med.dosage || 'N/A'}, Frequency: ${med.frequency || 'N/A'} (Source: ${med.source || 'Patient History'})`,
        sourceDocumentName: med.sourceDocument,
      });
    });
  }

  // Sort events chronologically (latest date first)
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
