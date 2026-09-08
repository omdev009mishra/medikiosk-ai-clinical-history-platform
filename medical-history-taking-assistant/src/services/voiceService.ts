// Speech synthesis (Assistant reading aloud) and Web Speech Recognition helpers
// Supporting multilingual BCP-47 codes (hi-IN, mr-IN, en-IN, etc.)

import { getLanguageConfig } from '../config/languages';

export interface VoiceSpeakOptions {
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export class SpeechSynthesisService {
  private static isMuted: boolean = false;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;

  public static setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  public static getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Speaks text in the target language.
   * Gracefully falls back if no suitable voice is available.
   * Returns true if speech was initiated, false otherwise.
   */
  public static speak(text: string, options: VoiceSpeakOptions = {}): boolean {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }

    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing utterance
      this.currentUtterance = null;

      const langId = options.lang || 'en';
      const langConfig = getLanguageConfig(langId);
      const targetBcp47 = langConfig.speechSynthesis || 'en-IN';
      const primaryLang = targetBcp47.split('-')[0].toLowerCase();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = targetBcp47;
      utterance.rate = 0.95; // Calm, respectful clinical pacing
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();

      // Find voices matching the target language or primary language prefix
      const matchingVoices = voices.filter((v) => {
        const vLang = v.lang.toLowerCase().replace('_', '-');
        return vLang === targetBcp47.toLowerCase() || vLang.startsWith(primaryLang);
      });

      if (matchingVoices.length > 0) {
        // Prefer natural / google / high-quality neural voices
        const preferred = matchingVoices.find(
          (v) =>
            v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Neural') ||
            v.name.includes('India') ||
            v.name.includes('Female')
        ) || matchingVoices[0];

        utterance.voice = preferred;
      } else {
        // If English, any english voice is fine
        if (primaryLang === 'en') {
          const fallbackEn = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
          if (fallbackEn) utterance.voice = fallbackEn;
        } else {
          // If no matching voice for an Indian regional language, do NOT speak using an English voice!
          // Playing Devanagari or regional scripts with an English voice sounds like gibberish.
          // Gracefully fall back to text-only mode as required by prompt.
          console.info(`No browser voice available for ${targetBcp47}. Gracefully falling back to text-only presentation.`);
          return false;
        }
      }

      if (options.onStart) {
        utterance.onstart = options.onStart;
      }

      utterance.onend = () => {
        this.currentUtterance = null;
        if (options.onEnd) options.onEnd();
      };

      utterance.onerror = (e) => {
        this.currentUtterance = null;
        if (options.onError) options.onError(e);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn('Speech synthesis failed:', err);
      return false;
    }
  }

  public static stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  public static isSpeaking(): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    return window.speechSynthesis.speaking;
  }
}

// Browser Speech Recognition Wrapper
export interface SpeechRecognitionResultPayload {
  transcript: string;
  isFinal: boolean;
}

export interface SpeechRecognizerOptions {
  lang?: string;
  onResult: (result: SpeechRecognitionResultPayload) => void;
  onError: (errorMessage: string, isPermanent: boolean) => void;
  onEnd: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function createSpeechRecognizer(options: SpeechRecognizerOptions) {
  if (!isSpeechRecognitionSupported()) {
    return null;
  }

  const SpeechRecognitionClass =
    (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  const langConfig = getLanguageConfig(options.lang);
  const recognitionLang = langConfig.speechRecognition || 'en-IN';

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = recognitionLang;

  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const item = event.results[i];
      if (item.isFinal) {
        finalTranscript += item[0].transcript;
      } else {
        interimTranscript += item[0].transcript;
      }
    }

    const combined = (finalTranscript || interimTranscript).trim();
    if (combined) {
      options.onResult({
        transcript: combined,
        isFinal: Boolean(finalTranscript),
      });
    }
  };

  recognition.onerror = (event: any) => {
    const errorType = event.error || '';

    // Ignore benign abort or empty-noise speech errors during active turn
    if (errorType === 'aborted') {
      return;
    }

    let userFriendlyMessage = "Sorry, I couldn't understand that. Please try again or type instead.";
    let isPermanent = false;

    if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
      userFriendlyMessage = 'Microphone access was denied. Please allow microphone permission in your browser or type your answer.';
      isPermanent = true;
    } else if (errorType === 'no-speech') {
      userFriendlyMessage = 'No speech was detected. Please tap the microphone to try again, or type below.';
      isPermanent = false;
    } else if (errorType === 'audio-capture') {
      userFriendlyMessage = 'No microphone was found or audio capture failed. Please check your audio device or type instead.';
      isPermanent = true;
    } else if (errorType === 'network') {
      userFriendlyMessage = 'Speech recognition network error. Please try again or type your answer.';
      isPermanent = false;
    } else if (errorType === 'language-not-supported') {
      userFriendlyMessage = `Speech recognition is not supported for this language in this browser. Please type your response.`;
      isPermanent = true;
    }

    options.onError(userFriendlyMessage, isPermanent);
  };

  recognition.onend = () => {
    options.onEnd();
  };

  return recognition;
}
