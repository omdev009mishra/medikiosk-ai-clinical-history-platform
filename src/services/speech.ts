// Web Speech Recognition, MediaRecorder, AudioContext VAD & Speech Services for MediKiosk

export const SILENCE_DURATION = 1800; // 1.8 seconds of silence after speech to stop recording
export const SPEECH_THRESHOLD = 0.018; // Calibrated RMS audio energy threshold for reliable speech detection
export const MAX_RECORDING_DURATION = 45000; // 45 seconds max recording safety cap
export const INITIAL_SILENCE_TIMEOUT = 14000; // 14 seconds timeout if patient never starts speaking

export function getExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

export interface ContinuousRecordingCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onVolumeChange?: (volume: number) => void;
}

export interface ContinuousRecordingResult {
  blob: Blob | null;
  base64?: string;
  mimeType?: string;
  fileName?: string;
  durationMs?: number;
  hasSpoken: boolean;
  reason?: 'SILENCE_DETECTED' | 'NO_SPEECH' | 'MAX_DURATION' | 'MANUAL_STOP';
}

export class SpeechService {
  private static synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  static isRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  static createRecognition(language: string = 'hi-IN', onResult: (text: string) => void, onError?: (err: any) => void) {
    if (!this.isRecognitionSupported()) return null;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

    rec.onresult = (event: any) => {
      let current = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        current += event.results[i][0].transcript;
      }
      onResult(current);
    };

    rec.onerror = (err: any) => {
      console.warn('[Speech Recognition Warning]:', err);
      if (onError) onError(err);
    };

    return rec;
  }

  static speak(text: string, lang: 'hi' | 'en' = 'hi', onEnd?: () => void) {
    if (!this.synth) return;

    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    this.synth.speak(utterance);
  }

  static stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  static stop() {
    this.stopSpeaking();
  }
}

/**
 * Browser Audio Recorder with dynamic MIME detection, safe permission handling,
 * and multipart/form-data transport.
 */
export class AudioRecorder {
  protected mediaRecorder: MediaRecorder | null = null;
  protected audioChunks: Blob[] = [];
  protected stream: MediaStream | null = null;
  protected startTime: number = 0;
  protected actualMimeType: string = 'audio/webm';

  static isRecordingSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  static getSupportedMimeType(): string {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return 'audio/webm';

    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
    ];

    const supportedMimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
    return supportedMimeType || 'audio/webm';
  }

  async start(): Promise<boolean> {
    if (!AudioRecorder.isRecordingSupported()) {
      throw new Error('Microphone recording is not supported in this browser environment.');
    }

    this.audioChunks = [];
    this.startTime = Date.now();

    // Secure context validation
    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      throw new Error('Microphone access requires a secure context (HTTPS or localhost).');
    }

    console.log('[VOICE DEBUG] Requesting microphone permission');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log('[VOICE DEBUG] Microphone permission granted');
      console.log('[VOICE DEBUG] Microphone initialized successfully');
      console.log('[VOICE DEBUG] Audio stream active');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission was denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No microphone found. Please connect a microphone or use text input.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        throw new Error('Microphone is busy or being used by another application.');
      } else if (err.name === 'SecurityError') {
        throw new Error('Microphone access blocked due to security restrictions.');
      }
      throw new Error(`Microphone access error: ${err.message || 'Unable to access microphone'}`);
    }

    const preferredMime = AudioRecorder.getSupportedMimeType();
    const options: MediaRecorderOptions = preferredMime ? { mimeType: preferredMime } : {};

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch {
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.actualMimeType = this.mediaRecorder.mimeType || preferredMime || 'audio/webm';

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250);
    console.log('[VOICE DEBUG] MediaRecorder started');
    return true;
  }

  async stop(): Promise<{ blob: Blob; base64: string; mimeType: string; fileName: string; durationMs: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return reject(new Error('MediaRecorder is not active.'));
      }

      this.mediaRecorder.onstop = async () => {
        console.log('[VOICE DEBUG] Recording stopped');
        try {
          const durationMs = Date.now() - this.startTime;
          const mimeType = this.actualMimeType || this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });

          console.log(`[VOICE DEBUG] Audio blob size: ${audioBlob.size} bytes`);
          console.log(`[VOICE DEBUG] Audio MIME type: ${mimeType}`);

          // Clean up stream tracks
          if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
          }

          if (!audioBlob || audioBlob.size === 0) {
            return reject(new Error('No audio was recorded. Please speak into the microphone.'));
          }

          const ext = getExtensionFromMimeType(mimeType);
          const fileName = `recording.${ext}`;

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = (reader.result as string) || '';
            resolve({
              blob: audioBlob,
              base64: base64data,
              mimeType,
              fileName,
              durationMs,
            });
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(audioBlob);
        } catch (e) {
          reject(e);
        }
      };

      this.mediaRecorder.stop();
    });
  }
}

