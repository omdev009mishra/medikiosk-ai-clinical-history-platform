import { ClinicalFact } from '../../types/clinical';
import { clinicalStore } from '../store';

/**
 * Clinical Fact Repository Layer (Phase 6.1 & 6.5)
 */
export const clinicalFactRepository = {
  async findByEncounterId(encounterId: string): Promise<ClinicalFact[]> {
    const encounter = clinicalStore.getEncounter(encounterId);
    return encounter?.validation?.facts || [];
  },

  async findById(encounterId: string, factId: string): Promise<ClinicalFact | null> {
    const facts = await this.findByEncounterId(encounterId);
    return facts.find((f) => f.id === factId) || null;
  },
};
