import { patientRepository } from '../db/repositories/patientRepository';
import { encounterRepository } from '../db/repositories/encounterRepository';
import { Patient, ClinicalEncounter } from '../types/clinical';

export interface PatientHistoryOverview {
  patient: Patient;
  totalEncountersCount: number;
  encounters: ClinicalEncounter[];
  pastVerifiedMedications: string[];
  pastVerifiedAllergies: string[];
  pastVerifiedDiagnoses: string[];
  pastDocumentsCount: number;
}

/**
 * Patient History Service (Phase 6.3)
 */
export const patientHistoryService = {
  async getPatientHistoryOverview(patientId: string): Promise<PatientHistoryOverview | null> {
    const patient = await patientRepository.findById(patientId);
    if (!patient) return null;

    const encounters = await encounterRepository.findByPatientId(patientId);

    const verifiedMeds = new Set<string>();
    const verifiedAllergies = new Set<string>();
    const verifiedDiagnoses = new Set<string>();
    let docsCount = 0;

    encounters.forEach((enc) => {
      docsCount += (enc.documents || []).length;
      if (enc.validation?.facts) {
        enc.validation.facts.forEach((f) => {
          if (f.verificationStatus === 'DOCTOR_VERIFIED' || f.verificationStatus === 'PATIENT_CONFIRMED') {
            if (f.type === 'MEDICATION') verifiedMeds.add(f.value?.name || f.normalizedValue?.canonicalName || JSON.stringify(f.value));
            if (f.type === 'ALLERGY') verifiedAllergies.add(f.value?.allergen || JSON.stringify(f.value));
            if (f.type === 'DIAGNOSIS') verifiedDiagnoses.add(f.value?.name || JSON.stringify(f.value));
          }
        });
      }
    });

    return {
      patient,
      totalEncountersCount: encounters.length,
      encounters,
      pastVerifiedMedications: Array.from(verifiedMeds),
      pastVerifiedAllergies: Array.from(verifiedAllergies),
      pastVerifiedDiagnoses: Array.from(verifiedDiagnoses),
      pastDocumentsCount: docsCount,
    };
  },
};
