import { GoogleGenAI } from '@google/genai';
import {
  FinalMedicalSummary,
  SummaryGenerationParams,
} from './types';
import { MEDICAL_SYSTEM_INSTRUCTION } from './geminiInterrogationEngine';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
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

/**
 * Generates structured Health Information Summary based ONLY on patient's answers
 * Ported directly from medical-history-taking-assistant.zip server.ts (/api/medical/summary)
 */
export async function generateMedicalSummary(params: SummaryGenerationParams): Promise<FinalMedicalSummary> {
  const { history = [], structuredHistory = {}, language = 'en', priorOcrContext = '' } = params;

  const prompt = `
Generate a concise, organized, and clinically formatted Health Information Summary based ONLY on the user's provided information.

Target Language for the summary: "${language}"

${priorOcrContext ? `PRIOR MEDICAL RECORDS (OCR):\n${priorOcrContext}\n` : ''}

CONVERSATION HISTORY:
${history.map((h: { role: string; message: string }) => `[${h.role.toUpperCase()}]: ${h.message}`).join('\n')}

STRUCTURED DATA (Internal standardized record):
${JSON.stringify(structuredHistory, null, 2)}

INSTRUCTIONS:
1. Do NOT invent, assume, or diagnose any disease or condition.
2. Structure the summary cleanly with sections in "${language}":
   - Chief Complaint
   - History of Present Illness (Onset, Duration, Location, Character, Severity, Aggravating/Alleviating factors)
   - Associated Symptoms & Pertinent Negatives
   - Medical History / Medications / Allergies (if reported)
   - Additional Notes
3. The title, section labels, values, and disclaimer MUST be written in "${language}".
4. Return ONLY a valid JSON object matching:
{
  "title": string,
  "chiefComplaint": string,
  "sections": [
    { "label": string, "value": string }
  ],
  "disclaimer": string
}
`;

  const ai = getAiClient();
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: MEDICAL_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
      const text = response.text || '{}';
      return cleanJsonResponse(text);
    } catch (geminiErr: any) {
      console.warn(`[Summary Engine] Gemini call failed (${geminiErr?.message}). Falling back to local AI...`);
    }
  }

  // Fallback to local Ollama
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const localModel = process.env.CONVERSATION_MODEL || 'qwen2.5:7b';

    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: localModel,
        format: 'json',
        stream: false,
        messages: [
          { role: 'system', content: MEDICAL_SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt },
        ],
        options: { temperature: 0.1 },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return cleanJsonResponse(data.message?.content || '{}');
    }
  } catch (localErr: any) {
    console.error('[Summary Engine] Local fallback failed:', localErr);
  }

  // Deterministic fallback summary
  const isHi = (language || '').startsWith('hi');
  return {
    title: isHi ? 'स्वास्थ्य जानकारी सारांश' : 'Health Information Summary',
    chiefComplaint: structuredHistory.chiefComplaint || (isHi ? 'स्वास्थ्य समस्या' : 'Reported issue'),
    sections: [
      {
        label: isHi ? 'मुख्य समस्या' : 'Chief Complaint',
        value: structuredHistory.chiefComplaint || (isHi ? 'उपलब्ध नहीं' : 'Not specified'),
      },
      {
        label: isHi ? 'अवधि' : 'Duration',
        value: structuredHistory.duration || (isHi ? 'उपलब्ध नहीं' : 'Not specified'),
      },
      {
        label: isHi ? 'स्थान' : 'Location',
        value: structuredHistory.location || (isHi ? 'उपलब्ध नहीं' : 'Not specified'),
      },
      {
        label: isHi ? 'गंभीरता' : 'Severity',
        value: structuredHistory.severity || (isHi ? 'उपलब्ध नहीं' : 'Not specified'),
      },
    ],
    disclaimer: isHi
      ? 'यह सारांश आपके द्वारा दी गई जानकारी पर आधारित है और यह कोई चिकित्सीय निदान नहीं है।'
      : 'This summary reflects the information you provided and is not a medical diagnosis.',
  };
}
