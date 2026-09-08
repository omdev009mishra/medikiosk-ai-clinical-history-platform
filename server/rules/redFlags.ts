import { ClinicalHistoryState, RedFlagAlert } from '../types/clinical';

interface RedFlagRule {
  id: string;
  category: 'CARDIAC' | 'NEUROLOGICAL' | 'RESPIRATORY' | 'ABDOMINAL' | 'SEPSIS' | 'OTHER';
  title: string;
  severity: 'EMERGENCY' | 'HIGH' | 'MEDIUM';
  description: string;
  recommendedAction: string;
  evaluator: (state: ClinicalHistoryState, rawUtterance?: string) => { matched: boolean; matchedSymptoms: string[] };
}

export const CLINICAL_RED_FLAG_RULES: RedFlagRule[] = [
  // 1. CARDIAC: Acute Coronary Syndrome / Ischemic chest pain
  {
    id: 'RF_CARDIAC_ACS',
    category: 'CARDIAC',
    title: 'Potential Acute Coronary Syndrome / Ischemic Chest Pain',
    severity: 'EMERGENCY',
    description: 'Patient reports severe central/retrosternal chest discomfort with radiation to left arm, neck, or jaw, or associated diaphoresis/dyspnea.',
    recommendedAction: 'Immediate triage to Emergency Department / Cardiac Resuscitation room. Urgent 12-lead ECG and stat Troponin/vitals check.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${state.hpi?.site || ''} ${state.hpi?.radiation || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();
      const hasChestPain = text.includes('chest pain') || text.includes('seene me dard') || text.includes('chhati me dard') || text.includes('retrosternal') || text.includes('seene mein dard') || text.includes('chest pressure');
      const hasRadiationOrDyspnea = text.includes('left arm') || text.includes('baye haath') || text.includes('baen hath') || text.includes('jaw') || text.includes('sweating') || text.includes('paseena') || text.includes('breath') || text.includes('saans') || text.includes('dyspnea');
      const highSeverity = (state.hpi?.severity || 0) >= 7;

      if (hasChestPain && (hasRadiationOrDyspnea || highSeverity)) {
        const symptoms: string[] = ['Chest Pain / Pressure'];
        if (text.includes('left arm') || text.includes('baye haath') || text.includes('baen hath')) symptoms.push('Radiation to Left Arm');
        if (text.includes('sweating') || text.includes('paseena')) symptoms.push('Diaphoresis / Sweating');
        if (text.includes('breath') || text.includes('saans')) symptoms.push('Dyspnea / Breathlessness');
        if (highSeverity) symptoms.push(`High pain score (${state.hpi?.severity}/10)`);
        return { matched: true, matchedSymptoms: symptoms };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 2. NEUROLOGICAL: Acute Stroke / Thunderclap Headache
  {
    id: 'RF_NEURO_STROKE_HEADACHE',
    category: 'NEUROLOGICAL',
    title: 'Acute Neurological Red Flag / Thunderclap Headache / Stroke Symptoms',
    severity: 'EMERGENCY',
    description: 'Sudden onset "worst headache of life", focal motor weakness, slurred speech, facial asymmetry, or altered sensorium.',
    recommendedAction: 'Priority neurological assessment. Immediate Non-Contrast CT Brain protocol and NIHSS evaluation.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${state.hpi?.onset || ''} ${state.hpi?.character || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();
      const hasSevereHeadache = (text.includes('headache') || text.includes('sir dard') || text.includes('sar dard')) && (text.includes('thunderclap') || text.includes('worst') || text.includes('sudden') || text.includes('ekdum se') || (state.hpi?.severity || 0) >= 9);
      const hasNeuroDeficit = text.includes('weakness') || text.includes('kamzori') || text.includes('slurred') || text.includes('paralysis') || text.includes('falij') || text.includes('vision loss') || text.includes('behosh') || text.includes('unconscious');

      if (hasSevereHeadache || hasNeuroDeficit) {
        const symptoms: string[] = [];
        if (hasSevereHeadache) symptoms.push('Severe / Sudden Onset Headache (Thunderclap characteristic)');
        if (hasNeuroDeficit) symptoms.push('Focal Neurological Deficit / Weakness / Altered Consciousness');
        return { matched: true, matchedSymptoms: symptoms };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 3. RESPIRATORY: Acute Severe Respiratory Distress / Stridor
  {
    id: 'RF_RESP_DISTRESS',
    category: 'RESPIRATORY',
    title: 'Acute Respiratory Compromise / Severe Dyspnea',
    severity: 'EMERGENCY',
    description: 'Severe difficulty breathing at rest, inability to complete full sentences, stridor, or cyanosis.',
    recommendedAction: 'Immediate oxygenation support, continuous SpO2 monitoring, and urgent airway evaluation by emergency physician.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();
      const hasSevereDyspnea = (text.includes('saans lene me') || text.includes('breathless') || text.includes('dyspnea') || text.includes('gasping')) && (text.includes('severe') || text.includes('rest') || text.includes('bohot zyada') || text.includes('stridor') || text.includes('blue lips'));

      if (hasSevereDyspnea) {
        return {
          matched: true,
          matchedSymptoms: ['Severe Respiratory Distress', 'Acute Dyspnea at Rest'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 4. ABDOMINAL: Acute Abdomen / Peritonitis / Severe Gastrointestinal Bleeding
  {
    id: 'RF_ABDOMINAL_ACUTE',
    category: 'ABDOMINAL',
    title: 'Acute Surgical Abdomen / GI Hemorrhage',
    severity: 'HIGH',
    description: 'Severe persistent abdominal pain with guarding/rigidity, hematemesis (vomiting blood), or melena (black tarry stool).',
    recommendedAction: 'Urgent surgical consult, baseline blood work, and abdominal ultrasound/imaging evaluation.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${state.hpi?.site || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();
      const hasAbdPain = text.includes('pet dard') || text.includes('abdominal pain') || text.includes('stomach pain') || text.includes('belly pain');
      const hasGIWarning = text.includes('vomiting blood') || text.includes('khoon ki ulti') || text.includes('hematemesis') || text.includes('black stool') || text.includes('kala tatti') || text.includes('rigid') || text.includes('guarding');

      if ((hasAbdPain && (state.hpi?.severity || 0) >= 8) || hasGIWarning) {
        const symptoms: string[] = [];
        if (hasAbdPain) symptoms.push(`Severe abdominal pain (${state.hpi?.severity || 'High'}/10)`);
        if (hasGIWarning) symptoms.push('GI Bleeding / Peritoneal irritation symptoms');
        return { matched: true, matchedSymptoms: symptoms };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },
];

export function evaluateRedFlags(history: ClinicalHistoryState, rawUtterance?: string): RedFlagAlert[] {
  const alerts: RedFlagAlert[] = [];

  for (const rule of CLINICAL_RED_FLAG_RULES) {
    const result = rule.evaluator(history, rawUtterance);
    if (result.matched) {
      alerts.push({
        id: `ALERT_${rule.id}_${Date.now()}`,
        severity: rule.severity,
        category: rule.category,
        title: rule.title,
        description: rule.description,
        matchedSymptoms: result.matchedSymptoms,
        recommendedAction: rule.recommendedAction,
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  return alerts;
}
