import { evaluateRedFlags } from '../rules/redFlags';
import { ClinicalEncounter, RedFlagAlert } from '../types/clinical';

export interface SafetyFlag {
  trigger: string;
  source: string;
  timestamp: string;
  severity?: string;
  category?: string;
  title?: string;
  description?: string;
  recommendedAction?: string;
  matchedSymptoms?: string[];
}

/**
 * Interview Safety Service
 * Evaluates patient text and history for deterministic red flags.
 * CRITICAL RULE: AI MUST NOT diagnose disease or make assertions such as "You are having a heart attack".
 * Instead, it uses calm, warning-based escalation guidance directing to emergency staff.
 */
export const interviewSafetyService = {
  evaluatePatientResponse(text: string, encounter?: ClinicalEncounter): SafetyFlag[] {
    const flags: SafetyFlag[] = [];
    const history = encounter?.history || { hpi: {}, pastMedicalHistory: [], pastSurgicalHistory: [], medications: [], allergies: [], familyHistory: [], personalHistory: {}, reviewOfSystems: {} };

    const detectedAlerts = evaluateRedFlags(history as any, text);

    for (const alert of detectedAlerts) {
      flags.push({
        trigger: `RED_FLAG_${alert.category}_${alert.id}`,
        source: 'CLINICAL_RED_FLAG_ENGINE',
        timestamp: new Date().toISOString(),
        severity: alert.severity,
        category: alert.category,
        title: alert.title,
        description: alert.description,
        recommendedAction: alert.recommendedAction,
        matchedSymptoms: alert.matchedSymptoms,
      });
    }

    return flags;
  },

  checkEmergency(text: string, encounter?: ClinicalEncounter): { isEmergency: boolean; alert?: RedFlagAlert; messageEn: string; messageHi: string } {
    const history = encounter?.history || { hpi: {}, pastMedicalHistory: [], pastSurgicalHistory: [], medications: [], allergies: [], familyHistory: [], personalHistory: {}, reviewOfSystems: {} };
    const alerts = evaluateRedFlags(history as any, text);
    const emergencyAlert = alerts.find((a) => a.severity === 'EMERGENCY') || alerts[0];

    if (emergencyAlert) {
      return {
        isEmergency: true,
        alert: emergencyAlert,
        messageEn: "Based on what you've told me, you may need prompt medical attention. Please stay calm, remain with a family member or nearby staff member, and proceed directly to the Casualty desk.",
        messageHi: "आपके द्वारा बताए गए लक्षणों के आधार पर, आपको तुरंत चिकित्सकीय ध्यान (Immediate Medical Attention) की आवश्यकता हो सकती है। कृपया घबराएं नहीं। अपने किसी परिजन या अस्पताल कर्मी के साथ सीधे कैजुअल्टी (Casualty Desk) में जाएं।",
      };
    }

    return {
      isEmergency: false,
      messageEn: '',
      messageHi: '',
    };
  },
};

