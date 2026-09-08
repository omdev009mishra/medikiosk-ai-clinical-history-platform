import { ClinicalAuditEvent } from '../types/clinical';

// In-memory audit trail store
const auditTrailStore: ClinicalAuditEvent[] = [];

/**
 * Appends a new event to the Clinical Audit Trail.
 */
export function recordAuditEvent(event: Omit<ClinicalAuditEvent, 'id' | 'performedAt'>): ClinicalAuditEvent {
  const auditEvent: ClinicalAuditEvent = {
    id: `AUDIT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    performedAt: new Date().toISOString(),
    ...event,
  };

  auditTrailStore.push(auditEvent);
  return auditEvent;
}

/**
 * Retrieves audit log history for a specific encounter.
 */
export function getEncounterAuditTrail(encounterId: string): ClinicalAuditEvent[] {
  return auditTrailStore
    .filter((e) => e.encounterId === encounterId)
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
}
