import { patientRepository } from '../db/repositories/patientRepository';
import { Patient } from '../types/clinical';

/**
 * Patient Management Service (Phase 6.2 & 6.3)
 */
export const patientService = {
  async registerPatient(data: {
    fullName: string;
    dateOfBirth: string;
    gender: string;
    phoneNumber: string;
    abhaId?: string;
  }): Promise<Patient> {
    if (!data.fullName || !data.phoneNumber) {
      throw new Error('fullName and phoneNumber are required for patient registration.');
    }
    return patientRepository.create(data);
  },

  async getPatientById(id: string): Promise<Patient | null> {
    return patientRepository.findById(id);
  },

  async getPatientByHospitalId(hospitalId: string): Promise<Patient | null> {
    return patientRepository.findByHospitalId(hospitalId);
  },

  async searchPatients(query: string): Promise<Patient[]> {
    return patientRepository.search(query);
  },

  async updatePatientProfile(id: string, updates: Partial<Patient>): Promise<Patient | null> {
    return patientRepository.update(id, updates);
  },
};
