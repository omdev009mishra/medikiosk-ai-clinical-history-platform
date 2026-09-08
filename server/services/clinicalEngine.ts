import { ClinicalHistoryState, DataSource, LanguageCode } from '../types/clinical';
import { generateClinicalExtraction } from '../ai/gemini';
import { evaluateRedFlags } from '../rules/redFlags';
import { getNextMedicalQuestion } from './medicalInterrogation';

export interface QuestionDefinition {
  id: string;
  field: string;
  category: 'CHIEF_COMPLAINT' | 'HPI' | 'PMHX' | 'MEDS' | 'ALLERGIES' | 'AYUSH' | 'GENERAL';
  prompt: {
    en: string;
    hi: string;
  };
  audioPrompt?: {
    en: string;
    hi: string;
  };
  inputType: 'CHOICE' | 'SCALE_10' | 'DURATION' | 'MULTI_CHOICE' | 'TEXT_VOICE';
  options?: Array<{ label: { en: string; hi: string }; value: any; icon?: string }>;
  nextCondition?: (state: ClinicalHistoryState) => boolean;
}

export const QUESTION_BANK: Record<string, QuestionDefinition[]> = {
  // Pathway 1: Chest Pain
  CHEST_PAIN: [
    {
      id: 'cp_duration',
      field: 'chiefComplaint.duration',
      category: 'HPI',
      prompt: {
        en: 'When did your chest pain begin or how long has it lasted?',
        hi: 'छाती में दर्द कब से शुरू हुआ है या कितनी देर से हो रहा है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Less than 1 hour', hi: '1 घंटे से कम' }, value: 'under_1_hour' },
        { label: { en: '1 to 4 hours ago', hi: '1 से 4 घंटे पहले' }, value: '1_to_4_hours' },
        { label: { en: 'Since yesterday', hi: 'कल से' }, value: 'since_yesterday' },
        { label: { en: 'More than a week', hi: '1 हफ्ते से अधिक' }, value: 'more_than_week' },
      ],
    },
    {
      id: 'cp_location',
      field: 'hpi.site',
      category: 'HPI',
      prompt: {
        en: 'Where exactly do you feel the pain in your chest?',
        hi: 'दर्द छाती में ठीक किस जगह महसूस हो रहा है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Center / Middle', hi: 'बीच में / सीने के मध्य' }, value: 'central_chest' },
        { label: { en: 'Left side', hi: 'बाईं तरफ' }, value: 'left_chest' },
        { label: { en: 'Right side', hi: 'दाईं तरफ' }, value: 'right_chest' },
        { label: { en: 'Spreading / Whole chest', hi: 'पूरी छाती में' }, value: 'diffuse_chest' },
      ],
    },
    {
      id: 'cp_character',
      field: 'hpi.character',
      category: 'HPI',
      prompt: {
        en: 'How would you describe the feeling of the pain?',
        hi: 'दर्द किस तरह का लग रहा है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Heavy Pressure / Squeezing', hi: 'भारीपन / दबाव / जकड़न' }, value: 'pressure_squeezing' },
        { label: { en: 'Sharp / Stabbing', hi: 'तेज़ चुभने वाला दर्द' }, value: 'sharp_stabbing' },
        { label: { en: 'Burning sensation', hi: 'जलन जैसा दर्द' }, value: 'burning' },
        { label: { en: 'Dull ache', hi: 'हल्का-हल्का लगातार दर्द' }, value: 'dull_ache' },
      ],
    },
    {
      id: 'cp_radiation',
      field: 'hpi.radiation',
      category: 'HPI',
      prompt: {
        en: 'Is the pain travelling or spreading to any other part?',
        hi: 'क्या यह दर्द शरीर के किसी और हिस्से में जा रहा है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Left Arm / Shoulder', hi: 'बाएं हाथ या कंधे में' }, value: 'left_arm_shoulder' },
        { label: { en: 'Neck / Jaw / Throat', hi: 'गले या जबड़े में' }, value: 'neck_jaw' },
        { label: { en: 'Back / Between shoulder blades', hi: 'पीठ में' }, value: 'upper_back' },
        { label: { en: 'No, stays in chest only', hi: 'नहीं, केवल छाती में है' }, value: 'none' },
      ],
    },
    {
      id: 'cp_severity',
      field: 'hpi.severity',
      category: 'HPI',
      prompt: {
        en: 'On a scale from 0 to 10, how severe is your pain right now?',
        hi: '0 से 10 के पैमाने पर, अभी आपका दर्द कितना तेज़ है?',
      },
      inputType: 'SCALE_10',
    },
    {
      id: 'cp_associated',
      field: 'hpi.associatedSymptoms',
      category: 'HPI',
      prompt: {
        en: 'Do you also have any of these associated symptoms?',
        hi: 'क्या आपको इनमें से कोई और लक्षण भी महसूस हो रहा है?',
      },
      inputType: 'MULTI_CHOICE',
      options: [
        { label: { en: 'Shortness of breath / Saans lene me dikkat', hi: 'सांस फूलना' }, value: 'dyspnea' },
        { label: { en: 'Profuse sweating / Paseena', hi: 'अत्यधिक पसीना' }, value: 'diaphoresis' },
        { label: { en: 'Nausea / Vomiting', hi: 'उल्टी या जी मिचलाना' }, value: 'nausea' },
        { label: { en: 'Dizziness / Lightheadedness', hi: 'चक्कर आना' }, value: 'dizziness' },
      ],
    },
  ],

  // Pathway 2: Headache
  HEADACHE: [
    {
      id: 'ha_duration',
      field: 'chiefComplaint.duration',
      category: 'HPI',
      prompt: {
        en: 'How long have you had this headache?',
        hi: 'यह सिरदर्द कब से हो रहा है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Started suddenly today', hi: 'आज अचानक शुरू हुआ' }, value: 'sudden_today' },
        { label: { en: '2 to 3 days', hi: '2-3 दिनों से' }, value: '2_to_3_days' },
        { label: { en: 'More than a month / Chronic', hi: 'महीनों से / पुराना दर्द' }, value: 'chronic_months' },
      ],
    },
    {
      id: 'ha_location',
      field: 'hpi.site',
      category: 'HPI',
      prompt: {
        en: 'Which part of your head hurts?',
        hi: 'सिर के किस भाग में दर्द हो रहा है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'One side (Half head)', hi: 'आधे सिर में / एक तरफ' }, value: 'unilateral_half' },
        { label: { en: 'Forehead & temples', hi: 'माथे और कनपटी में' }, value: 'frontal_temporal' },
        { label: { en: 'Back of head / Neck', hi: 'सिर के पिछले हिस्से / गर्दन में' }, value: 'occipital_neck' },
        { label: { en: 'All over head', hi: 'पूरे सिर में' }, value: 'diffuse' },
      ],
    },
    {
      id: 'ha_character',
      field: 'hpi.character',
      category: 'HPI',
      prompt: {
        en: 'What does the headache feel like?',
        hi: 'सिरदर्द किस तरह का है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Throbbing / Pulsating', hi: 'धड़कता हुआ / टीस मारने वाला' }, value: 'throbbing_pulsating' },
        { label: { en: 'Tight band around head', hi: 'पट्टा बंधा हुआ जैसा भारीपन' }, value: 'tight_band' },
        { label: { en: 'Sudden explosive / Severe', hi: 'अचानक तीव्र विस्फोट जैसा' }, value: 'explosive_thunderclap' },
        { label: { en: 'Dull continuous heaviness', hi: 'लगातार भारीपन' }, value: 'dull_heaviness' },
      ],
    },
    {
      id: 'ha_severity',
      field: 'hpi.severity',
      category: 'HPI',
      prompt: {
        en: 'Rate the severity of your headache (0 = no pain, 10 = worst imaginable):',
        hi: 'सिरदर्द की तीव्रता बताएं (0 = कोई दर्द नहीं, 10 = असहनीय दर्द):',
      },
      inputType: 'SCALE_10',
    },
    {
      id: 'ha_associated',
      field: 'hpi.associatedSymptoms',
      category: 'HPI',
      prompt: {
        en: 'Any sensitivity to light, sound, or nausea?',
        hi: 'क्या रोशनी या आवाज़ से परेशानी, या जी मिचलाना है?',
      },
      inputType: 'MULTI_CHOICE',
      options: [
        { label: { en: 'Light sensitivity (Photophobia)', hi: 'रोशनी से चुभन' }, value: 'photophobia' },
        { label: { en: 'Sound sensitivity (Phonophobia)', hi: 'तेज़ आवाज़ से परेशानी' }, value: 'phonophobia' },
        { label: { en: 'Nausea / Vomiting', hi: 'उल्टी या जी मिचलाना' }, value: 'nausea' },
        { label: { en: 'Blurred vision / Eye redness', hi: 'धुंधला दिखना या आंख लाल होना' }, value: 'blurred_vision' },
      ],
    },
  ],

  // Pathway 3: Abdominal Pain
  ABDOMINAL_PAIN: [
    {
      id: 'abd_duration',
      field: 'chiefComplaint.duration',
      category: 'HPI',
      prompt: {
        en: 'When did your abdominal / stomach pain start?',
        hi: 'पेट में दर्द कब से शुरू हुआ है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'A few hours ago', hi: 'कुछ घंटे पहले' }, value: 'few_hours' },
        { label: { en: '1 to 2 days', hi: '1-2 दिनों से' }, value: '1_to_2_days' },
        { label: { en: 'Ongoing for weeks', hi: 'कई हफ़्तों से' }, value: 'weeks' },
      ],
    },
    {
      id: 'abd_site',
      field: 'hpi.site',
      category: 'HPI',
      prompt: {
        en: 'Which part of the abdomen is most painful?',
        hi: 'पेट के किस हिस्से में सबसे ज्यादा दर्द है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Upper Middle (Epigastric)', hi: 'ऊपर बीच में (छाती के नीचे)' }, value: 'upper_middle' },
        { label: { en: 'Right Lower Quadrant', hi: 'दाएं तरफ नीचे (अपेंडिक्स क्षेत्र)' }, value: 'right_lower' },
        { label: { en: 'Around Navel / Belly Button', hi: 'नाभि के आसपास' }, value: 'periumbilical' },
        { label: { en: 'Whole Abdomen / Generalized', hi: 'पूरे पेट में' }, value: 'whole_abdomen' },
      ],
    },
    {
      id: 'abd_severity',
      field: 'hpi.severity',
      category: 'HPI',
      prompt: {
        en: 'How severe is the stomach pain (0 to 10)?',
        hi: 'पेट का दर्द कितना तीव्र है (0 से 10)?',
      },
      inputType: 'SCALE_10',
    },
    {
      id: 'abd_associated',
      field: 'hpi.associatedSymptoms',
      category: 'HPI',
      prompt: {
        en: 'Do you have any associated digestive symptoms?',
        hi: 'क्या आपको पाचन से संबंधित कोई अन्य परेशानी है?',
      },
      inputType: 'MULTI_CHOICE',
      options: [
        { label: { en: 'Vomiting / Ulti', hi: 'उल्टी' }, value: 'vomiting' },
        { label: { en: 'Fever / Bukhar', hi: 'बुखार' }, value: 'fever' },
        { label: { en: 'Loose motions / Diarrhea', hi: 'दस्त / लूज मोशन' }, value: 'diarrhea' },
        { label: { en: 'Severe constipation / Gas stoppage', hi: 'गंभीर कब्ज या गैस रुकना' }, value: 'constipation' },
      ],
    },
  ],

  // Pathway 4: General Medical History (PMHx, Meds, Allergies)
  GENERAL_BACKGROUND: [
    {
      id: 'gen_pmhx',
      field: 'pastMedicalHistory',
      category: 'PMHX',
      prompt: {
        en: 'Do you have any existing diagnosed medical conditions?',
        hi: 'क्या आपको पहले से इनमें से कोई बीमारी है?',
      },
      inputType: 'MULTI_CHOICE',
      options: [
        { label: { en: 'High Blood Pressure (Hypertension)', hi: 'हाई ब्लड प्रेशर (उच्च रक्तचाप)' }, value: 'Hypertension' },
        { label: { en: 'Diabetes (Sugar / Madhumeha)', hi: 'डायबिटीज (शुगर / मधुमेह)' }, value: 'Diabetes Mellitus Type 2' },
        { label: { en: 'Heart Disease / Prior Stent', hi: 'दिल की बीमारी / स्टेंट' }, value: 'Coronary Artery Disease' },
        { label: { en: 'Asthma / Breathing issue', hi: 'अस्थमा / सांस की बीमारी' }, value: 'Bronchial Asthma' },
        { label: { en: 'Thyroid disorder', hi: 'थायराइड' }, value: 'Hypothyroidism' },
        { label: { en: 'None of the above', hi: 'कोई पुरानी बीमारी नहीं' }, value: 'None' },
      ],
    },
    {
      id: 'gen_allergies',
      field: 'allergies',
      category: 'ALLERGIES',
      prompt: {
        en: 'Are you allergic to any medicines or foods?',
        hi: 'क्या आपको किसी दवा या खाने की चीज़ से एलर्जी है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'No known allergies', hi: 'कोई एलर्जी नहीं है' }, value: 'no_allergies' },
        { label: { en: 'Penicillin / Antibiotics', hi: 'पेनिसिलिन या एंटीबायोटिक से' }, value: 'penicillin' },
        { label: { en: 'Painkillers (NSAIDs / Aspirin)', hi: 'दर्द निवारक दवाओं से' }, value: 'nsaid_allergy' },
        { label: { en: 'Sulfa drugs / Other', hi: 'सल्फा दवाएं या अन्य' }, value: 'other' },
      ],
    },
  ],

  // Pathway 5: AYUSH / Dashavidha Pariksha & Ahara-Vihara (AIIA Standard)
  AYUSH_PARIKSHA: [
    {
      id: 'ayush_prakriti_body',
      field: 'ayushHistory.prakriti',
      category: 'AYUSH',
      prompt: {
        en: 'How is your body constitution & tolerance to weather (Prakriti)?',
        hi: 'आपकी शारीरिक प्रकृति और मौसम सहनशीलता कैसी है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Slim build, dry skin, intolerant to cold (Vata)', hi: 'पतला शरीर, रूखी त्वचा, ठंड से संवेदनशीलता (वात)' }, value: 'Vata' },
        { label: { en: 'Medium build, warm body, intolerant to heat (Pitta)', hi: 'मध्यम शरीर, अधिक पसीना, गर्मी से परेशानी (पित्त)' }, value: 'Pitta' },
        { label: { en: 'Heavy build, oily skin, calm demeanor (Kapha)', hi: 'भारी शरीर, चिकनी त्वचा, शांत स्वभाव (कफ)' }, value: 'Kapha' },
        { label: { en: 'Mixed Vata-Pitta characteristics', hi: 'मिश्रित वात-पित्त लक्षण' }, value: 'Vata-Pitta' },
      ],
    },
    {
      id: 'ayush_agni',
      field: 'ayushHistory.agni',
      category: 'AYUSH',
      prompt: {
        en: 'How is your digestive fire / appetite (Agni)?',
        hi: 'आपकी भूख और पाचन शक्ति (अग्नि) कैसी है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Irregular appetite, frequent gas/bloating (Vishama Agni)', hi: 'अनियमित भूख, गैस/अफारा (विषमाग्नि)' }, value: 'Vishama Agni' },
        { label: { en: 'Excessive intense hunger, acidity/burning (Tikshna Agni)', hi: 'अत्यधिक भूख, जलन/खट्टी डकार (तीक्ष्णाग्नि)' }, value: 'Tikshna Agni' },
        { label: { en: 'Poor appetite, heavy stomach after meals (Manda Agni)', hi: 'कम भूख, भोजन के बाद भारीपन (मंदाग्नि)' }, value: 'Manda Agni' },
        { label: { en: 'Balanced, timely digestion (Sama Agni)', hi: 'संतुलित समय पर पाचन (समाग्नि)' }, value: 'Sama Agni' },
      ],
    },
    {
      id: 'ayush_koshtha',
      field: 'ayushHistory.koshtha',
      category: 'AYUSH',
      prompt: {
        en: 'How is your bowel habit / elimination (Koshtha)?',
        hi: 'आपका मल त्याग / कोष्ठ कैसा है?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Hard stools, constipation prone (Krura Koshtha)', hi: 'कड़ा मल, अक्सर कब्ज (क्रूर कोष्ठ)' }, value: 'Krura' },
        { label: { en: 'Loose stools easily provoked by milk/fruits (Mridu Koshtha)', hi: 'नरम मल, दूध या फल से तुरंत दस्त (मृदु कोष्ठ)' }, value: 'Mridu' },
        { label: { en: 'Normal, smooth daily bowel motion (Madhyama Koshtha)', hi: 'सामान्य नियमित मल त्याग (मध्यम कोष्ठ)' }, value: 'Madhyama' },
      ],
    },
    {
      id: 'ayush_diet_vihara',
      field: 'ayushHistory.aharaVihara',
      category: 'AYUSH',
      prompt: {
        en: 'What are your primary dietary habits (Ahara)?',
        hi: 'आपकी मुख्य खान-पान की आदतें (आहार) क्या हैं?',
      },
      inputType: 'CHOICE',
      options: [
        { label: { en: 'Strict Vegetarian / Shakahari, Home cooked', hi: 'शुद्ध शाकाहारी, घर का बना भोजन' }, value: 'Vegetarian' },
        { label: { en: 'Frequent spicy, oily, or outside food', hi: 'मसालेदार, तला हुआ या बाहर का भोजन' }, value: 'Spicy_Oily' },
        { label: { en: 'Mixed Non-Vegetarian diet', hi: 'मांसाहारी / मिश्रित आहार' }, value: 'Non-Vegetarian' },
        { label: { en: 'Irregular meal timings / Fasting', hi: 'अनियमित भोजन समय / उपवास' }, value: 'Irregular' },
      ],
    },
  ],
};

