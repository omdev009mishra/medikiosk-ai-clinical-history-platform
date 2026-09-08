/**
 * MediKiosk Local Ollama Client
 * Low-level client for communicating with local Ollama API
 */

export interface OllamaConfig {
  baseUrl: string;
  conversationModel: string;
  medicalModel: string;
  timeoutMs: number;
}

export function getOllamaConfig(): OllamaConfig {
  return {
    baseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, ''),
    conversationModel: process.env.CONVERSATION_MODEL || 'qwen2.5:7b',
    medicalModel: process.env.MEDICAL_MODEL || 'medgemma1.5:latest',
    timeoutMs: Number(process.env.AI_TIMEOUT) || 120000,
  };
}

export interface OllamaHealthStatus {
  status: 'ok' | 'degraded' | 'offline';
  ollamaReachable: boolean;
  baseUrl: string;
  configuredModels: {
    conversation: string;
    medical: string;
  };
  modelAvailability: {
    conversationModelAvailable: boolean;
    medicalModelAvailable: boolean;
  };
  availableModels: string[];
  error?: string;
}

/**
 * Checks connectivity to the local Ollama server and verifies if configured models exist.
 */
export async function checkOllamaHealth(): Promise<OllamaHealthStatus> {
  const config = getOllamaConfig();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5s health timeout

    const response = await fetch(`${config.baseUrl}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        status: 'degraded',
        ollamaReachable: false,
        baseUrl: config.baseUrl,
        configuredModels: {
          conversation: config.conversationModel,
          medical: config.medicalModel,
        },
        modelAvailability: {
          conversationModelAvailable: false,
          medicalModelAvailable: false,
        },
        availableModels: [],
        error: `Ollama returned status ${response.status}`,
      };
    }

    const data: any = await response.json();
    const availableModels: string[] = (data.models || []).map((m: any) => m.name || m.model);

    const conversationModelAvailable = availableModels.some(
      (m) => m === config.conversationModel || m.startsWith(config.conversationModel + ':')
    );
    const medicalModelAvailable = availableModels.some(
      (m) => m === config.medicalModel || m.startsWith(config.medicalModel + ':')
    );

    const isFullyHealthy = conversationModelAvailable && medicalModelAvailable;

    return {
      status: isFullyHealthy ? 'ok' : 'degraded',
      ollamaReachable: true,
      baseUrl: config.baseUrl,
      configuredModels: {
        conversation: config.conversationModel,
        medical: config.medicalModel,
      },
      modelAvailability: {
        conversationModelAvailable,
        medicalModelAvailable,
      },
      availableModels,
    };
  } catch (err: any) {
    console.warn('[Ollama Client] Health check failed:', err?.message || err);
    return {
      status: 'offline',
      ollamaReachable: false,
      baseUrl: config.baseUrl,
      configuredModels: {
        conversation: config.conversationModel,
        medical: config.medicalModel,
      },
      modelAvailability: {
        conversationModelAvailable: false,
        medicalModelAvailable: false,
      },
      availableModels: [],
      error: 'Could not connect to local Ollama server. Ensure Ollama service is running on ' + config.baseUrl,
    };
  }
}

export interface OllamaGenerateOptions {
  model: string;
  prompt: string;
  systemPrompt?: string;
  imageBase64?: string;
  temperature?: number;
  jsonFormat?: boolean;
}

/**
 * Clean and parse JSON safely from raw AI text output.
 */
export function parseJSONFromText<T>(rawText: string): T | null {
  if (!rawText || typeof rawText !== 'string') return null;

  let cleaned = rawText.trim();

  // Strip markdown code fences if present (e.g. ```json ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  try {
    return JSON.parse(cleaned) as T;
  } catch (firstErr) {
    // Attempt substring extraction if AI added conversational text before/after JSON
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonCandidate) as T;
      } catch (secErr) {
        console.error('[Ollama Client] Failed to parse extracted JSON candidate:', secErr);
      }
    }
    console.error('[Ollama Client] Raw AI output could not be parsed as JSON:', rawText.slice(0, 300));
    return null;
  }
}

/**
 * Main function to generate completion from Ollama.
 */
export async function generateCompletion(options: OllamaGenerateOptions): Promise<string | null> {
  const config = getOllamaConfig();
  const endpoint = `${config.baseUrl}/api/generate`;

  const payload: any = {
    model: options.model,
    prompt: options.prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.2,
    },
  };

  if (options.systemPrompt) {
    payload.system = options.systemPrompt;
  }

  if (options.jsonFormat) {
    payload.format = 'json';
  }

  if (options.imageBase64) {
    const cleanBase64 = options.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    payload.images = [cleanBase64];
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[Ollama Error] HTTP ${response.status} from ${options.model}: ${errText}`);
      return null;
    }

    const data: any = await response.json();
    return data.response || null;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.error(`[Ollama Timeout] Request to ${options.model} timed out after ${config.timeoutMs}ms`);
    } else {
      console.error(`[Ollama Connection Error] Could not reach Ollama at ${config.baseUrl}:`, err?.message || err);
    }
    return null;
  }
}

/**
 * Generate structured JSON response from specified model.
 */
export async function generateJSON<T>(options: OllamaGenerateOptions): Promise<T | null> {
  const rawText = await generateCompletion({
    ...options,
    jsonFormat: true,
  });

  if (!rawText) return null;
  return parseJSONFromText<T>(rawText);
}
