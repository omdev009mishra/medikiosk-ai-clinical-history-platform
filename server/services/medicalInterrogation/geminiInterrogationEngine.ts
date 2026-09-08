import { GoogleGenAI } from '@google/genai';
import {
  GeminiResponse,
  InterrogationTurnParams,
  StructuredMedicalHistory,
} from './types';

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-latest',
];

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function cleanJsonResponse(raw: string): any {
  let cleaned = (raw || '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

export const MEDICAL_SYSTEM_INSTRUCTION = `You are an intelligent clinical intake assistant conducting an adaptive, conversational medical history-taking interview.
Your job is to collect relevant health information through a short, dynamic conversation tailored step-by-step to the patient's individual situation.

MULTILINGUAL & CODE-SWITCHING RULES:
* You support English, Hindi, Marathi, Bengali, Gujarati, Punjabi, Tamil, Telugu, Kannada, Malayalam, Urdu, Odia, Assamese, and other languages.
* Understand the semantic meaning of the user's response regardless of language, script, or code-switching.
* Indian users frequently mix languages (e.g. "Mere stomach mein kal se pain ho raha hai", "Mujhe chest mein pain ho raha hai aur breathing bhi thodi difficult hai").
* Extract medical concepts accurately (e.g., complaint = abdominal pain, duration = 1 day) from code-switched phrases. Do NOT treat code-switched words as transcription errors or language errors.
* Always maintain a language-independent internal medical state in standardized English (e.g. keys and standard values for chiefComplaint, symptoms, duration, onset, location, severity, character, associatedSymptoms, etc.).
* Respond to the user in their selected/preferred language (e.g. if user is interacting in Hindi or selected Hindi, ask questions and generate options strictly in natural Hindi; if Marathi, in natural Marathi; if English, in natural English).
* Once the user selects or speaks in a language, keep the conversation in that language. Never unnecessarily switch languages.
* Generate answer options in the exact same language as the question.
* Preserve important medical terminology accurately while using simple, patient-friendly phrasing that ordinary people understand (e.g., instead of asking about "photophobia", ask if bright light worsens their headache).
* If the user's speech transcription contains minor phonetic, spelling, or grammatical errors, infer the intended clinical meaning from context without changing the medical meaning.
* If the meaning is genuinely unclear, ask the user to repeat or clarify instead of guessing.

ADAPTIVE CLINICAL CONVERSATION RULES:
* Never use a fixed questionnaire or hardcoded question paths. Every question must be dynamically generated based on what the patient has said so far and what high-value clinical details are still missing.
* Ask exactly ONE question at a time. Never ask multiple questions bundled together.
* Never ask for information that is already known, implied, or previously answered.
* The conversation must never exceed 14 questions.
* If sufficient information has been collected to form an informative intake history, complete the conversation early.
* Do not diagnose diseases or prescribe medications.
* If critical emergency red flags are detected, immediately stop questioning and issue an urgent medical safety message in the user's active language.`;

export function getFallbackInitialQuestion(language: string): GeminiResponse {
  const lang = (language || 'en').toLowerCase();
  if (lang.startsWith('hi')) {
    return {
      status: 'continue',
      language: 'hi',
      detectedLanguage: 'hi',
      inputStyle: 'native',
      questionNumber: 1,
      assistantMessage: 'नमस्ते, आज आपको क्या स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं? कृपया अपने शब्दों में बताएं।',
      options: [
        'सिरदर्द (Headache)',
        'पेट दर्द (Stomach pain)',
        'बुखार और ठंड (Fever)',
        'खांसी या सांस लेने में परेशानी',
        'छाती में दर्द या भारीपन',
        'कमजोरी या चक्कर आना',
      ],
      riskLevel: 'normal',
      urgentReason: '',
      reasonForQuestion: 'मुख्य स्वास्थ्य समस्या और लक्षणों की पहचान (Chief complaint)',
      extractedFromLastAnswer: {},
      structuredHistory: {},
    };
  }
  if (lang.startsWith('mr')) {
    return {
      status: 'continue',
      language: 'mr',
      detectedLanguage: 'mr',
      inputStyle: 'native',
      questionNumber: 1,
      assistantMessage: 'नमस्कार, आज तुम्हाला आरोग्याची कोणती समस्या किंवा त्रास जाणवत आहे? कृपया आपल्या शब्दांत सांगा.',
      options: [
        'डोकेदुखी (Headache)',
        'पोटदुखी (Stomach pain)',
        'ताप आणि थंडी (Fever)',
        'खोकला किंवा श्वास घेण्यास त्रास',
        'छातीत दुखणे',
        'अशक्तपणा किंवा चक्कर येणे',
      ],
      riskLevel: 'normal',
      urgentReason: '',
      reasonForQuestion: 'आरोग्याच्या मुख्य तक्रारीचे स्वरूप समजून घेणे',
      extractedFromLastAnswer: {},
      structuredHistory: {},
    };
  }
  if (lang.startsWith('bn')) {
    return {
      status: 'continue',
      language: 'bn',
      detectedLanguage: 'bn',
      inputStyle: 'native',
      questionNumber: 1,
      assistantMessage: 'নমস্কার, আজ আপনার কি স্বাস্থ্য समस्या বা উপসর্গ দেখা দিচ্ছে? অনুগ্রহ করে বলুন।',
      options: [
        'মাথাব্যথা (Headache)',
        'পেট ব্যথা (Stomach pain)',
        'জ্বর ও কাঁপুনি (Fever)',
        'কাশি বা শ্বাসকষ্ট',
        'বুকে অস্বস্তি',
      ],
      riskLevel: 'normal',
      urgentReason: '',
      reasonForQuestion: 'Chief complaint identification',
      extractedFromLastAnswer: {},
      structuredHistory: {},
    };
  }

  // Default English / Auto
  return {
    status: 'continue',
    language: language === 'auto' ? 'en' : language,
    detectedLanguage: language === 'auto' ? 'en' : language,
    inputStyle: 'english',
    questionNumber: 1,
    assistantMessage: 'Hello, what health problem or symptoms are you experiencing today? You may speak or type in any language.',
    options: [
      'Headache',
      'Abdominal / Stomach pain',
      'Fever and chills',
      'Cough or shortness of breath',
      'Chest discomfort or pain',
      'General weakness or fatigue',
    ],
    riskLevel: 'normal',
    urgentReason: '',
    reasonForQuestion: 'Chief complaint identification',
    extractedFromLastAnswer: {},
    structuredHistory: {},
  };
}

/**
 * Executes prompt with Gemini candidate models with timeout and retry
 */
async function generateWithGeminiFallback(
  ai: GoogleGenAI,
  prompt: string,
  options: { systemInstruction: string; temperature?: number }
): Promise<any> {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction: options.systemInstruction,
              responseMimeType: 'application/json',
              temperature: options.temperature ?? 0.2,
            },
          }),
          25000,
          `Model ${model} timed out after 25s`
        );

        const text = response.text || '{}';
        return cleanJsonResponse(text);
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const status = err?.status || err?.code;
        const isTransient =
          status === 503 ||
          status === 429 ||
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('timed out') ||
          msg.includes('high demand') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('RESOURCE_EXHAUSTED');

        console.warn(`[Gemini Interrogation] Model ${model} (attempt ${attempt}) failed: ${msg}`);

        if (isTransient && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 200));
        } else {
          break; // Try next candidate model
        }
      }
    }
  }

  throw lastError || new Error('All Gemini candidate models failed.');
}