export function getInitialClinicalState(): ClinicalHistoryState {
  return {
    chiefComplaint: undefined,
    hpi: {},
    pastMedicalHistory: [],
    pastSurgicalHistory: [],
    medications: [],
    allergies: [],
    familyHistory: [],
    personalHistory: {},
    reviewOfSystems: {},
    ayushHistory: {},
  };
}

export function detectComplaintPathway(complaintText: string = ''): string {
  const lower = complaintText.toLowerCase();
  if (lower.includes('chest') || lower.includes('seene') || lower.includes('chhati') || lower.includes('heart') || lower.includes('dil')) {
    return 'CHEST_PAIN';
  }
  if (lower.includes('head') || lower.includes('sir') || lower.includes('sar') || lower.includes('migraine') || lower.includes('suryavarta')) {
    return 'HEADACHE';
  }
  if (lower.includes('stomach') || lower.includes('pet') || lower.includes('abdominal') || lower.includes('belly') || lower.includes('digest')) {
    return 'ABDOMINAL_PAIN';
  }
  return 'CHEST_PAIN'; // Default pathway with adaptive fallback
}

export function getNextQuestion(
  state: ClinicalHistoryState,
  mode: 'GENERAL' | 'AYUSH' = 'GENERAL',
  answeredQuestionIds: string[] = []
): QuestionDefinition | null {
  const pathwayKey = detectComplaintPathway(state.chiefComplaint?.value || '');
  const pathwayQuestions = QUESTION_BANK[pathwayKey] || QUESTION_BANK.CHEST_PAIN;

  // 1. Check HPI pathway questions first
  for (const q of pathwayQuestions) {
    if (!answeredQuestionIds.includes(q.id)) {
      return q;
    }
  }

  // 2. Check General background questions
  for (const q of QUESTION_BANK.GENERAL_BACKGROUND) {
    if (!answeredQuestionIds.includes(q.id)) {
      return q;
    }
  }

  // 3. If in AYUSH mode, check AYUSH questions
  if (mode === 'AYUSH') {
    for (const q of QUESTION_BANK.AYUSH_PARIKSHA) {
      if (!answeredQuestionIds.includes(q.id)) {
        return q;
      }
    }
  }

  return null; // Intake interview complete
}

