import { ClinicalHistoryState, RedFlagAlert } from '../types/clinical';

export interface RedFlagRule {
  id: string;
  category: 'CARDIAC' | 'NEUROLOGICAL' | 'RESPIRATORY' | 'ABDOMINAL' | 'SEPSIS' | 'TRAUMA' | 'ANAPHYLAXIS' | 'OTHER';
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
    description: 'Patient reports chest pain, pressure, crushing discomfort, radiation to arm/jaw, or cold diaphoresis.',
    recommendedAction: 'Immediate triage to Emergency / Cardiac Resuscitation room. Urgent 12-lead ECG, SpO2, and stat Troponin.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${state.hpi?.site || ''} ${state.hpi?.radiation || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const chestKeywords = [
        'chest pain', 'chest pressure', 'chest tightness', 'chest discomfort', 'crushing chest',
        'heavy chest', 'heart pain', 'retrosternal', 'seene me dard', 'seene mein dard',
        'chhati me dard', 'chhati mein dard', 'seene par bojh', 'seene me dabav', 'chati me dard',
        'छाती में दर्द', 'सीने में दर्द', 'छाती भारी', 'सीने में भारीपन', 'छाती में दबाव',
      ];
      const hasChestPain = chestKeywords.some((k) => text.includes(k));

      const associatedKeywords = [
        'left arm', 'baye haath', 'baye hath', 'baen hath', 'jaw', 'jabda', 'sweating',
        'paseena', 'cold sweat', 'breath', 'saans', 'dyspnea', 'ghabrahat', 'dizziness',
        'बाएं हाथ', 'जबड़ा', 'पसीना', 'सांस फूलना',
      ];
      const hasAssociated = associatedKeywords.some((k) => text.includes(k));
      const highSeverity = (state.hpi?.severity || 0) >= 7 || text.includes('severe') || text.includes('bohot tez') || text.includes('बहुत तेज');

      if (hasChestPain && (hasAssociated || highSeverity)) {
        const symptoms: string[] = ['Chest Pain / Pressure / Heaviness'];
        if (text.includes('left arm') || text.includes('baye') || text.includes('baen') || text.includes('बाएं हाथ')) symptoms.push('Radiation to Arm');
        if (text.includes('jaw') || text.includes('jabda') || text.includes('जबड़ा')) symptoms.push('Radiation to Jaw');
        if (text.includes('sweat') || text.includes('paseena') || text.includes('पसीना')) symptoms.push('Diaphoresis / Sweating');
        if (text.includes('breath') || text.includes('saans') || text.includes('सांस')) symptoms.push('Shortness of Breath');
        if (highSeverity) symptoms.push('Severe Pain Intensity');
        return { matched: true, matchedSymptoms: symptoms };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 2. NEUROLOGICAL: Acute Stroke / Thunderclap Headache / Focal Deficit
  {
    id: 'RF_NEURO_STROKE_HEADACHE',
    category: 'NEUROLOGICAL',
    title: 'Acute Neurological Red Flag / Stroke Symptoms / Thunderclap Headache',
    severity: 'EMERGENCY',
    description: 'Sudden onset focal weakness, facial asymmetry, slurred speech, paralysis, or severe sudden thunderclap headache.',
    recommendedAction: 'Immediate Code Stroke protocol. Urgent Non-Contrast CT Brain and priority neurological evaluation.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${state.hpi?.onset || ''} ${state.hpi?.character || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const strokeKeywords = [
        'slurred speech', 'facial droop', 'one side weakness', 'weakness on one side',
        'arm weakness', 'paralysis', 'hemiplegia', 'stroke', 'falij', 'lakwa', 'lakva',
        'muh tedha', 'mooh tedha', 'chehra tedha', 'ek taraf kamzori', 'bolne me dikkat',
        'bol nahi pa raha', 'ladkhadahat', 'ladkhada', 'sunn', 'ek side sunn', 'ek taraf sunn',
        'लकवा', 'फालिज', 'मुंह टेढ़ा', 'आवाज लड़खड़ाना', 'लड़खड़ाहट', 'एक तरफ कमजोरी', 'सुन्न',
      ];
      const hasStrokeSign = strokeKeywords.some((k) => text.includes(k));

      const thunderclapKeywords = [
        'thunderclap', 'worst headache', 'sudden severe headache', 'ekdum se sar dard',
        'sir me achanak tez dard', 'sar fat raha hai', 'अचानक तेज सिरदर्द', 'सिर में असहनीय दर्द',
      ];
      const hasThunderclap = thunderclapKeywords.some((k) => text.includes(k)) ||
        ((text.includes('headache') || text.includes('sar dard') || text.includes('सिरदर्द')) &&
         (text.includes('worst') || text.includes('sudden') || (state.hpi?.severity || 0) >= 9));

      if (hasStrokeSign || hasThunderclap) {
        const symptoms: string[] = [];
        if (hasStrokeSign) symptoms.push('Focal Neurological Deficit / Stroke Warning (Weakness, Slurred Speech, Asymmetry)');
        if (hasThunderclap) symptoms.push('Sudden Severe Headache / Thunderclap Characteristic');
        return { matched: true, matchedSymptoms: symptoms };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 3. RESPIRATORY: Acute Severe Respiratory Distress / Stridor / Choking
  {
    id: 'RF_RESP_DISTRESS',
    category: 'RESPIRATORY',
    title: 'Acute Severe Respiratory Distress / Airway Compromise',
    severity: 'EMERGENCY',
    description: 'Severe difficulty breathing, gasping for air, stridor, unable to complete sentences, or cyanosis.',
    recommendedAction: 'Immediate high-flow oxygenation, continuous SpO2 monitoring, and emergency airway assessment.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const respKeywords = [
        'unable to breathe', 'severe shortness of breath', 'difficulty breathing', 'gasping',
        'stridor', 'choking', 'blue lips', 'cyanosis', 'severe dyspnea',
        'saans lene me bohot dikkat', 'saans lene me dikkat', 'saans phoolna', 'dam ghutna',
        'saans nahi aa rahi', 'hawa nahi mil rahi', 'सांस लेने में बहुत तकलीफ', 'सांस फूलना',
        'दम घुटना', 'सांस नहीं आ रही', 'नीले होंठ',
      ];
      const hasRespEmergency = respKeywords.some((k) => text.includes(k));

      if (hasRespEmergency) {
        return {
          matched: true,
          matchedSymptoms: ['Severe Respiratory Distress / Difficulty Breathing', 'Potential Airway / Oxygen Compromise'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 4. SYNCOPE: Loss of Consciousness / Collapse / Unresponsive
  {
    id: 'RF_SYNCOPE_COLLAPSE',
    category: 'NEUROLOGICAL',
    title: 'Sudden Loss of Consciousness / Syncope / Collapse',
    severity: 'EMERGENCY',
    description: 'Patient reports fainting, loss of consciousness, blackout, or sudden unexplained collapse.',
    recommendedAction: 'Immediate vital signs, blood glucose check, ECG, and urgent medical evaluation for syncope/collapse.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const syncopeKeywords = [
        'unconscious', 'fainted', 'fainting', 'passed out', 'collapsed', 'blackout', 'unresponsive',
        'behosh', 'behosh ho gaya', 'chakkar aake gir gaya', 'hosh me nahi', 'hosh kho diya',
        'बेहोश', 'बेहोशी', 'अचानक गिर पड़ा', 'होश नहीं है',
      ];
      const hasSyncope = syncopeKeywords.some((k) => text.includes(k));

      if (hasSyncope) {
        return {
          matched: true,
          matchedSymptoms: ['Loss of Consciousness / Syncope / Unresponsive Episode'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 5. HEMORRHAGE: Severe Active Bleeding / Massive Hemorrhage / Hematemesis
  {
    id: 'RF_HEMORRHAGE_ACTIVE',
    category: 'OTHER',
    title: 'Severe Active Bleeding / Gastrointestinal Hemorrhage',
    severity: 'EMERGENCY',
    description: 'Patient reports severe uncontrolled bleeding, hematemesis (vomiting blood), or hemoptysis (coughing blood).',
    recommendedAction: 'Immediate hemorrhage control, IV access, crossmatch blood, and stat surgical / trauma triage.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const bleedKeywords = [
        'vomiting blood', 'coughing blood', 'hematemesis', 'hemoptysis', 'severe bleeding',
        'massive bleeding', 'uncontrolled bleeding', 'heavy bleeding', 'bleeding heavily',
        'khoon ki ulti', 'khoon nikal raha hai', 'bohot khoon beh raha', 'khoon beh raha hai',
        'खून की उल्टी', 'बहुत ज्यादा खून बह रहा है', 'रक्तस्राव', 'खून बह रहा है',
      ];
      const hasBleed = bleedKeywords.some((k) => text.includes(k));

      if (hasBleed) {
        return {
          matched: true,
          matchedSymptoms: ['Severe Bleeding / Hematemesis / Active Hemorrhage'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 6. HEAD TRAUMA: Severe Head Injury / Skull Trauma
  {
    id: 'RF_HEAD_TRAUMA',
    category: 'TRAUMA',
    title: 'Severe Head Injury / Suspected Traumatic Brain Injury',
    severity: 'EMERGENCY',
    description: 'Head trauma with loss of consciousness, persistent vomiting, confusion, or bleeding/fluid from ears or nose.',
    recommendedAction: 'C-spine immobilization, urgent CT Brain, GCS assessment, and neurosurgical consult.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const headTraumaKeywords = [
        'head injury', 'hit on head', 'fall on head', 'skull trauma', 'head trauma',
        'sar par chot', 'sar phoot gaya', 'sar me chot lagi', 'sar me chot aur ulti',
        'सिर पर गंभीर चोट', 'सिर फूट गया', 'सिर से खून बहना',
      ];
      const hasHeadTrauma = headTraumaKeywords.some((k) => text.includes(k));

      if (hasHeadTrauma) {
        return {
          matched: true,
          matchedSymptoms: ['Severe Head Injury / Skull Trauma'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 7. MAJOR TRAUMA: Road Traffic Accident / High-Impact Trauma / Compound Fracture
  {
    id: 'RF_MAJOR_TRAUMA',
    category: 'TRAUMA',
    title: 'Major Trauma / Road Traffic Accident / Severe Crush Injury',
    severity: 'EMERGENCY',
    description: 'High-impact collision, pedestrian struck, severe crush injury, or suspected unstable fractures.',
    recommendedAction: 'Immediate trauma team activation (ATLS protocol), primary survey, and rapid resuscitation.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const traumaKeywords = [
        'road accident', 'car accident', 'bike accident', 'hit by vehicle', 'car crash',
        'motorcycle crash', 'major accident', 'compound fracture', 'crush injury',
        'accident ho gaya', 'gadi ne takkar mari', 'badi chot', 'haddi toot gayi',
        'सड़क दुर्घटना', 'गाड़ी से टक्कर', 'गंभीर एक्सीडेंट',
      ];
      const hasMajorTrauma = traumaKeywords.some((k) => text.includes(k));

      if (hasMajorTrauma) {
        return {
          matched: true,
          matchedSymptoms: ['Major Trauma / Road Traffic Accident / Severe Injury'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 8. ANAPHYLAXIS: Severe Allergic Reaction / Airway Angioedema
  {
    id: 'RF_ANAPHYLAXIS',
    category: 'ANAPHYLAXIS',
    title: 'Severe Anaphylaxis / Airway Angioedema',
    severity: 'EMERGENCY',
    description: 'Rapid onset facial/tongue/throat swelling, diffuse hives, wheezing, or airway constriction following exposure.',
    recommendedAction: 'Immediate IM Epinephrine (1:1000), oxygen, airway preparation, and antihistamine/corticosteroid support.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const anaphylaxisKeywords = [
        'anaphylaxis', 'throat swelling', 'swollen tongue', 'swollen lips', 'throat tightness',
        'cannot swallow', 'gala band ho raha hai', 'hont sooj gaye', 'jeebh sooj gayi',
        'allergic reaction with breathing difficulty', 'गले में सूजन', 'होंठ और जीभ सूज जाना',
        'एलर्जी से सांस रुकना',
      ];
      const hasAnaphylaxis = anaphylaxisKeywords.some((k) => text.includes(k));

      if (hasAnaphylaxis) {
        return {
          matched: true,
          matchedSymptoms: ['Severe Anaphylaxis / Throat Swelling / Airway Allergic Reaction'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 9. SEIZURES: Active Convulsions / Status Epilepticus
  {
    id: 'RF_SEIZURES_FITS',
    category: 'NEUROLOGICAL',
    title: 'Active Seizure / Convulsions / Fits',
    severity: 'EMERGENCY',
    description: 'Generalized tonic-clonic convulsions, active fits, repeated episodes, or failure to regain consciousness.',
    recommendedAction: 'Airway protection, lateral recovery position, IV Lorazepam/Midazolam per protocol, and continuous monitoring.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const seizureKeywords = [
        'seizure', 'convulsions', 'fits', 'epileptic fit', 'status epilepticus',
        'daura pada', 'daura aa raha hai', 'mirgi ka daura', 'jhatke lag rahe',
        'दौरा पड़ा', 'मिर्गी का दौरा', 'झटके आना',
      ];
      const hasSeizure = seizureKeywords.some((k) => text.includes(k));

      if (hasSeizure) {
        return {
          matched: true,
          matchedSymptoms: ['Seizure / Convulsions / Fits Episode'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 10. ALTERED MENTAL STATUS: Acute Confusion / Delirium / Sudden Disorientation
  {
    id: 'RF_ALTERED_MENTAL_STATUS',
    category: 'NEUROLOGICAL',
    title: 'Acute Altered Mental Status / Severe Confusion',
    severity: 'EMERGENCY',
    description: 'Sudden onset acute confusion, severe disorientation, delirium, or inability to recognize close family.',
    recommendedAction: 'Stat blood glucose check, metabolic panel, toxicological screen, and emergency neuro/medical evaluation.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const confusionKeywords = [
        'acute confusion', 'sudden confusion', 'altered mental status', 'delirium',
        'disoriented', 'not recognizing anyone', 'behki behki baatein', 'pehechan nahi raha',
        'ekdum confuse ho gaye', 'अचानक मानसिक भ्रम', 'पहचान नहीं पा रहे', 'बेसुध होना',
      ];
      const hasConfusion = confusionKeywords.some((k) => text.includes(k));

      if (hasConfusion) {
        return {
          matched: true,
          matchedSymptoms: ['Acute Confusion / Sudden Disorientation / Altered Mental State'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 11. ABDOMINAL: Acute Surgical Abdomen / Board-like Rigidity
  {
    id: 'RF_ABDOMINAL_ACUTE',
    category: 'ABDOMINAL',
    title: 'Acute Surgical Abdomen / Peritoneal Rigidity',
    severity: 'HIGH',
    description: 'Severe persistent abdominal pain with guarding, board-like rigidity, or signs of acute peritonitis.',
    recommendedAction: 'Urgent general surgical consultation, abdominal ultrasound/CT, NPO status, and IV fluid resuscitation.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${state.hpi?.site || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const abdKeywords = [
        'pet dard', 'abdominal pain', 'stomach pain', 'belly pain', 'पेट दर्द',
      ];
      const hasAbd = abdKeywords.some((k) => text.includes(k));

      const warningKeywords = [
        'rigid', 'board like', 'peritonitis', 'guarding', 'pet pathar jaisa',
        'asahya pet dard', 'pet me asahya dard', 'पेट पत्थर जैसा', 'असहनीय पेट दर्द',
      ];
      const hasWarning = warningKeywords.some((k) => text.includes(k));
      const highSeverity = (state.hpi?.severity || 0) >= 8 || text.includes('unbearable');

      if ((hasAbd && highSeverity) || hasWarning) {
        return {
          matched: true,
          matchedSymptoms: ['Severe Abdominal Pain / Possible Acute Surgical Abdomen'],
        };
      }
      return { matched: false, matchedSymptoms: [] };
    },
  },

  // 12. SEPSIS / MENINGISMUS: High Fever with Stiff Neck / Sepsis
  {
    id: 'RF_SEPSIS_MENINGISMUS',
    category: 'SEPSIS',
    title: 'Severe Sepsis / High Fever with Neck Rigidity',
    severity: 'HIGH',
    description: 'High fever accompanied by neck stiffness, severe lethargy, purpuric rash, or hemodynamic compromise.',
    recommendedAction: 'Urgent evaluation for meningitis / sepsis. Blood cultures, lumbar puncture consideration, and early IV antibiotics.',
    evaluator: (state, utterance = '') => {
      const text = `${state.chiefComplaint?.value || ''} ${(state.hpi?.associatedSymptoms || []).join(' ')} ${utterance}`.toLowerCase();

      const sepsisKeywords = [
        'stiff neck', 'neck rigidity', 'gardan akad gayi', 'gardun akdi',
        'high fever with neck stiffness', 'गर्दन अकड़ना', 'meningitis', 'septic shock',
        'tez bukhar aur gardan me dard',
      ];
      const hasSepsisMeningismus = sepsisKeywords.some((k) => text.includes(k));

      if (hasSepsisMeningismus) {
        return {
          matched: true,
          matchedSymptoms: ['High Fever with Stiff Neck / Suspected Meningismus / Sepsis'],
        };
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
