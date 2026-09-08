import { ClinicalEncounter, Patient } from '../types/clinical';

export interface HISSyncResult {
  success: boolean;
  hisPatientId: string;
  hisEncounterId: string;
  syncTimestamp: string;
  emrEndpoint: string;
  message: string;
  system: string;
}

export class HospitalIntegrationService {
  private hisBaseUrl: string;

  constructor() {
    this.hisBaseUrl = process.env.HIS_BASE_URL || 'https://e-hospital.nic.in/api/v2';
  }

  async syncVerifiedRecord(encounter: ClinicalEncounter, patient: Patient): Promise<HISSyncResult> {
    // Simulates integration with hospital EMR (e.g. e-Hospital, Ayush EHR, OpenMRS, Epic/Cerner HL7/FHIR)
    const hisPatientId = `HIS_PAT_${patient.id}`;
    const hisEncounterId = `HIS_ENC_${encounter.id}`;

    return {
      success: true,
      hisPatientId,
      hisEncounterId,
      syncTimestamp: new Date().toISOString(),
      emrEndpoint: `${this.hisBaseUrl}/opd/intake-sync`,
      message: 'Verified clinical history and summary pushed to Hospital Information System (e-Hospital / EMR) database.',
      system: 'NIC e-Hospital & Ayush EHR Gateway',
    };
  }
}

export const hospitalIntegrationService = new HospitalIntegrationService();