/**
 * Resilient Local AI Fallback (Local Ollama qwen2.5:7b)
 * Used if Gemini API Key is not configured or in case of network disconnect.
 */
async function generateWithLocalFallback(prompt: string, systemInstruction: string): Promise<any> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.CONVERSATION_MODEL || 'qwen2.5:7b';

  console.log(`[Medical Interrogation Engine] Using local Ollama fallback (${model})...`);

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      format: 'json',
      stream: false,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
      options: {
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama fallback responded with status ${res.status}`);
  }

  const data = await res.json();
  const content = data.message?.content || '{}';
  return cleanJsonResponse(content);
}

/**
 * Main Medical Interrogation Turn Generator
 * Ported directly from medical-history-taking-assistant.zip server.ts
 */
export async function getNextMedicalQuestion(params: InterrogationTurnParams): Promise<GeminiResponse> {
  const {
    history = [],
    latestAnswer = '',
    questionNumber = 1,
    structuredHistory = {},
    language = 'en',
    isInitial = false,
    isLanguageSwitch = false,
    priorOcrContext = '',
  } = params;

  let prompt = '';

  if (isInitial) {
    prompt = `
GENERATE OPENING CLINICAL INTAKE QUESTION:
Target Language: "${language}"

${priorOcrContext ? `PRIOR MEDICAL RECORDS FROM PATIENT DOCUMENTS (OCR):\n${priorOcrContext}\n` : ''}

Instructions:
1. If language is "auto", generate a warm, welcoming opening question inviting the patient to describe what health problem or symptoms they are experiencing today. Mention politely that they can speak or type in English, हिन्दी, मराठी, or any language of their choice.
2. If a specific language is selected (such as "hi" for Hindi, "mr" for Marathi, "en" for English, "bn" for Bengali, "gu" for Gujarati, "ta" for Tamil, etc.):
   - Generate the opening question purely in that natural language (e.g. Hindi: "नमस्ते, आज आपको किस स्वास्थ्य समस्या के बारे में बात करनी है?", Marathi: "नमस्कार, आज तुम्हाला आरोग्याची कोणती समस्या जाणवत आहे?").
   - Provide 5 to 7 dynamic high-level symptom category quick-select options in that same language (e.g. in Hindi: ["दर्द", "बुखार", "खांसी / सांस लेने में तकलीफ", "सिरदर्द", "पेट / पाचन", "त्वचा की समस्या", "अन्य"]).
3. Set status = "continue", riskLevel = "normal", questionNumber = 1.
4. Keep structuredHistory as an empty object {}.

Return ONLY valid JSON matching this schema:
{
  "status": "continue",
  "language": "${language === 'auto' ? 'en' : language}",
  "detectedLanguage": "${language}",
  "inputStyle": "native",
  "questionNumber": 1,
  "assistantMessage": string,
  "options": string[],
  "riskLevel": "normal",
  "urgentReason": "",
  "reasonForQuestion": "Primary chief complaint identification",
  "extractedFromLastAnswer": {},
  "structuredHistory": {}
}
`;
  } else if (isLanguageSwitch) {
    prompt = `
LANGUAGE SWITCH REQUEST:
The user changed their interface language to "${language}".
Existing structured clinical history (preserved in standardized English):
${JSON.stringify(structuredHistory, null, 2)}

${priorOcrContext ? `PRIOR MEDICAL RECORDS (OCR):\n${priorOcrContext}\n` : ''}

Recent Conversation History:
${history.map((h: { role: string; message: string }) => `[${h.role.toUpperCase()}]: ${h.message}`).join('\n')}

Instructions:
1. Formulate the next appropriate clinical question for this patient strictly in "${language}".
2. Provide 3 to 6 dynamic options in "${language}".
3. Keep the entire internal structuredHistory intact in standardized English.
4. Set status = "continue", riskLevel = "normal", questionNumber = ${questionNumber}.

Return ONLY valid JSON matching this schema:
{
  "status": "continue",
  "language": "${language}",
  "detectedLanguage": "${language}",
  "questionNumber": ${questionNumber},
  "assistantMessage": string,
  "options": string[],
  "riskLevel": "normal",
  "urgentReason": "",
  "reasonForQuestion": "Continue interview in switched language",
  "extractedFromLastAnswer": {},
  "structuredHistory": ${JSON.stringify(structuredHistory)}
}
`;
  } else {
    prompt = `
Analyze the user's latest response and clinical conversation to determine the next action in medical history-taking.

CURRENT PROGRESS:
Current Question Number: ${questionNumber} of 14 maximum allowed questions.
Active / Requested Language: "${language}"

${priorOcrContext ? `PRIOR MEDICAL RECORDS / LABS FROM OCR (Consider for context, contradictions, and pertinent questions):\n${priorOcrContext}\n` : ''}

EXISTING STRUCTURED CLINICAL DATA (Standardized in English):
${JSON.stringify(structuredHistory, null, 2)}

CONVERSATION HISTORY:
${history.map((h: { role: string; message: string; questionNumber?: number }) => `[${h.role.toUpperCase()}${h.questionNumber ? ` (Q${h.questionNumber})` : ''}]: ${h.message}`).join('\n')}

LATEST USER ANSWER:
"${latestAnswer}"

CRITICAL INSTRUCTIONS:
1. Language & Code-Switching Semantic Understanding:
   - The user's input may be in native script (Devanagari, Bengali, Tamil, etc.), English, or Romanized code-switching (e.g. Hinglish like "Mere stomach mein kal se pain ho raha hai", "Mujhe chest me heavy feel ho raha hai").
   - Extract the clinical meaning regardless of language or code-switching.
   - If language was "auto" or user communicated in a specific language, determine the primary language ("hi", "mr", "en", "bn", "gu", "pa", "ta", "te", "kn", "ml", "ur", "or", "as", etc.) and set "detectedLanguage".
   - Determine inputStyle: "hinglish", "native", "english", or "mixed".
   - The output "assistantMessage" and "options" MUST be in the active language (if detectedLanguage is Hindi, output in Hindi script; if Marathi, Marathi script; if English, English; etc.).
   - NEVER switch to English if the user is communicating in Hindi, Marathi, etc.

2. Clinical Data Extraction:
   - Extract ALL newly provided medical details from the latest answer (e.g. location, onset, duration, character, severity, radiation, triggers, relieving factors, accompanying symptoms, fever, prior episodes, medications, allergies, etc.).
   - Merge these into the updated structuredHistory in standardized English keys and values so that the internal state is language-neutral.
   - Remember everything said previously. NEVER ask a question for information already provided or clearly implied.

3. Safety / Red-Flag Screening:
   - Screen for critical emergency/red-flag symptoms. Examples:
     * Acute crushing chest pain, radiating to arm/jaw, diaphoresis, severe dyspnea
     * Sudden severe difficulty breathing / respiratory distress
     * Sudden acute focal neurological deficit (facial droop, unilateral arm weakness, slurred speech)
     * Sudden "worst headache of life" (thunderclap) with neck rigidity
     * Signs of severe anaphylaxis (airway/tongue swelling, severe wheezing)
     * Severe uncontrolled bleeding, severe trauma, active suicidal intent
     * Acute rigid board-like abdomen with signs of shock
   - If emergency red-flags are detected:
     * Set status = "urgent_stop"
     * Set riskLevel = "urgent"
     * Provide assistantMessage IN THE ACTIVE LANGUAGE:
       - If Hindi: "आपके द्वारा बताए गए कुछ लक्षणों के लिए तुरंत चिकित्सा सहायता की आवश्यकता हो सकती है। कृपया तुरंत आपातकालीन चिकित्सा सहायता लें।"
       - If Marathi: "आपण सांगितलेल्या काही लक्षणांसाठी तातडीने वैद्यकीय मदतीची आवश्यकता असू शकते. कृपया त्वरित वैद्यकीय मदत घ्या."
       - If English: "Some of the symptoms you've described may require urgent medical attention. Please seek immediate medical care or contact your local emergency service."
       - Or equivalent in the active language.
     * Provide urgentReason in the active language explaining the clinical concern concisely.
     * Do NOT continue questionnaire.

4. Completion Decision:
   - If questionNumber >= 14, or if sufficient high-value clinical information has been gathered to create a thorough intake history:
     * Set status = "complete"
     * Set riskLevel = "normal"
     * Provide a polite closing assistantMessage in the active language.
     * Generate finalSummary object IN THE ACTIVE LANGUAGE based ONLY on user statements.
     * Do not ask another question.

5. Next Question Formulation (if not urgent and not complete):
   - Set status = "continue"
   - Formulate the SINGLE highest-value clinical question that is missing for THIS specific complaint in the active language.
   - Use simple, patient-friendly terms (not confusing jargon).
   - Provide 3 to 6 helpful, mutually exclusive shortcut answer options in the SAME language, or an empty array [] if open-ended narrative is clearly better.
   - NON-REPETITION & PROGRESSION RULES:
     * Never repeat a question or inquiry that has already been asked in the conversation history.
     * If the patient provided details (e.g. onset, character, symptoms, location), immediately acknowledge and proceed to a different unexamined clinical aspect (e.g., radiation, aggravating/relieving factors, fever, vomiting, medications taken).
     * Two consecutive assistant questions must NEVER have identical or repetitive phrasing.

Return ONLY a valid JSON object matching this schema:
{
  "status": "continue" | "complete" | "urgent_stop",
  "language": string,
  "detectedLanguage": string,
  "inputStyle": "hinglish" | "native" | "english" | "mixed",
  "questionNumber": number,
  "assistantMessage": string,
  "options": string[],
  "riskLevel": "normal" | "urgent",
  "urgentReason": string,
  "reasonForQuestion": string,
  "extractedFromLastAnswer": object,
  "structuredHistory": object,
  "finalSummary": {
    "title": string,
    "chiefComplaint": string,
    "sections": [
      { "label": string, "value": string }
    ],
    "disclaimer": string
  }
}
`;
  }

  const ai = getAiClient();

  if (ai) {
    try {
      const parsed = await generateWithGeminiFallback(ai, prompt, {
        systemInstruction: MEDICAL_SYSTEM_INSTRUCTION,
        temperature: 0.2,
      });
      return normalizeGeminiResponse(parsed, language, questionNumber);
    } catch (geminiErr: any) {
      console.warn(`[Gemini Interrogation Engine] Gemini error: ${geminiErr?.message}. Falling back to local AI...`);
    }
  }

  // Fallback to local Ollama AI
  try {
    const localResult = await generateWithLocalFallback(prompt, MEDICAL_SYSTEM_INSTRUCTION);
    return normalizeGeminiResponse(localResult, language, questionNumber);
  } catch (localErr: any) {
    console.error('[Medical Interrogation Engine] Both Gemini and local AI failed:', localErr);
    if (isInitial) {
      return getFallbackInitialQuestion(language);
    }
    throw localErr;
  }
}

/**
 * Normalizes and guards AI response for schema stability
 */
function normalizeGeminiResponse(
  raw: any,
  requestedLanguage: string,
  fallbackQuestionNumber: number
): GeminiResponse {
  const status = raw?.status === 'complete' || raw?.status === 'urgent_stop' ? raw.status : 'continue';
  const riskLevel = raw?.riskLevel === 'urgent' || status === 'urgent_stop' ? 'urgent' : 'normal';

  const assistantMessage =
    typeof raw?.assistantMessage === 'string' && raw.assistantMessage.trim().length > 0
      ? raw.assistantMessage.trim()
      : 'कृपया मुझे अपनी परेशानी के बारे में थोड़ा और बताएं।';

  const options: string[] = Array.isArray(raw?.options)
    ? raw.options.map((o: any) => (typeof o === 'string' ? o.trim() : String(o))).filter(Boolean)
    : [];

  const structuredHistory: StructuredMedicalHistory =
    raw?.structuredHistory && typeof raw.structuredHistory === 'object' ? raw.structuredHistory : {};

  return {
    status,
    language: raw?.language || requestedLanguage,
    detectedLanguage: raw?.detectedLanguage || requestedLanguage,
    inputStyle: raw?.inputStyle || 'native',
    questionNumber: typeof raw?.questionNumber === 'number' ? raw.questionNumber : fallbackQuestionNumber,
    assistantMessage,
    options,
    riskLevel,
    urgentReason: raw?.urgentReason || '',
    reasonForQuestion: raw?.reasonForQuestion || '',
    extractedFromLastAnswer: raw?.extractedFromLastAnswer || {},
    structuredHistory,
    finalSummary: raw?.finalSummary,
  };
}
