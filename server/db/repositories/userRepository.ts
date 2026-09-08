import { DoctorUser } from '../../types/clinical';
import { clinicalStore } from '../store';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'PATIENT' | 'KIOSK_OPERATOR' | 'DOCTOR' | 'ADMIN';
  passwordHash: string;
}

const userStore: Map<string, AppUser> = new Map([
  [
    'dr.verma@hospital.aiia.gov.in',
    {
      id: 'DOC_DR_VERMA',
      email: 'dr.verma@hospital.aiia.gov.in',
      name: 'Dr. Alok Verma',
      role: 'DOCTOR',
      passwordHash: '1234', // default PIN / hashed password
    },
  ],
  [
    'admin@hospital.aiia.gov.in',
    {
      id: 'ADMIN_SUPERINTENDENT',
      email: 'admin@hospital.aiia.gov.in',
      name: 'OPD Admin Superintendent',
      role: 'ADMIN',
      passwordHash: 'admin123',
    },
  ],
]);

/**
 * User Repository Layer (Phase 6.1 & 6.6)
 */
export const userRepository = {
  async findByEmail(email: string): Promise<AppUser | null> {
    return userStore.get(email.toLowerCase().trim()) || null;
  },

  async findById(id: string): Promise<AppUser | null> {
    return Array.from(userStore.values()).find((u) => u.id === id) || null;
  },

  async createUser(user: AppUser): Promise<AppUser> {
    userStore.set(user.email.toLowerCase().trim(), user);
    return user;
  },

  async getDoctors(): Promise<DoctorUser[]> {
    return clinicalStore.getAllDoctors();
  },
};
