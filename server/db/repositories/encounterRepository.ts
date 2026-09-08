import { ClinicalEncounter } from '../../types/clinical';
import { clinicalStore } from '../store';

/**
 * Encounter Repository Layer (Phase 6.1 & 6.4)
 */
export const encounterRepository = {
  async findById(id: string): Promise<ClinicalEncounter | null> {
    return clinicalStore.getEncounter(id) || null;
  },

  async findByPatientId(patientId: string): Promise<ClinicalEncounter[]> {
    return clinicalStore
      .getAllEncounters()
      .filter((e) => e.patientId === patientId);
  },

  async findAll(): Promise<ClinicalEncounter[]> {
    return clinicalStore.getAllEncounters();
  },

  async create(data: {
    patientId: string;
    mode?: 'GENERAL' | 'AYUSH';
    language?: 'hi' | 'en' | 'mr' | 'gu' | 'bn' | 'ta' | 'te';
  }): Promise<ClinicalEncounter> {
    return clinicalStore.createEncounter(data);
  },

  async updateStatus(id: string, status: ClinicalEncounter['status']): Promise<ClinicalEncounter | null> {
    const updated = clinicalStore.updateEncounter(id, { status });
    return updated || null;
  },

  async completeEncounter(id: string): Promise<ClinicalEncounter | null> {
    const updated = clinicalStore.updateEncounter(id, {
      status: 'VERIFIED',
      hisSyncStatus: 'SYNCED',
    });
    return updated || null;
  },
};
