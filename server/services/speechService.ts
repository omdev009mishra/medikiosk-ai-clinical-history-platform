/**
 * Express Speech Recognition Service Client
 * Communicates over localhost with the Python Faster-Whisper microservice (port 8001).
 */

export interface TranscriptionResult {
  success: boolean;
  text: string;
  transcript?: string;
  rawTranscript?: string;
  normalizedTranscript?: string;
  language?: string;
  languageProbability?: number;
  processingTimeMs?: number;
  segments?: Array<{ id: number; start: number; end: number; text: string }>;
  error?: string;
  errorCode?: 'SPEECH_SERVICE_UNAVAILABLE' | 'INVALID_AUDIO' | 'TRANSCRIPTION_TIMEOUT' | 'PROCESSING_ERROR';
  gpuAccelerated?: boolean;
  orchestratedBy?: string;
}

export interface SpeechServiceHealthStatus {
  status: string;
  speechServiceReachable: boolean;
  serviceUrl: string;
  model?: string;
  device?: string;
  computeType?: string;
  gpuEnabled?: boolean;
  cudaDevices?: number;
  defaultLanguage?: string;
  error?: string;
}

export interface SynthesisResult {
  success: boolean;
  audioBase64?: string;
  mimeType?: string;
  durationSec?: number;
  voice?: string;
  language?: string;
  error?: string;
}

