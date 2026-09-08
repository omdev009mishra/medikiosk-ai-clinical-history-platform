/**
 * Conversation AI Service
 * Powered by Qwen2.5:7b for patient intake dialogue and natural conversation flow.
 */

import { generateJSON, getOllamaConfig } from './ollama';
import { CONVERSATION_SYSTEM_PROMPT, buildFollowupPrompt } from './prompts/conversationPrompts';

export interface FollowupQuestionResult {
  response: string;
  suggestedNextQuestion?: {
    en: string;
    hi: string;
  };
}

/**
 * Continues patient intake conversation using Qwen2.5:7b.
 * Generates an empathetic response and patient-friendly follow-up question.
 */
export async function generateConversationFollowup(
  history: Array<{ role: string; text: string }>,
  latestPatientInput: string
): Promise<FollowupQuestionResult | null> {
  const config = getOllamaConfig();

  const prompt = buildFollowupPrompt(history, latestPatientInput);

  try {
    const result = await generateJSON<FollowupQuestionResult>({
      model: config.conversationModel,
      prompt,
      systemPrompt: CONVERSATION_SYSTEM_PROMPT,
      temperature: 0.3,
    });

    if (!result) return null;

    return {
      response: result.response || 'Thank you for sharing that information with us.',
      suggestedNextQuestion: result.suggestedNextQuestion,
    };
  } catch (err) {
    console.error('[Conversation AI Error]:', err);
    return null;
  }
}
