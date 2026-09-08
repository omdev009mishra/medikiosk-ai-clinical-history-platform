import { GeminiResponse, MessageTurn, StructuredMedicalHistory } from '../types';

export async function getNextMedicalQuestion(
  params: {
    history: MessageTurn[];
    latestAnswer: string;
    questionNumber: number;
    structuredHistory: StructuredMedicalHistory;
    language?: string;
    isInitial?: boolean;
    isLanguageSwitch?: boolean;
  },
  retriesRemaining = 1
): Promise<GeminiResponse> {
  try {
    const response = await fetch('/api/medical/next-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      if ((response.status === 503 || response.status === 429) && retriesRemaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return getNextMedicalQuestion(params, retriesRemaining - 1);
      }

      const errData = await response.json().catch(() => ({}));
      let errMsg = errData.error || `Server error: ${response.statusText}`;
      if (typeof errMsg === 'object') {
        errMsg = errMsg.message || JSON.stringify(errMsg);
      }
      throw new Error(errMsg);
    }

    return response.json();
  } catch (err: any) {
    if (
      retriesRemaining > 0 &&
      (err?.message?.includes('503') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('Failed to fetch'))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return getNextMedicalQuestion(params, retriesRemaining - 1);
    }
    throw err;
  }
}

export async function requestSummaryGeneration(
  params: {
    history: MessageTurn[];
    structuredHistory: StructuredMedicalHistory;
    language?: string;
  },
  retriesRemaining = 1
) {
  try {
    const response = await fetch('/api/medical/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      if ((response.status === 503 || response.status === 429) && retriesRemaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return requestSummaryGeneration(params, retriesRemaining - 1);
      }

      const errData = await response.json().catch(() => ({}));
      let errMsg = errData.error || `Server error: ${response.statusText}`;
      if (typeof errMsg === 'object') {
        errMsg = errMsg.message || JSON.stringify(errMsg);
      }
      throw new Error(errMsg);
    }

    return response.json();
  } catch (err: any) {
    if (
      retriesRemaining > 0 &&
      (err?.message?.includes('503') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('Failed to fetch'))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return requestSummaryGeneration(params, retriesRemaining - 1);
    }
    throw err;
  }
}