/**
 * Continuous Audio Recorder with Voice Activity Detection (VAD)
 * 
 * Uses Web Audio API (AudioContext + AnalyserNode) to detect when speech begins,
 * continuously track audio energy, and automatically stop when silence is detected
 * for the configured duration (~1.8s) after the patient has spoken.
 */
export class ContinuousAudioRecorder extends AudioRecorder {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private vadIntervalId: any = null;
  private isListeningActive: boolean = false;
  private hasSpoken: boolean = false;
  private lastSpeechTime: number = 0;
  private recordingPromiseResolve: ((value: ContinuousRecordingResult) => void) | null = null;
  private recordingPromiseReject: ((reason?: any) => void) | null = null;

  async startContinuousListening(
    callbacks?: ContinuousRecordingCallbacks,
    options?: {
      silenceDurationMs?: number;
      speechThreshold?: number;
      maxDurationMs?: number;
      initialSilenceTimeoutMs?: number;
    }
  ): Promise<ContinuousRecordingResult> {
    const silenceDuration = options?.silenceDurationMs ?? SILENCE_DURATION;
    const speechThreshold = options?.speechThreshold ?? SPEECH_THRESHOLD;
    const maxDuration = options?.maxDurationMs ?? MAX_RECORDING_DURATION;
    const initialSilenceTimeout = options?.initialSilenceTimeoutMs ?? INITIAL_SILENCE_TIMEOUT;

    // Start basic microphone recording
    await this.start();

    this.isListeningActive = true;
    this.hasSpoken = false;
    this.lastSpeechTime = 0;

    // Setup Web Audio VAD
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtxClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.2;

      if (this.stream) {
        this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
        this.sourceNode.connect(this.analyser);
      }
    } catch (err) {
      console.warn('[MediKiosk VAD] Web Audio Context failed to initialize, falling back to manual recording:', err);
    }

