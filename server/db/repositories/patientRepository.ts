import { Patient } from '../../types/clinical';
import { clinicalStore } from '../store';

/**
 * Patient Repository Layer (Phase 6.1)
 */
export const patientRepository = {
  async findById(id: string): Promise<Patient | null> {
    const p = clinicalStore.getPatient(id);
    return p || null;
  },

  async findByHospitalId(hospitalPatientId: string): Promise<Patient | null> {
    return clinicalStore.findPatientByHospitalId(hospitalPatientId) || null;
  },

  async search(query: string): Promise<Patient[]> {
    return clinicalStore.searchPatients(query);
  },

  async create(data: {
    fullName: string;
    dateOfBirth: string;
    gender: string;
    phoneNumber: string;
    abhaId?: string;
  }): Promise<Patient> {
    return clinicalStore.registerPatient(data);
  },

  async update(id: string, updates: Partial<Patient>): Promise<Patient | null> {
    return clinicalStore.updatePatient(id, updates);
  },
};
