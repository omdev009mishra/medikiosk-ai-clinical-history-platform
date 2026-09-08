import { encounterRepository } from '../db/repositories/encounterRepository';
import { ClinicalEncounter } from '../types/clinical';
import { recordAuditEvent } from './clinicalAuditService';

/**
 * Encounter Management Service (Phase 6.4)
 */
export const encounterService = {
  async createEncounter(data: {
    patientId: string;
    mode?: 'GENERAL' | 'AYUSH';
    language?: 'hi' | 'en' | 'mr' | 'gu' | 'bn' | 'ta' | 'te';
  }): Promise<ClinicalEncounter> {
    const enc = await encounterRepository.create(data);
    recordAuditEvent({
      encounterId: enc.id,
      action: 'CREATED',
      newValue: enc.status,
      performedByRole: 'PATIENT',
      notes: 'New hospital encounter created',
    });
    return enc;
  },

  async getEncounterById(id: string): Promise<ClinicalEncounter | null> {
    return encounterRepository.findById(id);
  },

  async getEncountersByPatient(patientId: string): Promise<ClinicalEncounter[]> {
    return encounterRepository.findByPatientId(patientId);
  },

  async updateStatus(id: string, status: ClinicalEncounter['status']): Promise<ClinicalEncounter | null> {
    const updated = await encounterRepository.updateStatus(id, status);
    if (updated) {
      recordAuditEvent({
        encounterId: id,
        action: 'DOCTOR_VERIFIED',
        newValue: status,
        performedByRole: 'DOCTOR',
        notes: `Encounter status updated to ${status}`,
      });
    }
    return updated;
  },

  async completeEncounter(id: string): Promise<ClinicalEncounter | null> {
    const completed = await encounterRepository.completeEncounter(id);
    if (completed) {
      recordAuditEvent({
        encounterId: id,
        action: 'DOCTOR_VERIFIED',
        newValue: 'VERIFIED',
        performedByRole: 'DOCTOR',
        notes: 'Encounter review finalized and verified by physician',
      });
    }
    return completed;
  },
};