    return new Promise<ContinuousRecordingResult>((resolve, reject) => {
      this.recordingPromiseResolve = resolve;
      this.recordingPromiseReject = reject;

      const dataArray = this.analyser ? new Uint8Array(this.analyser.fftSize) : null;

      // Real-time analysis polling loop (~50ms intervals)
      this.vadIntervalId = setInterval(() => {
        if (!this.isListeningActive) return;

        const now = Date.now();
        const elapsed = now - this.startTime;

        // 1. Calculate RMS volume from time-domain waveform
        let rms = 0;
        if (this.analyser && dataArray) {
          this.analyser.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128.0;
            sumSquares += normalized * normalized;
          }
          rms = Math.sqrt(sumSquares / dataArray.length);
          callbacks?.onVolumeChange?.(rms);
        }

        // 2. Check if current volume exceeds speech threshold
        if (rms >= speechThreshold) {
          if (!this.hasSpoken) {
            this.hasSpoken = true;
            console.log(`[MediKiosk VAD] Speech detected (RMS: ${rms.toFixed(3)} >= ${speechThreshold}).`);
            callbacks?.onSpeechStart?.();
          }
          this.lastSpeechTime = now;
        }

        // 3. Check for silence AFTER user has started speaking
        if (this.hasSpoken) {
          const silenceElapsed = now - this.lastSpeechTime;
          if (silenceElapsed >= silenceDuration) {
            console.log(`[MediKiosk VAD] Silence threshold reached (${silenceElapsed}ms >= ${silenceDuration}ms). Auto-stopping recording.`);
            callbacks?.onSpeechEnd?.();
            this.finishRecording('SILENCE_DETECTED');
            return;
          }
        } else {
          // 4. Check initial silence timeout (user didn't say anything for 14s)
          if (elapsed >= initialSilenceTimeout) {
            console.log(`[MediKiosk VAD] Initial silence timeout reached (${elapsed}ms without speech).`);
            this.finishRecording('NO_SPEECH');
            return;
          }
        }

        // 5. Safety cap for maximum duration
        if (elapsed >= maxDuration) {
          console.log(`[MediKiosk VAD] Max recording duration reached (${maxDuration}ms). Auto-stopping.`);
          callbacks?.onSpeechEnd?.();
          this.finishRecording('MAX_DURATION');
          return;
        }
      }, 60);
    });
  }

  private async finishRecording(reason: 'SILENCE_DETECTED' | 'NO_SPEECH' | 'MAX_DURATION' | 'MANUAL_STOP') {
    if (!this.isListeningActive) return;
    this.isListeningActive = false;

    this.cleanupAudioDetection();

    const resolve = this.recordingPromiseResolve;
    this.recordingPromiseResolve = null;
    this.recordingPromiseReject = null;

    const totalChunkBytes = this.audioChunks.reduce((acc, c) => acc + c.size, 0);
    if (reason === 'MANUAL_STOP' || (reason === 'NO_SPEECH' && totalChunkBytes >= 1500)) {
      this.hasSpoken = true;
      if (reason === 'NO_SPEECH') {
        console.log(`[VOICE DEBUG] Audio detected from chunk buffer (${totalChunkBytes} bytes) despite VAD threshold. Processing audio.`);
      }
    }

    if (reason === 'NO_SPEECH' && !this.hasSpoken) {
      // User never spoke anything, safely stop without sending empty audio
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch {}
      }
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
      if (resolve) {
        resolve({
          blob: null,
          hasSpoken: false,
          reason: 'NO_SPEECH',
        });
      }
      return;
    }

    // Speech was recorded, stop MediaRecorder and create Blob
    try {
      const stopResult = await this.stop();
      if (resolve) {
        resolve({
          blob: stopResult.blob,
          base64: stopResult.base64,
          mimeType: stopResult.mimeType,
          fileName: stopResult.fileName,
          durationMs: stopResult.durationMs,
          hasSpoken: this.hasSpoken,
          reason,
        });
      }
    } catch (err) {
      if (this.recordingPromiseReject) {
        this.recordingPromiseReject(err);
      } else if (resolve) {
        resolve({
          blob: null,
          hasSpoken: false,
          reason,
        });
      }
    }
  }

  stopListening(): void {
    if (this.isListeningActive) {
      console.log('[MediKiosk VAD] Manually stopping continuous listening.');
      this.finishRecording('MANUAL_STOP');
    }
  }

  cleanupAudioDetection(): void {
    if (this.vadIntervalId) {
      clearInterval(this.vadIntervalId);
      this.vadIntervalId = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }

    if (this.audioContext) {
      try {
        if (this.audioContext.state !== 'closed') {
          this.audioContext.close().catch(() => {});
        }
      } catch {}
      this.audioContext = null;
    }
  }
}

/**
 * Sends audio blob using native multipart/form-data as primary transport.
 */
export async function sendAudioBlob(
  blob: Blob,
  fileName?: string,
  language?: string
): Promise<{ success: boolean; data?: any; error?: { message: string; code?: string } }> {
  if (!blob || blob.size === 0) {
    console.error('[VOICE DEBUG] Audio blob size is 0 bytes');
    throw new Error('No audio was recorded');
  }

  const ext = getExtensionFromMimeType(blob.type);
  const actualFileName = fileName || `recording.${ext}`;

  console.log('[VOICE DEBUG] Sending audio to /api/speech/transcribe');
  console.log(`[VOICE DEBUG] Audio blob size: ${blob.size} bytes`);
  console.log(`[VOICE DEBUG] Audio format: ${blob.type}`);
  console.log(`[VOICE DEBUG 8] Uploading audio via multipart/form-data: ${actualFileName} (${blob.size} bytes, language: ${language || 'auto'})`);

  const formData = new FormData();
  formData.append('audio', blob, actualFileName);
  if (language && language !== 'auto') {
    formData.append('language', language);
  }

  try {
    const res = await fetch('/api/speech/transcribe', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: {
          message: data?.error?.message || `Voice processing failed (${res.status})`,
          code: data?.error?.code || 'TRANSCRIPTION_ERROR',
        },
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: {
        message: 'Could not connect to voice transcription service.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}