export async function processAnswer(
  currentState: ClinicalHistoryState,
  questionId: string,
  rawAnswer: any,
  source: DataSource = 'PATIENT_TOUCH',
  contextText: string = ''
): Promise<{ updatedState: ClinicalHistoryState; extractedFields: Record<string, any> }> {
  const state: ClinicalHistoryState = JSON.parse(JSON.stringify(currentState));
  const extracted: Record<string, any> = {};

  // Direct structured mappings
  switch (questionId) {
    case 'initial_complaint': {
      state.chiefComplaint = {
        value: typeof rawAnswer === 'string' ? rawAnswer : rawAnswer.value || 'Reported Issue',
        duration: rawAnswer.duration || 'Not specified',
        source,
      };
      extracted.chiefComplaint = state.chiefComplaint;
      break;
    }
    case 'cp_duration':
    case 'ha_duration':
    case 'abd_duration': {
      if (!state.chiefComplaint) {
        state.chiefComplaint = { value: 'Symptoms', duration: String(rawAnswer), source };
      } else {
        state.chiefComplaint.duration = String(rawAnswer);
      }
      extracted.duration = rawAnswer;
      break;
    }
    case 'cp_location':
    case 'ha_location':
    case 'abd_site': {
      state.hpi.site = String(rawAnswer);
      extracted.site = rawAnswer;
      break;
    }
    case 'cp_character':
    case 'ha_character': {
      state.hpi.character = String(rawAnswer);
      extracted.character = rawAnswer;
      break;
    }
    case 'cp_radiation': {
      state.hpi.radiation = String(rawAnswer);
      extracted.radiation = rawAnswer;
      break;
    }
    case 'cp_severity':
    case 'ha_severity':
    case 'abd_severity': {
      state.hpi.severity = Number(rawAnswer);
      extracted.severity = rawAnswer;
      break;
    }
    case 'cp_associated':
    case 'ha_associated':
    case 'abd_associated': {
      const current = state.hpi.associatedSymptoms || [];
      const newItems = Array.isArray(rawAnswer) ? rawAnswer : [String(rawAnswer)];
      state.hpi.associatedSymptoms = Array.from(new Set([...current, ...newItems]));
      extracted.associatedSymptoms = state.hpi.associatedSymptoms;
      break;
    }
    case 'gen_pmhx': {
      const items = Array.isArray(rawAnswer) ? rawAnswer : [String(rawAnswer)];
      const filtered = items.filter((x) => x !== 'None');
      state.pastMedicalHistory = Array.from(new Set([...state.pastMedicalHistory, ...filtered]));
      extracted.pastMedicalHistory = state.pastMedicalHistory;
      break;
    }
    case 'gen_allergies': {
      if (rawAnswer !== 'no_allergies') {
        state.allergies.push({
          allergen: String(rawAnswer),
          source,
        });
      }
      extracted.allergies = state.allergies;
      break;
    }
    case 'ayush_prakriti_body': {
      state.ayushHistory = {
        ...state.ayushHistory,
        prakriti: String(rawAnswer),
      };
      extracted.prakriti = rawAnswer;
      break;
    }
    case 'ayush_agni': {
      state.ayushHistory = {
        ...state.ayushHistory,
        agni: String(rawAnswer),
      };
      extracted.agni = rawAnswer;
      break;
    }
    case 'ayush_koshtha': {
      state.ayushHistory = {
        ...state.ayushHistory,
        koshtha: String(rawAnswer),
      };
      extracted.koshtha = rawAnswer;
      break;
    }
    case 'ayush_diet_vihara': {
      state.ayushHistory = {
        ...state.ayushHistory,
        aharaVihara: {
          ...state.ayushHistory?.aharaVihara,
          foodHabits: String(rawAnswer),
        },
      };
      extracted.aharaVihara = rawAnswer;
      break;
    }
  }

  // If voice input was provided, invoke Gemini AI extraction for natural clinical reasoning & enrichment
  if (source === 'PATIENT_VOICE' && typeof rawAnswer === 'string' && rawAnswer.length > 5) {
    try {
      const aiResult = await generateClinicalExtraction(rawAnswer, contextText);
      if (aiResult) {
        if (aiResult.chiefComplaint?.value && !state.chiefComplaint?.value) {
          state.chiefComplaint = {
            value: aiResult.chiefComplaint.value,
            duration: aiResult.chiefComplaint.duration || state.chiefComplaint?.duration || 'Unknown',
            source: 'PATIENT_VOICE',
          };
        }
        if (aiResult.hpiUpdates) {
          state.hpi = {
            ...state.hpi,
            ...aiResult.hpiUpdates,
            associatedSymptoms: Array.from(
              new Set([...(state.hpi.associatedSymptoms || []), ...(aiResult.hpiUpdates.associatedSymptoms || [])])
            ),
          };
        }
        if (aiResult.pastMedicalHistory && aiResult.pastMedicalHistory.length > 0) {
          state.pastMedicalHistory = Array.from(new Set([...state.pastMedicalHistory, ...aiResult.pastMedicalHistory]));
        }
        if (aiResult.allergies && aiResult.allergies.length > 0) {
          for (const al of aiResult.allergies) {
            state.allergies.push({
              allergen: al.allergen,
              reaction: al.reaction,
              source: 'PATIENT_VOICE',
            });
          }
        }
        if (aiResult.ayushFindings) {
          state.ayushHistory = {
            ...state.ayushHistory,
            ...aiResult.ayushFindings,
          };
        }
        extracted.aiExtracted = aiResult;
      }
    } catch (err) {
      console.warn('[Clinical Engine] AI enrichment bypassed:', err);
    }
  }

  return { updatedState: state, extractedFields: extracted };
}

