/**
 * Interview Completion Detection Service (Phase 7.5)
 * Context-aware detection of explicit patient completion signals.
 */

export interface CompletionDetectionResult {
  isCompletionSignal: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

const EXPLICIT_ENDING_PHRASES_EN = [
  "that's all",
  "that's everything",
  "i am done",
  "i'm done",
  "nothing else",
  "no, that's it",
  "no thats it",
  "i have told you everything",
  "i told you everything",
  "that's all i want to say",
  "no more information",
  "that's it doctor",
  "nothing more",
  "that is all",
  "that is everything",
  "that is it",
  "nothing further",
  "i have finished",
  "finished speaking",
];

const EXPLICIT_ENDING_PHRASES_HI = [
  "बस इतना ही",
  "बस",
  "और कुछ नहीं",
  "मैंने सब बता दिया",
  "इतना ही है",
  "मेरी बात खत्म हो गई",
  "बस यही कहना था",
  "और कुछ नहीं बताना",
  "सब बता दिया है",
  "और नहीं है",
];

const EXPLICIT_ENDING_PHRASES_HINGLISH = [
  "bas itna hi",
  "aur kuch nahi",
  "aur kuch nahe",
  "maine sab bata diya",
  "that's it bas",
  "mujhe aur kuch nahi bolna",
  "bas ho gaya",
  "aur kuch nahi hai",
  "bas itna",
  "khatam हो गया",
  "khatam ho gaya",
  "itna hi tha",
  "kuch nahi hai",
];

const FINAL_OPEN_QUESTION_KEYWORDS = [
  "anything else",
  "anything more",
  "anything otherwise",
  "other symptoms or health history",
  "kuch aur",
  "kuch aur batana",
  "koi aur pareshani",
  "kuch aur kehna",
];

export function detectInterviewCompletion(
  patientInput: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  lastAiQuestion: string = ''
): CompletionDetectionResult {
  const inputClean = (patientInput || '').trim().toLowerCase();
  const questionClean = (lastAiQuestion || '').toLowerCase();

  if (!inputClean) {
    return {
      isCompletionSignal: false,
      confidence: 'LOW',
      reason: 'Empty patient input',
    };
  }

  // 0. Explicit Continuation or Symptom Negation Safeguards
  if (
    inputClean.includes('continue') ||
    inputClean.includes('jari') ||
    inputClean.includes('aur bolna') ||
    inputClean.includes('aur batana') ||
    inputClean === 'no, continue talking' ||
    inputClean === 'no continue'
  ) {
    return {
      isCompletionSignal: false,
      confidence: 'HIGH',
      reason: 'Patient indicated wanting to continue speaking',
    };
  }

  const SYMPTOM_NEGATION_REGEX = /^(no|nahi|nahin|not)\s+(nausea|vomiting|fever|cough|pain|headache|chest pain|breathlessness|swelling|dizziness|allergy|allergies|history|medication|bp|sugar|diabetes|hypertension)/i;
  if (
    SYMPTOM_NEGATION_REGEX.test(inputClean) ||
    inputClean.startsWith('no nausea') ||
    inputClean.startsWith('no vomiting') ||
    inputClean === 'nothing hurts' ||
    inputClean === 'nothing hurts now'
  ) {
    return {
      isCompletionSignal: false,
      confidence: 'HIGH',
      reason: 'Symptom negation is clinical information, not a completion signal',
    };
  }

  // 1. Direct Explicit Ending Statement Detection
  const hasEnMatch = EXPLICIT_ENDING_PHRASES_EN.some((phrase) => inputClean.includes(phrase));
  const hasHiMatch = EXPLICIT_ENDING_PHRASES_HI.some((phrase) => inputClean.includes(phrase));
  const hasHinglishMatch = EXPLICIT_ENDING_PHRASES_HINGLISH.some((phrase) => inputClean.includes(phrase));

  if (hasEnMatch || hasHiMatch || hasHinglishMatch) {
    // Check if input is JUST "no" or "nahi" without ending context
    const isBareNo = inputClean === 'no' || inputClean === 'nahi' || inputClean === 'नहीं';
    if (!isBareNo) {
      console.log(`[MediKiosk Completion] Explicit completion phrase matched: "${inputClean}"`);
      return {
        isCompletionSignal: true,
        confidence: 'HIGH',
        reason: 'Explicit patient ending statement detected',
      };
    }
  }

  // 2. Context-Aware Evaluation for Final Open Question
  // If AI asked "Is there anything else you would like to tell me?" and patient answered "No", "Nothing else", "Nahi"
  const isFinalOpenQuestion = FINAL_OPEN_QUESTION_KEYWORDS.some((kw) => questionClean.includes(kw));

const FINAL_NEGATIVE_RESPONSES = new Set([
  'no',
  'nothing',
  'nothing else',
  'no, nothing else',
  'no thats it',
  "no, that's it",
  'no thats all',
  "no that's all",
  'no, that is all',
  'nope',
  'nahi',
  'नहीं',
  'kuch nahi',
  'aur kuch nahi',
  'bas itna',
  'bas itna hi',
]);

  if (isFinalOpenQuestion) {
    const isNegativeAnswer =
      FINAL_NEGATIVE_RESPONSES.has(inputClean) ||
      inputClean.startsWith('no, that') ||
      inputClean.startsWith('no that') ||
      inputClean.startsWith('no, nothing') ||
      inputClean.startsWith('nahi, kuch nahi');

    if (isNegativeAnswer) {
      console.log(`[MediKiosk Completion] Patient answered negative to final open question: "${inputClean}"`);
      return {
        isCompletionSignal: true,
        confidence: 'HIGH',
        reason: 'Patient confirmed no further information to final open question',
      };
    }
  }

  // 3. Safety Guard: Bare "no" to a symptom question MUST NOT complete the interview
  if (inputClean === 'no' || inputClean === 'nahi' || inputClean === 'नहीं') {
    return {
      isCompletionSignal: false,
      confidence: 'HIGH',
      reason: 'Bare negative answer to symptom question is a clinical negation, not completion',
    };
  }

  return {
    isCompletionSignal: false,
    confidence: 'LOW',
    reason: 'No completion phrases or open question confirmation matched',
  };
}
