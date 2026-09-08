import { DocumentRecord } from '../../types/clinical';
import { clinicalStore } from '../store';

/**
 * Document Repository Layer (Phase 6.1 & 6.5)
 */
export const documentRepository = {
  async findByEncounterId(encounterId: string): Promise<DocumentRecord[]> {
    const encounter = clinicalStore.getEncounter(encounterId);
    return encounter?.documents || [];
  },

  async addDocument(encounterId: string, document: DocumentRecord): Promise<DocumentRecord> {
    const encounter = clinicalStore.getEncounter(encounterId);
    if (encounter) {
      encounter.documents.push(document);
      clinicalStore.updateEncounter(encounterId, { documents: encounter.documents });
    }
    return document;
  },
};