// ==========================================
// Phase 8 - Standalone SOCRATES Clinical Turn Processor
// ==========================================

export interface SocratesData {
  site: string | null;
  onset: string | null;
  character: string | null;
  radiation: string | null;
  associations: string[];
  timing: string | null;
  exacerbating_relieving: string | null;
  severity: string | null;
}

export interface ExtractedSymptomData {
  chief_complaint: string | null;
  duration: string | null;
  severity: string | null;
  socrates: SocratesData;
  allergies: string[];
  current_medications: string[];
  past_medical_history: string[];
}

export interface ClinicalEngineTurnResponse {
  spoken_response: string;
  questionId?: string;
  domain?: string;
  field?: string;
  red_flag_detected: boolean;
  red_flag_reason: string | null;
  should_transition: boolean;
  extracted_symptom_data: ExtractedSymptomData;
}

export interface ClinicalTurnParams {
  patientInput: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  accumulatedState?: Partial<ExtractedSymptomData>;
  language?: string;
}

const CLOSURE_PHRASES = [
  "that's all", "nothing else", "i have told you everything", "no other problems",
  "we're done", "all done", "that is all", "no more symptoms", "nothing more",
  "that is it", "that's it", "nothing further", "i'm done", "im done",
  "aur kuch nahi", "bas itna hi", "sab bata diya", "khatam ho gaya", "aur kuch nahi hai",
  "kuch nahi", "sab bata diya hai", "khatam", "itna hi tha", "aur kuch nahi batana",
  "bas", "bas itna", "aur nahi hai", "aur kuch nahe",
  "yethum illai", "yethum illa", "inkemi ledu", "inkem ledu", "aar kichu nei", "aankhi kahi nahi"
];

export function isPatientClosureSignaled(text: string): boolean {
  const lower = (text || '').toLowerCase().trim();
  return CLOSURE_PHRASES.some(phrase => lower.includes(phrase));
}

