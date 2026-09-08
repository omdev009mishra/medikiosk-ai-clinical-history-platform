/**
 * Multilingual Text-to-Speech Engine for MediKiosk Voice Loop
 *
 * Integrates high-fidelity Neural TTS via the MediKiosk speech service with
 * seamless fallback to browser SpeechSynthesis.
 *
 * Supports instant barge-in / interruption: calling stopTextToSpeech() immediately
 * cuts off any active playback or speech synthesis.
 */

let activeAudio: HTMLAudioElement | null = null;
let activeAbortController: AbortController | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let heartbeatTimer: any = null;
let finishActivePlayback: (() => void) | null = null;

/**
 * Fallback browser-native SpeechSynthesis
 */
function speakViaBrowserSynthesis(text: string, lang: string = 'hi'): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('[MediKiosk TTS] SpeechSynthesis API not available in browser.');
      return resolve();
    }

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text.trim());
    activeUtterance = utterance;

    const normalizedLang = lang.toLowerCase();
    if (normalizedLang.startsWith('hi')) utterance.lang = 'hi-IN';
    else if (normalizedLang.startsWith('mr')) utterance.lang = 'mr-IN';
    else if (normalizedLang.startsWith('bn')) utterance.lang = 'bn-IN';
    else if (normalizedLang.startsWith('ta')) utterance.lang = 'ta-IN';
    else if (normalizedLang.startsWith('te')) utterance.lang = 'te-IN';
    else if (normalizedLang.startsWith('gu')) utterance.lang = 'gu-IN';
    else if (normalizedLang.startsWith('pa')) utterance.lang = 'pa-IN';
    else if (normalizedLang.startsWith('kn')) utterance.lang = 'kn-IN';
    else if (normalizedLang.startsWith('ml')) utterance.lang = 'ml-IN';
    else if (normalizedLang.startsWith('ur')) utterance.lang = 'ur-IN';
    else utterance.lang = 'en-IN';

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = synth.getVoices();
    if (voices && voices.length > 0) {
      const matchingVoice = voices.find(
        (v) => v.lang.toLowerCase().startsWith(normalizedLang.slice(0, 2))
      );
      if (matchingVoice) utterance.voice = matchingVoice;
    }

    let isCompleted = false;
    const cleanup = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      activeUtterance = null;
    };

    const finish = () => {
      if (!isCompleted) {
        isCompleted = true;
        cleanup();
        setTimeout(() => resolve(), 200);
      }
    };

    utterance.onend = () => finish();
    utterance.onerror = (err: any) => {
      if (err.error !== 'interrupted' && err.error !== 'canceled') {
        console.warn('[MediKiosk TTS] Browser speech synthesis error:', err.error);
      }
      finish();
    };

    heartbeatTimer = setInterval(() => {
      if (!synth.speaking) {
        cleanup();
      } else {
        synth.pause();
        synth.resume();
      }
    }, 4000);

    const wordCount = text.trim().split(/\s+/).length;
    const maxSafetyMs = Math.max(5000, wordCount * 600) + 3000;
    setTimeout(() => finish(), maxSafetyMs);

    try {
      synth.speak(utterance);
    } catch (err) {
      console.warn('[MediKiosk TTS] synth.speak failed:', err);
      finish();
    }
  });
}

/**
 * Main Text-to-Speech Invocation
 * Prefers high-fidelity Neural TTS from backend; gracefully falls back to browser synthesis.
 */
export async function speakText(text: string, lang: string = 'hi'): Promise<void> {
  // 1. Immediately cancel prior ongoing speech / audio
  stopTextToSpeech();

  const cleanText = (text || '').trim();
  if (!cleanText) return;

  const abortController = new AbortController();
  activeAbortController = abortController;

  return new Promise<void>(async (resolve) => {
    let hasFinished = false;

    const finalize = () => {
      if (!hasFinished) {
        hasFinished = true;
        finishActivePlayback = null;
        activeAbortController = null;
        activeAudio = null;
        // 200ms acoustic buffer to avoid mic feedback
        setTimeout(() => resolve(), 200);
      }
    };

    finishActivePlayback = finalize;

    try {
      // Request neural voice audio from backend
      const response = await fetch('/api/speech/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          language: lang,
          gender: 'female',
        }),
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) {
        finalize();
        return;
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.audioBase64) {
          const audioSrc = `data:${result.data.mimeType || 'audio/mp3'};base64,${result.data.audioBase64}`;
          const audio = new Audio(audioSrc);
          activeAudio = audio;

          audio.onended = () => {
            finalize();
          };

          audio.onerror = (err) => {
            console.warn('[MediKiosk TTS] Audio element playback error, falling back:', err);
            speakViaBrowserSynthesis(cleanText, lang).then(finalize);
          };

          if (abortController.signal.aborted) {
            finalize();
            return;
          }

          await audio.play();
          return;
        }
      }

      // If backend TTS was not successful or returned error, fall back to browser
      if (!abortController.signal.aborted) {
        await speakViaBrowserSynthesis(cleanText, lang);
      }
      finalize();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        finalize();
        return;
      }
      console.warn('[MediKiosk TTS] Neural TTS request failed, falling back to browser synthesis:', err.message);
      if (!abortController.signal.aborted) {
        await speakViaBrowserSynthesis(cleanText, lang);
      }
      finalize();
    }
  });
}

/**
 * Instantly stops any active audio playback, synthesis, or network request.
 * Implements instant barge-in / user interruption.
 */
export function stopTextToSpeech(): void {
  // Cancel active network request
  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch {}
    activeAbortController = null;
  }

  // Stop active Audio element
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {}
    activeAudio = null;
  }

  // Cancel browser synthesis
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    activeUtterance = null;
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  // Resolve any waiting promise
  if (finishActivePlayback) {
    finishActivePlayback();
    finishActivePlayback = null;
  }
}