export function getSpeechServiceUrl(): string {
  return (process.env.SPEECH_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');
}

/**
 * Checks Pipecat service status and supported languages.
 */
export async function checkPipecatStatus(): Promise<any> {
  const serviceUrl = getSpeechServiceUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${serviceUrl}/pipecat/status`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = await response.json();
      return { success: true, ...data };
    }
    return { success: false, error: `Pipecat status returned ${response.status}` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Pipecat service unreachable' };
  }
}

/**
 * Synthesizes speech using the Python Pipecat/Edge-TTS microservice.
 */
export async function synthesizeSpeech(
  text: string,
  language: string = 'hi',
  gender: string = 'female'
): Promise<SynthesisResult> {
  const serviceUrl = getSpeechServiceUrl();
  if (!text || !text.trim()) {
    return { success: false, error: 'Empty text provided for synthesis' };
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 15000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${serviceUrl}/pipecat/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        language,
        gender,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errData: any = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errData?.error || `TTS synthesis error: HTTP ${response.status}`,
      };
    }

    const data: any = await response.json();
    return {
      success: data.success ?? true,
      audioBase64: data.audioBase64,
      mimeType: data.mimeType || 'audio/mp3',
      durationSec: data.durationSec,
      voice: data.voice,
      language: data.language,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'TTS service unreachable',
    };
  }
}

/**
 * Checks connectivity and model health of the Python Faster-Whisper service.
 */
export async function checkSpeechServiceHealth(): Promise<SpeechServiceHealthStatus> {
  const serviceUrl = getSpeechServiceUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${serviceUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data: any = await response.json();
      return {
        status: data.status || 'healthy',
        speechServiceReachable: true,
        serviceUrl,
        model: data.model,
        device: data.device,
        computeType: data.compute_type || data.computeType,
        gpuEnabled: data.gpuEnabled ?? (data.device === 'cuda'),
        cudaDevices: data.cudaDevices,
        defaultLanguage: data.defaultLanguage || data.default_language,
      };
    }
    return {
      status: 'degraded',
      speechServiceReachable: false,
      serviceUrl,
      error: `Speech service returned status ${response.status}`,
    };
  } catch (err: any) {
    return {
      status: 'offline',
      speechServiceReachable: false,
      serviceUrl,
      error: 'Voice service is temporarily unavailable. Ensure Python speech-service is running on ' + serviceUrl,
    };
  }
}

/**
 * Transcribes audio buffer via Python Faster-Whisper microservice.
 */
export async function transcribeAudio(
  fileBuffer: Buffer,
  fileName: string = 'recording.webm',
  mimeType: string = 'audio/webm',
  language?: string
): Promise<TranscriptionResult> {
  const serviceUrl = getSpeechServiceUrl();

  if (!fileBuffer || fileBuffer.length === 0) {
    return {
      success: false,
      text: '',
      error: 'Empty audio buffer received.',
      errorCode: 'INVALID_AUDIO',
    };
  }

  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, fileName);
    if (language) {
      formData.append('language', language);
    }

    const controller = new AbortController();
    const timeoutMs = Number(process.env.AI_TIMEOUT) || 60000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    console.log(`[PIPECAT DEBUG] Forwarding audio turn to Pipecat Voice Service at ${serviceUrl}/pipecat/turn (${fileBuffer.length} bytes, ${fileName}, ${mimeType}, language: ${language || 'auto'})`);
    let response = await fetch(`${serviceUrl}/pipecat/turn`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok && response.status === 404) {
      console.warn('[PIPECAT DEBUG] /pipecat/turn not found, falling back to /transcribe');
      response = await fetch(`${serviceUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    }

    clearTimeout(timer);
    console.log(`[PIPECAT DEBUG] Pipecat turn response received (HTTP ${response.status})`);

    if (!response.ok) {
      const errData: any = await response.json().catch(() => ({}));
      const errMsg =
        typeof errData?.error === 'object'
          ? errData.error.message
          : errData?.error || `Speech service returned error ${response.status}`;
      const errCode = response.status === 400 ? 'INVALID_AUDIO' : 'PROCESSING_ERROR';

      return {
        success: false,
        text: '',
        error: errMsg,
        errorCode: errCode,
      };
    }

    const data: any = await response.json();
    const rawTranscript = data.rawTranscript || data.raw_transcript || data.transcript || data.text || '';
    const normalizedTranscript = data.normalizedTranscript || data.normalized_transcript || data.transcript || data.text || '';
    const transcriptText = normalizedTranscript || rawTranscript;
    console.log(`[PIPECAT DEBUG] Turn orchestrated by: ${data.orchestratedBy || 'pipecat'} (Duration: ${data.duration}s, Language: ${data.detectedLanguage || data.language})`);
    console.log(`[VOICE DEBUG 12] Transcript (Normalized): "${normalizedTranscript}", Raw: "${rawTranscript}"`);
    return {
      success: data.success ?? true,
      text: transcriptText,
      transcript: transcriptText,
      rawTranscript,
      normalizedTranscript,
      language: data.detectedLanguage || data.detected_language || data.language,
      languageProbability: data.language_probability,
      processingTimeMs: data.processing_time_ms || (data.duration ? Math.round(data.duration * 1000) : 0),
      segments: data.segments || [],
      gpuAccelerated: data.gpu_accelerated ?? false,
      orchestratedBy: data.orchestratedBy || 'pipecat',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        success: false,
        text: '',
        error: 'Speech recognition timed out. Please try again or type your answer.',
        errorCode: 'TRANSCRIPTION_TIMEOUT',
      };
    }
    console.warn('[Speech Client Error] Could not reach speech service:', err?.message || err, 'cause:', err?.cause);

    // Safe single retry on transient socket glitch
    try {
      await new Promise((r) => setTimeout(r, 250));
      const retryForm = new FormData();
      const retryBlob = new Blob([fileBuffer], { type: mimeType });
      retryForm.append('file', retryBlob, fileName);
      if (language) retryForm.append('language', language);
      const retryRes = await fetch(`${serviceUrl}/transcribe`, {
        method: 'POST',
        body: retryForm,
      });
      if (retryRes.ok) {
        const data: any = await retryRes.json();
        const rawTranscript = data.rawTranscript || data.raw_transcript || data.transcript || data.text || '';
        const normalizedTranscript = data.normalizedTranscript || data.normalized_transcript || data.transcript || data.text || '';
        return {
          success: true,
          text: normalizedTranscript || rawTranscript,
          transcript: normalizedTranscript || rawTranscript,
          rawTranscript,
          normalizedTranscript,
          language: data.detectedLanguage || data.detected_language || data.language,
          languageProbability: data.language_probability,
          processingTimeMs: data.processing_time_ms || 0,
          segments: data.segments || [],
          gpuAccelerated: data.gpu_accelerated ?? false,
        };
      }
    } catch (retryErr) {
      console.warn('[Speech Client Retry Failed]:', retryErr);
    }

    return {
      success: false,
      text: '',
      error: 'Voice service is temporarily unavailable. Please type your response or ask for assistance.',
      errorCode: 'SPEECH_SERVICE_UNAVAILABLE',
    };
  }
}