export async function processClinicalTurn(params: ClinicalTurnParams): Promise<ClinicalEngineTurnResponse> {
  const { patientInput = '', conversationHistory = [], accumulatedState = {}, language = 'en' } = params;

  // Format message turns for Medical Interrogation Engine (Ported from ZIP)
  const historyTurns = (conversationHistory || []).map((m, idx) => ({
    id: `turn_${idx}`,
    role: (m.role.toLowerCase() === 'patient' || m.role.toLowerCase() === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    message: m.content,
  }));

  const structuredState: any = {
    chiefComplaint: accumulatedState.chief_complaint,
    duration: accumulatedState.duration,
    severity: accumulatedState.severity,
    location: accumulatedState.socrates?.site,
    character: accumulatedState.socrates?.character,
    radiation: accumulatedState.socrates?.radiation,
    associatedSymptoms: accumulatedState.socrates?.associations,
    medications: accumulatedState.current_medications,
    allergies: accumulatedState.allergies,
    pastMedicalHistory: accumulatedState.past_medical_history,
  };

  const aiResp = await getNextMedicalQuestion({
    history: historyTurns,
    latestAnswer: patientInput,
    questionNumber: historyTurns.length + 1,
    structuredHistory: structuredState,
    language,
  });

  const sh = aiResp.structuredHistory || {};
  const isRedFlag = aiResp.status === 'urgent_stop' || aiResp.riskLevel === 'urgent';

  return {
    spoken_response: aiResp.assistantMessage,
    questionId: `turn_${aiResp.questionNumber}`,
    domain: isRedFlag ? 'EMERGENCY' : 'CONVERSATIONAL',
    field: 'dialogue',
    red_flag_detected: isRedFlag,
    red_flag_reason: isRedFlag ? (aiResp.urgentReason || 'Red flag symptom identified') : null,
    should_transition: aiResp.status === 'complete' || isRedFlag,
    extracted_symptom_data: {
      chief_complaint: sh.chiefComplaint || accumulatedState.chief_complaint || null,
      duration: sh.duration || accumulatedState.duration || null,
      severity: sh.severity || accumulatedState.severity || null,
      socrates: {
        site: sh.location || accumulatedState.socrates?.site || null,
        onset: sh.duration || accumulatedState.socrates?.onset || null,
        character: sh.character || accumulatedState.socrates?.character || null,
        radiation: sh.radiation || accumulatedState.socrates?.radiation || null,
        associations: (Array.isArray(sh.associatedSymptoms) ? sh.associatedSymptoms : []) || accumulatedState.socrates?.associations || [],
        timing: sh.timing || accumulatedState.socrates?.timing || null,
        exacerbating_relieving: sh.exacerbatingRelieving || accumulatedState.socrates?.exacerbating_relieving || null,
        severity: sh.severity || accumulatedState.socrates?.severity || null,
      },
      allergies: (Array.isArray(sh.allergies) ? sh.allergies : []) || accumulatedState.allergies || [],
      current_medications: (Array.isArray(sh.medications) ? sh.medications : []) || accumulatedState.current_medications || [],
      past_medical_history: (Array.isArray(sh.pastMedicalHistory) ? sh.pastMedicalHistory : []) || accumulatedState.past_medical_history || [],
    },
  };

  // Legacy fallback (unreachable)
  const isHindi = language === 'hi';

  // Initialize extracted symptom data merging accumulatedState
  const symptomData: ExtractedSymptomData = {
    chief_complaint: accumulatedState.chief_complaint || null,
    duration: accumulatedState.duration || null,
    severity: accumulatedState.severity || null,
    socrates: {
      site: accumulatedState.socrates?.site || null,
      onset: accumulatedState.socrates?.onset || null,
      character: accumulatedState.socrates?.character || null,
      radiation: accumulatedState.socrates?.radiation || null,
      associations: accumulatedState.socrates?.associations ? [...accumulatedState.socrates.associations] : [],
      timing: accumulatedState.socrates?.timing || null,
      exacerbating_relieving: accumulatedState.socrates?.exacerbating_relieving || null,
      severity: accumulatedState.socrates?.severity || null,
    },
    allergies: accumulatedState.allergies ? [...accumulatedState.allergies] : [],
    current_medications: accumulatedState.current_medications ? [...accumulatedState.current_medications] : [],
    past_medical_history: accumulatedState.past_medical_history ? [...accumulatedState.past_medical_history] : [],
  };

  const inputLower = patientInput.toLowerCase();

  // Extract symptoms heuristically from patientInput
  if (!symptomData.chief_complaint && patientInput.trim().length > 0 && !isPatientClosureSignaled(patientInput)) {
    symptomData.chief_complaint = patientInput;
  }

  // 1. Parse Site / Radiation (Devanagari, transliterated Hindi, and English)
  if (
    inputLower.includes('chest') ||
    inputLower.includes('seene') ||
    inputLower.includes('chhati') ||
    inputLower.includes('सीने') ||
    inputLower.includes('सीना') ||
    inputLower.includes('छाती') ||
    inputLower.includes('दिल') ||
    inputLower.includes('हार्ट')
  ) {
    symptomData.socrates.site = symptomData.socrates.site || 'Chest';
    if (
      inputLower.includes('left arm') ||
      inputLower.includes('baye haath') ||
      inputLower.includes('बाएं हाथ') ||
      inputLower.includes('बायां हाथ') ||
      inputLower.includes('बाईं भुजा') ||
      inputLower.includes('jaw') ||
      inputLower.includes('jabda') ||
      inputLower.includes('जबड़े') ||
      inputLower.includes('neck') ||
      inputLower.includes('gala') ||
      inputLower.includes('गले') ||
      inputLower.includes('पीठ') ||
      inputLower.includes('peeth')
    ) {
      symptomData.socrates.radiation = 'Left Arm / Jaw / Neck';
    }
  } else if (
    inputLower.includes('head') ||
    inputLower.includes('sir') ||
    inputLower.includes('sar') ||
    inputLower.includes('सिर') ||
    inputLower.includes('सर') ||
    inputLower.includes('माथा') ||
    inputLower.includes('कनपटी')
  ) {
    symptomData.socrates.site = symptomData.socrates.site || 'Head';
  } else if (
    inputLower.includes('stomach') ||
    inputLower.includes('pet') ||
    inputLower.includes('belly') ||
    inputLower.includes('abdomen') ||
    inputLower.includes('पेट') ||
    inputLower.includes('उदर') ||
    inputLower.includes('नाभि')
  ) {
    symptomData.socrates.site = symptomData.socrates.site || 'Abdomen';
  } else if (
    inputLower.includes('back') ||
    inputLower.includes('peeth') ||
    inputLower.includes('kamar') ||
    inputLower.includes('पीठ') ||
    inputLower.includes('कमर') ||
    inputLower.includes('रीढ़')
  ) {
    symptomData.socrates.site = symptomData.socrates.site || 'Back';
  } else if (
    inputLower.includes('throat') ||
    inputLower.includes('neck') ||
    inputLower.includes('gala') ||
    inputLower.includes('gardan') ||
    inputLower.includes('गला') ||
    inputLower.includes('गले') ||
    inputLower.includes('गर्दन')
  ) {
    symptomData.socrates.site = symptomData.socrates.site || 'Throat / Neck';
  } else if (
    inputLower.includes('arm') ||
    inputLower.includes('haath') ||
    inputLower.includes('kandha') ||
    inputLower.includes('हाथ') ||
    inputLower.includes('कंधा') ||
    inputLower.includes('कंधे')
  ) {
    symptomData.socrates.site = symptomData.socrates.site || 'Arm / Shoulder';
  } else if (
    inputLower.includes('leg') ||
    inputLower.includes('pair') ||
    inputLower.includes('tang') ||
    inputLower.includes('ghutna') ||
    inputLower.includes('पैर') ||
    inputLower.includes('पैरों') ||
    inputLower.includes('टांग') ||
    inputLower.includes('घुटने')
  ) {
    symptomData.socrates.site = symptomData.socrates.site || 'Leg / Knee';
  }

  // 2. Parse Character / Nature of Pain
  if (
    inputLower.includes('heavy') ||
    inputLower.includes('pressure') ||
    inputLower.includes('dhabav') ||
    inputLower.includes('dabaav') ||
    inputLower.includes('jakanan') ||
    inputLower.includes('jakdan') ||
    inputLower.includes('दबाव') ||
    inputLower.includes('भारीपन') ||
    inputLower.includes('जकड़न') ||
    inputLower.includes('बोझ') ||
    inputLower.includes('दबने जैसा')
  ) {
    symptomData.socrates.character = 'Heavy / Pressure';
  } else if (
    inputLower.includes('sharp') ||
    inputLower.includes('stabbing') ||
    inputLower.includes('chubhan') ||
    inputLower.includes('चुभने') ||
    inputLower.includes('चुभन') ||
    inputLower.includes('सुई जैसा') ||
    inputLower.includes('तीखा') ||
    inputLower.includes('कांटे जैसा') ||
    inputLower.includes('तेज दर्द') ||
    inputLower.includes('तेज़ दर्द')
  ) {
    symptomData.socrates.character = 'Sharp';
  } else if (
    inputLower.includes('burning') ||
    inputLower.includes('jalan') ||
    inputLower.includes('जलन') ||
    inputLower.includes('जलन जैसा') ||
    inputLower.includes('जलता हुआ') ||
    inputLower.includes('आग जैसा')
  ) {
    symptomData.socrates.character = 'Burning';
  } else if (
    inputLower.includes('throbbing') ||
    inputLower.includes('tees') ||
    inputLower.includes('dhadakne') ||
    inputLower.includes('धड़कने') ||
    inputLower.includes('टीस') ||
    inputLower.includes('टीस मारने वाला') ||
    inputLower.includes('धुकधुक') ||
    inputLower.includes('फड़कने')
  ) {
    symptomData.socrates.character = 'Throbbing';
  } else if (
    inputLower.includes('dull') ||
    inputLower.includes('meetha') ||
    inputLower.includes('धीमा दर्द') ||
    inputLower.includes('मीठा-मीठा') ||
    inputLower.includes('हल्का-हल्का')
  ) {
    symptomData.socrates.character = 'Dull ache';
  } else if (
    inputLower.includes('cramp') ||
    inputLower.includes('marod') ||
    inputLower.includes('aithan') ||
    inputLower.includes('ऐंठन') ||
    inputLower.includes('मरोड़')
  ) {
    symptomData.socrates.character = 'Cramping';
  }

  // Safety fallback for character: If "तेज" is mentioned in a character context without other character words
  if (!symptomData.socrates.character && (inputLower.includes('tez') || inputLower.includes('तेज') || inputLower.includes('तेज़'))) {
    symptomData.socrates.character = 'Sharp';
  }

  // 3. Parse Severity
  const numMatch = patientInput.match(/\b([0-9]|10)\b/);
  const hindiNumMap: Record<string, string> = {
    'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5',
    'छह': '6', 'सात': '7', 'आठ': '8', 'नौ': '9', 'दस': '10',
    '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9', '१०': '10'
  };
  let matchedHindiNum: string | null = null;
  for (const [hWord, digit] of Object.entries(hindiNumMap)) {
    if (new RegExp(`\\b${hWord}\\b`, 'u').test(patientInput) || patientInput.includes(hWord)) {
      if (inputLower.includes('scale') || inputLower.includes('पैमाने') || inputLower.includes('रेट') || inputLower.includes('नंबर')) {
        matchedHindiNum = digit;
        break;
      }
    }
  }

  if (numMatch) {
    symptomData.severity = numMatch[1];
    symptomData.socrates.severity = numMatch[1];
  } else if (matchedHindiNum) {
    symptomData.severity = matchedHindiNum;
    symptomData.socrates.severity = matchedHindiNum;
  } else if (
    inputLower.includes('severe') ||
    inputLower.includes('bohot tez') ||
    inputLower.includes('bohot zyada') ||
    inputLower.includes('worst') ||
    inputLower.includes('असहनीय') ||
    inputLower.includes('बहुत तेज') ||
    inputLower.includes('बहुत तेज़') ||
    inputLower.includes('बहुत ज्यादा') ||
    inputLower.includes('काफी तेज') ||
    inputLower.includes('काफ़ी तेज़') ||
    inputLower.includes('गंभीर') ||
    inputLower.includes('तीव्र') ||
    inputLower.includes('बर्दाश्त नहीं') ||
    inputLower.includes('दर्द तेज')
  ) {
    symptomData.severity = 'Severe';
    symptomData.socrates.severity = 'Severe';
  } else if (
    inputLower.includes('moderate') ||
    inputLower.includes('theek theek') ||
    inputLower.includes('मध्यम') ||
    inputLower.includes('ठीक-ठाक') ||
    inputLower.includes('साधारण')
  ) {
    symptomData.severity = 'Moderate';
    symptomData.socrates.severity = 'Moderate';
  } else if (
    inputLower.includes('mild') ||
    inputLower.includes('halka') ||
    inputLower.includes('हल्का') ||
    inputLower.includes('मामूली') ||
    inputLower.includes('थोड़ा') ||
    inputLower.includes('धीमा')
  ) {
    symptomData.severity = 'Mild';
    symptomData.socrates.severity = 'Mild';
  }

  // 4. Parse Duration / Onset
  if (
    inputLower.includes('today') ||
    inputLower.includes('aaj') ||
    inputLower.includes('आज') ||
    inputLower.includes('सुबह से') ||
    inputLower.includes('शाम से') ||
    inputLower.includes('अभी से')
  ) {
    symptomData.duration = 'Today';
    symptomData.socrates.onset = 'Sudden today';
  } else if (
    inputLower.includes('yesterday') ||
    inputLower.includes('kal') ||
    inputLower.includes('कल') ||
    inputLower.includes('बीते कल') ||
    inputLower.includes('रात से')
  ) {
    symptomData.duration = 'Since yesterday';
    symptomData.socrates.onset = 'Yesterday';
  } else if (
    inputLower.includes('hour') ||
    inputLower.includes('ghante') ||
    inputLower.includes('घंटे') ||
    inputLower.includes('घंटा') ||
    inputLower.includes('घंटों')
  ) {
    symptomData.duration = patientInput;
    symptomData.socrates.onset = patientInput;
  } else if (
    inputLower.includes('days') ||
    inputLower.includes('din') ||
    inputLower.includes('दिन') ||
    inputLower.includes('दिनों') ||
    inputLower.includes('रोज')
  ) {
    symptomData.duration = patientInput;
    symptomData.socrates.onset = patientInput;
  } else if (
    inputLower.includes('week') ||
    inputLower.includes('hafte') ||
    inputLower.includes('हफ्ते') ||
    inputLower.includes('हफ़्ते') ||
    inputLower.includes('सप्ताह')
  ) {
    symptomData.duration = patientInput;
    symptomData.socrates.onset = patientInput;
  } else if (
    inputLower.includes('month') ||
    inputLower.includes('mahine') ||
    inputLower.includes('महीने') ||
    inputLower.includes('महीनों') ||
    inputLower.includes('साल') ||
    inputLower.includes('वर्ष')
  ) {
    symptomData.duration = patientInput;
    symptomData.socrates.onset = patientInput;
  }

  // 5. Parse Associations
  if (
    inputLower.includes('sweat') ||
    inputLower.includes('paseena') ||
    inputLower.includes('पसीना') ||
    inputLower.includes('पसीने')
  ) {
    if (!symptomData.socrates.associations.includes('Diaphoresis / Sweating')) {
      symptomData.socrates.associations.push('Diaphoresis / Sweating');
    }
  }
  if (
    inputLower.includes('breath') ||
    inputLower.includes('saans') ||
    inputLower.includes('सांस') ||
    inputLower.includes('साँस') ||
    inputLower.includes('दम घुटना')
  ) {
    if (!symptomData.socrates.associations.includes('Shortness of Breath')) {
      symptomData.socrates.associations.push('Shortness of Breath');
    }
  }
  if (
    inputLower.includes('vomit') ||
    inputLower.includes('ulti') ||
    inputLower.includes('nausea') ||
    inputLower.includes('उल्टी') ||
    inputLower.includes('जी मिचलाना') ||
    inputLower.includes('मतली') ||
    inputLower.includes('उबकाई')
  ) {
    if (!symptomData.socrates.associations.includes('Nausea / Vomiting')) {
      symptomData.socrates.associations.push('Nausea / Vomiting');
    }
  }
  if (
    inputLower.includes('dizzy') ||
    inputLower.includes('chakkar') ||
    inputLower.includes('चक्कर') ||
    inputLower.includes('सिर घूमना')
  ) {
    if (!symptomData.socrates.associations.includes('Dizziness')) {
      symptomData.socrates.associations.push('Dizziness');
    }
  }
  if (
    inputLower.includes('fever') ||
    inputLower.includes('bukhar') ||
    inputLower.includes('बुखार') ||
    inputLower.includes('ताप')
  ) {
    if (!symptomData.socrates.associations.includes('Fever')) {
      symptomData.socrates.associations.push('Fever');
    }
  }
  if (
    inputLower.includes('palpitation') ||
    inputLower.includes('dhadkan') ||
    inputLower.includes('घबराहट') ||
    inputLower.includes('धड़कन') ||
    inputLower.includes('बेचैनी')
  ) {
    if (!symptomData.socrates.associations.includes('Palpitations / Anxiety')) {
      symptomData.socrates.associations.push('Palpitations / Anxiety');
    }
  }

  // 6. Parse PMHx, Meds, Allergies
  if (
    inputLower.includes('sugar') ||
    inputLower.includes('diabetes') ||
    inputLower.includes('शुगर') ||
    inputLower.includes('डायबिटीज') ||
    inputLower.includes('मधुमेह')
  ) {
    if (!symptomData.past_medical_history.includes('Diabetes Mellitus')) {
      symptomData.past_medical_history.push('Diabetes Mellitus');
    }
  }
  if (
    inputLower.includes('bp') ||
    inputLower.includes('hypertension') ||
    inputLower.includes('high pressure') ||
    inputLower.includes('बीपी') ||
    inputLower.includes('ब्लड प्रेशर') ||
    inputLower.includes('उच्च रक्तचाप')
  ) {
    if (!symptomData.past_medical_history.includes('Hypertension')) {
      symptomData.past_medical_history.push('Hypertension');
    }
  }
  if (
    inputLower.includes('heart') ||
    inputLower.includes('dil') ||
    inputLower.includes('हार्ट') ||
    inputLower.includes('दिल की बीमारी') ||
    inputLower.includes('दिल का दौरा') ||
    inputLower.includes('हार्ट अटैक')
  ) {
    if (!symptomData.past_medical_history.includes('Heart Disease')) {
      symptomData.past_medical_history.push('Heart Disease');
    }
  }
  if (
    inputLower.includes('asthma') ||
    inputLower.includes('dama') ||
    inputLower.includes('दमा') ||
    inputLower.includes('अस्थमा')
  ) {
    if (!symptomData.past_medical_history.includes('Asthma')) {
      symptomData.past_medical_history.push('Asthma');
    }
  }
  if (
    inputLower.includes('penicillin') ||
    inputLower.includes('allergy') ||
    inputLower.includes('allergi') ||
    inputLower.includes('एलर्जी') ||
    inputLower.includes('रिएक्शन')
  ) {
    if (!symptomData.allergies.includes(patientInput)) {
      symptomData.allergies.push(patientInput);
    }
  }
  if (
    inputLower.includes('medicine') ||
    inputLower.includes('medication') ||
    inputLower.includes('dawa') ||
    inputLower.includes('दवा') ||
    inputLower.includes('दवाई') ||
    inputLower.includes('दवाएं') ||
    inputLower.includes('गोली')
  ) {
    if (!symptomData.current_medications.includes(patientInput)) {
      symptomData.current_medications.push(patientInput);
    }
  }

  // Red-Flag Evaluation against rules
  const historyState: ClinicalHistoryState = {
    chiefComplaint: { value: symptomData.chief_complaint || '', duration: symptomData.duration || '', source: 'PATIENT_VOICE' },
    hpi: {
      site: symptomData.socrates.site || undefined,
      onset: symptomData.socrates.onset || undefined,
      character: symptomData.socrates.character || undefined,
      radiation: symptomData.socrates.radiation || undefined,
      associatedSymptoms: symptomData.socrates.associations,
      severity: Number(symptomData.severity) || (symptomData.severity === 'Severe' ? 8 : undefined),
    },
    pastMedicalHistory: symptomData.past_medical_history,
    pastSurgicalHistory: [],
    medications: symptomData.current_medications.map((m, idx) => ({ id: `MED_${idx}`, name: m, source: 'PATIENT_VOICE' })),
    allergies: symptomData.allergies.map(a => ({ allergen: a, source: 'PATIENT_VOICE' })),
    familyHistory: [],
    personalHistory: {},
    reviewOfSystems: {},
    ayushHistory: {},
  };

  const redFlagAlerts = evaluateRedFlags(historyState, patientInput);
  const redFlagDetected = redFlagAlerts.length > 0;
  const redFlagReason = redFlagDetected
    ? redFlagAlerts.map(a => `${a.title}: ${a.description}`).join('; ')
    : null;

  // Session Closure / Termination Check
  const closureSignaled = isPatientClosureSignaled(patientInput);
  const turnsCount = conversationHistory.length;
  const allCriticalExhausted =
    Boolean(symptomData.chief_complaint) &&
    Boolean(symptomData.duration || symptomData.socrates.onset) &&
    Boolean(symptomData.socrates.site) &&
    Boolean(symptomData.severity || symptomData.socrates.severity) &&
    (turnsCount >= 8 || (symptomData.past_medical_history.length > 0 || symptomData.allergies.length > 0 || symptomData.current_medications.length > 0));

  const shouldTransition = closureSignaled || allCriticalExhausted;

  // Track what was already asked in assistant turns to prevent repeating identical or semantic questions
  const askedTexts = conversationHistory
    .filter((m) => m.role === 'ASSISTANT' || m.role === 'assistant')
    .map((m) => m.content.toLowerCase())
    .join(' ');

  // Select Spoken Response (1-2 sentences warm, asking only one question at a time, or concluding)
  // Select Spoken Response with explicit questionId, domain, and field metadata
  let spokenResponse = '';
  let questionId = '';
  let domain = '';
  let field = '';

  if (shouldTransition) {
    questionId = 'interview_finish_confirm';
    domain = 'COMPLETION';
    field = 'completion_confirmation';
    spokenResponse = isHindi
      ? 'आपकी दी गई जानकारी को दर्ज कर लिया गया है। कृपया अपने पुराने दस्तावेज़ और पर्चे स्कैन के लिए तैयार रखें।'
      : 'Thank you for sharing your details. I have recorded your symptoms. Please prepare any past medical records or prescriptions for document scan.';
  } else if (
    !symptomData.duration &&
    !symptomData.socrates.onset &&
    !askedTexts.includes('कब') &&
    !askedTexts.includes('कितनी देर') &&
    !askedTexts.includes('when') &&
    !askedTexts.includes('how long')
  ) {
    questionId = 'pain_duration';
    domain = 'SOCRATES';
    field = 'onset';
    spokenResponse = isHindi
      ? 'यह समस्या आपको कब से हो रही है?'
      : 'When did this problem start or how long has it lasted?';
  } else if (
    !symptomData.socrates.site &&
    !askedTexts.includes('जगह') &&
    !askedTexts.includes('कहाँ') &&
    !askedTexts.includes('where')
  ) {
    questionId = 'pain_location';
    domain = 'SOCRATES';
    field = 'site';
    spokenResponse = isHindi
      ? 'शरीर में यह तकलीफ ठीक किस जगह महसूस हो रही है?'
      : 'Where exactly in your body are you feeling this discomfort?';
  } else if (
    !symptomData.socrates.character &&
    !askedTexts.includes('कैसा महसूस') &&
    !askedTexts.includes('दर्द कैसा') &&
    !askedTexts.includes('किस तरह') &&
    !askedTexts.includes('अहसास कैसा') &&
    !askedTexts.includes('feel like') &&
    !askedTexts.includes('how would you describe')
  ) {
    questionId = 'pain_character';
    domain = 'SOCRATES';
    field = 'character';
    spokenResponse = isHindi
      ? 'यह दर्द या तकलीफ किस तरह की महसूस होती है, जैसे तेज, भारीपन या जलन?'
      : 'How would you describe the feeling, such as sharp, squeezing pressure, or burning?';
  } else if (
    !symptomData.socrates.severity &&
    !symptomData.severity &&
    !askedTexts.includes('पैमाने') &&
    !askedTexts.includes('0 से 10') &&
    !askedTexts.includes('1 से 10') &&
    !askedTexts.includes('scale') &&
    !askedTexts.includes('how severe')
  ) {
    questionId = 'pain_severity';
    domain = 'SOCRATES';
    field = 'severity';
    spokenResponse = isHindi
      ? '0 से 10 के पैमाने पर, आपकी तकलीफ कितनी तेज है?'
      : 'On a scale from 0 to 10, how severe is your pain or discomfort right now?';
  } else if (
    symptomData.socrates.associations.length === 0 &&
    !askedTexts.includes('पसीना') &&
    !askedTexts.includes('उल्टी') &&
    !askedTexts.includes('सांस फूलना') &&
    !askedTexts.includes('associated')
  ) {
    questionId = 'associated_symptoms';
    domain = 'SOCRATES';
    field = 'associatedSymptoms';
    spokenResponse = isHindi
      ? 'क्या इसके साथ आपको सांस फूलना, पसीना आना या उल्टी जैसी कोई और परेशानी है?'
      : 'Do you also have any associated symptoms like shortness of breath, sweating, or nausea?';
  } else if (
    symptomData.past_medical_history.length === 0 &&
    !askedTexts.includes('ब्लड प्रेशर') &&
    !askedTexts.includes('बीपी') &&
    !askedTexts.includes('शुगर') &&
    !askedTexts.includes('medical conditions')
  ) {
    questionId = 'past_medical_history';
    domain = 'MEDICAL_HISTORY';
    field = 'pastMedicalHistory';
    spokenResponse = isHindi
      ? 'क्या आपको पहले से ब्लड प्रेशर, शुगर या दिल की कोई बीमारी है?'
      : 'Do you have any existing medical conditions like high blood pressure or diabetes?';
  } else if (
    symptomData.allergies.length === 0 &&
    !askedTexts.includes('एलर्जी') &&
    !askedTexts.includes('allergi') &&
    !askedTexts.includes('allergies')
  ) {
    questionId = 'allergies';
    domain = 'ALLERGIES';
    field = 'allergies';
    spokenResponse = isHindi
      ? 'क्या आपको किसी दवा से कोई एलर्जी है?'
      : 'Do you have any known allergies to medicines or foods?';
  } else if (
    symptomData.current_medications.length === 0 &&
    !askedTexts.includes('दवा') &&
    !askedTexts.includes('medication')
  ) {
    questionId = 'current_medications';
    domain = 'MEDICATIONS';
    field = 'medications';
    spokenResponse = isHindi
      ? 'क्या आप नियमित रूप से कोई दवा ले रहे हैं?'
      : 'Are you currently taking any regular medications?';
  } else {
    questionId = 'open_inquiry';
    domain = 'REVIEW';
    field = 'additional_info';
    spokenResponse = isHindi
      ? 'क्या आप अपने स्वास्थ्य के बारे में कुछ और बताना चाहते हैं?'
      : 'Is there anything else about your symptoms or medical history you would like to mention?';
  }

  return {
    spoken_response: spokenResponse,
    questionId,
    domain,
    field,
    red_flag_detected: redFlagDetected,
    red_flag_reason: redFlagReason,
    should_transition: shouldTransition,
    extracted_symptom_data: symptomData,
  };
}

export const processConversationTurn = processClinicalTurn;
