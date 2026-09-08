import { evaluateRedFlags } from '../rules/redFlags';
import { ClinicalEncounter } from '../types/clinical';

export interface SafetyFlag {
  trigger: string;
  source: string;
  timestamp: string;
}

/**
 * Interview Safety Service (Part 10)
 * Evaluates patient text for deterministic red flags.
 * AI MUST NOT diagnose or recommend treatments to the patient.
 */
export const interviewSafetyService = {
  evaluatePatientResponse(text: string, encounter?: ClinicalEncounter): SafetyFlag[] {
    const flags: SafetyFlag[] = [];
    const lower = text.toLowerCase();

    // Critical Emergency Keywords
    if (lower.includes('chest pain') || lower.includes('छाती में दर्द') || lower.includes('सीने में दर्द')) {
      flags.push({
        trigger: 'RED_FLAG_CHEST_PAIN',
        source: 'PATIENT_INPUT',
        timestamp: new Date().toISOString(),
      });
    }

    if (lower.includes('shortness of breath') || lower.includes('difficulty breathing') || lower.includes('सांस लेने में तकलीफ')) {
      flags.push({
        trigger: 'RED_FLAG_DYSPNEA',
        source: 'PATIENT_INPUT',
        timestamp: new Date().toISOString(),
      });
    }

    if (lower.includes('weakness on one side') || lower.includes('slurred speech') || lower.includes('लकवा')) {
      flags.push({
        trigger: 'RED_FLAG_NEUROLOGICAL',
        source: 'PATIENT_INPUT',
        timestamp: new Date().toISOString(),
      });
    }

    if (encounter) {
      const redFlags = evaluateRedFlags((encounter.history || encounter) as any);
      redFlags.forEach((rf) => {
        flags.push({
          trigger: `RED_FLAG_${rf.category}_${rf.title.replace(/\s+/g, '_').toUpperCase()}`,
          source: 'RED_FLAG_RULES',
          timestamp: new Date().toISOString(),
        });
      });
    }

    return flags;
  },
};
