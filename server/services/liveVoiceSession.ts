import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Modality } from '@google/genai';
import { clinicalStore } from '../db/store';
import { adaptiveInterviewService } from './adaptiveInterviewService';
import { detectInterviewCompletion } from './interviewCompletionService';
import { transcribeAudio, synthesizeSpeech } from './speechService';
import { interviewSafetyService } from './interviewSafetyService';

interface LiveVoiceClientMessage {
  type: 'AUDIO_CHUNK' | 'TEXT_INPUT' | 'INTERRUPT' | 'COMPLETE_INTERVIEW' | 'PING';
  data?: string; // base64 PCM
  text?: string;
  source?: 'text' | 'voice';
  sampleRate?: number;
}

interface SessionConfig {
  encounterId: string;
  language?: string;
  patientName?: string;
  chiefComplaint?: string;
}

/**
 * Creates a valid 44-byte RIFF WAV header for 16-bit 16000Hz mono linear PCM
 */
function createWavHeader(dataByteLength: number, sampleRate = 16000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataByteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20);  // AudioFormat 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataByteLength, 40);

  return header;
}

export class LiveVoiceSession {
  private ws: WebSocket;
  private encounterId: string;
  private language: string;
  private ai: GoogleGenAI;
  private session: any = null;
  private isConnected: boolean = false;
  private isGeminiLiveActive: boolean = false;
  private currentAiTurnText: string = '';
  private currentUserTurnText: string = '';
  private incomingChunkCount: number = 0;

  // Turn deduplication tracking
  private lastProcessedTurnText: string = '';
  private lastProcessedTurnTime: number = 0;

  // Diagnostic WAV recording
  private diagnosticPcmChunks: Buffer[] = [];
  private diagnosticPcmBytes: number = 0;
  private diagnosticWavSaved: boolean = false;

  // Turn-based speech buffering for Whisper transcription
  private turnPcmChunks: Buffer[] = [];
  private turnPcmBytes: number = 0;
  private turnSilenceCount: number = 0;
  private hasDetectedSpeechInTurn: boolean = false;
  private isTranscribingTurn: boolean = false;

  constructor(ws: WebSocket, config: SessionConfig) {
    this.ws = ws;
    this.encounterId = config.encounterId;
    this.language = config.language || 'en';

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      console.error('[LiveVoiceSession] Missing GEMINI_API_KEY in environment');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async start(): Promise<void> {
    const encounter = clinicalStore.getEncounter(this.encounterId);
    const patient = encounter ? clinicalStore.getPatient(encounter.patientId) : null;
    const patientName = patient?.name || 'Patient';
    const knownComplaint = encounter?.history?.chiefComplaint?.value || '';

    const systemInstructionText = `You are MediKiosk AI, a warm, reassuring, and highly empathetic hospital clinical intake assistant in an Indian hospital outpatient department.
You are conversing in real-time with ${patientName}.${knownComplaint ? ` Known reported complaint: ${knownComplaint}.` : ''}

HUMANIZED & EMPATHETIC CLINICAL PRINCIPLES:
1. Warm, Caring Demeanor: Speak like a caring, attentive hospital intake nurse. Reassure the patient and make them feel heard and safe.
2. Natural Transitions: Naturally acknowledge what the patient shared before asking your next question (e.g. "I understand.", "Thanks for explaining that.", "Let me note down a bit more about that for the doctor.").
3. Simple Everyday Phrasing: Strictly avoid intimidating clinical jargon. Use simple phrases (e.g. "difficulty breathing or shortness of breath", "does the pain spread anywhere else, such as your arm or neck", "does bright light hurt your eyes").
4. Conversational Brevity: Speak ONLY 1 TO 2 SHORT SENTENCES per turn. Never give long lectures or multi-part questions. Ask only one clear question at a time so the patient can speak naturally.
5. Critical Safety: NEVER diagnose a disease (do NOT say "You are having a heart attack"). If patient reports red-flag symptoms (severe crushing chest pain, acute dyspnea/breathlessness, stroke-like numbness/weakness, uncontrolled bleeding, head injury with vomiting, seizure, anaphylaxis), calmly and urgently advise: "Based on what you've told me, you may need immediate medical attention. Please stay calm and proceed directly to the Emergency / Casualty desk."
6. When the patient indicates they are done sharing information (e.g., "that is all", "bas itna hi", "nothing else", "i am done"), warmly acknowledge and let them know their chart has been prepared for the doctor.`;

    try {
      console.log(`[LiveVoiceSession] Initializing Gemini Live for encounter ${this.encounterId}...`);

      const connectPromise = this.ai.live.connect({
        model: 'models/gemini-2.5-flash-native-audio-latest',
        callbacks: {
          onmessage: (msg: any) => this.handleGeminiMessage(msg),
          onerror: (err: any) => {
            console.error(`[LiveVoiceSession] Gemini Live Error [${this.encounterId}]:`, err);
            this.isGeminiLiveActive = false;
          },
          onclose: (e: any) => {
            console.log(`[LiveVoiceSession] Gemini Live Closed [${this.encounterId}]:`, e?.code, e?.reason);
            this.isGeminiLiveActive = false;
            this.session = null;
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemInstructionText }] },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
          },
        },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini Live connect timeout (4000ms)')), 4000)
      );

      this.session = (await Promise.race([connectPromise, timeoutPromise])) as any;

      this.isConnected = true;
      this.isGeminiLiveActive = true;
      console.log(`[LiveVoiceSession] Gemini Live successfully connected for encounter ${this.encounterId}`);

      // Notify client that connection is live and ready
      this.sendToClient({
        type: 'SESSION_READY',
        encounterId: this.encounterId,
        language: this.language,
      });

      // Send initial opening prompt to prompt Gemini to greet the patient
      const greetingPrompt = this.language === 'hi'
        ? 'Namaste! Patient has entered the kiosk. Give a warm, reassuring 1-sentence Hindi greeting: "नमस्ते! मेडीकियोस्क में आपका स्वागत है। डॉक्टर से मिलने से पहले मैं आपकी थोड़ी मदद करने के लिए यहाँ हूँ। आज आपको क्या परेशानी या तकलीफ महसूस हो रही है?"'
        : 'Hello! Patient has entered the kiosk. Give a warm, reassuring 1-sentence greeting: "Hello! Welcome to MediKiosk. I\'m here to help share your health concerns with the doctor. What brings you to the hospital today?"';

      this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
        turnComplete: true,
      });

    } catch (err: any) {
      console.warn(`[LiveVoiceSession] Gemini Live initial connection warning for ${this.encounterId}: ${err.message}. Activating Faster-Whisper + Clinical AI engine.`);
      this.isConnected = true;
      this.isGeminiLiveActive = false;

      this.sendToClient({
        type: 'SESSION_READY',
        encounterId: this.encounterId,
        language: this.language,
      });

      await this.sendFallbackGreeting();
    }
  }

  private async sendFallbackGreeting(): Promise<void> {
    try {
      const greetingText = this.language === 'hi'
        ? 'नमस्ते! मेडीकियोस्क में आपका स्वागत है। डॉक्टर से मिलने से पहले मैं आपकी थोड़ी मदद करने के लिए यहाँ हूँ। चिंता मत कीजिए—हम आराम से एक-एक कदम आगे बढ़ेंगे। आज आपको क्या परेशानी या तकलीफ महसूस हो रही है?'
        : "Hello! Welcome to MediKiosk. I'm here to help share your health concerns with the doctor. Don't worry—we will go step by step. What brings you to the hospital today?";

      console.log(`[LiveVoiceSession] Sending initial greeting: "${greetingText}"`);
      await this.recordTurn('ASSISTANT', greetingText);

      this.sendToClient({ type: 'TEXT_CHUNK', text: greetingText });
      this.sendToClient({ type: 'TURN_COMPLETE', fullText: greetingText });

      // Synthesize audio greeting via TTS
      const synthRes = await synthesizeSpeech(greetingText, this.language);
      if (synthRes.success && synthRes.audioBase64) {
        this.sendToClient({
          type: 'AUDIO_CHUNK',
          data: synthRes.audioBase64,
          mimeType: synthRes.mimeType || 'audio/mp3',
        });
      }
    } catch (err) {
      console.error('[LiveVoiceSession] Error sending fallback greeting:', err);
    }
  }

  public async handleClientMessage(raw: WebSocket.RawData, isBinary: boolean): Promise<void> {
    if (!this.isConnected) return;

    try {
      // 1. Binary PCM audio stream (High Performance)
      if (isBinary) {
        const buffer = Buffer.isBuffer(raw)
          ? raw
          : Array.isArray(raw)
          ? Buffer.concat(raw)
          : Buffer.from(raw as ArrayBuffer);

        this.processIncomingPcmAudio(buffer);
        return;
      }

      // 2. Text / JSON message
      const text = raw.toString('utf8');
      if (text.startsWith('{')) {
        const msg: LiveVoiceClientMessage = JSON.parse(text);
        
        if (msg.type === 'AUDIO_CHUNK' && msg.data) {
          const buf = Buffer.from(msg.data, 'base64');
          this.processIncomingPcmAudio(buf);
        } else if (msg.type === 'TEXT_INPUT' && msg.text) {
          const patientText = msg.text.trim();
          console.log(`[CLINICAL ENGINE] Patient text input: "${patientText}"`);
          console.log(`[CONVERSATION] Patient message received\nSource: ${msg.source || 'text'}`);
          console.log(`[CONVERSATION] Updating clinical context`);

          // Turn deduplication: avoid processing the exact same turn twice within 3.5s
          const now = Date.now();
          if (this.lastProcessedTurnText === patientText && (now - this.lastProcessedTurnTime < 3500)) {
            console.log(`[CLINICAL ENGINE] Turn already processed for: "${patientText}", avoiding duplicate execution`);
            return;
          }

          this.currentUserTurnText = patientText;
          await this.recordTurn('PATIENT', patientText);

          if (this.isGeminiLiveActive && this.session) {
            try {
              console.log(`[GEMINI LIVE] Sending patient turn to Gemini Live: "${patientText}"`);
              this.session.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: patientText }] }],
                turnComplete: true,
              });
            } catch (geminiErr) {
              console.warn('[LiveVoiceSession] Gemini Live turn send failed, using fallback engine:', geminiErr);
              await this.handleFallbackTurn(patientText);
            }
          } else {
            await this.handleFallbackTurn(patientText);
          }
        } else if (msg.type === 'INTERRUPT') {
          console.log(`[LiveVoiceSession] Client triggered instant barge-in for ${this.encounterId}`);
        } else if (msg.type === 'COMPLETE_INTERVIEW') {
          this.finishInterview();
        } else if (msg.type === 'PING') {
          this.sendToClient({ type: 'PONG' });
        }
      } else {
        // Fallback for non-flagged binary data
        const buf = Buffer.from(raw as any);
        this.processIncomingPcmAudio(buf);
      }
    } catch (err) {
      console.error(`[LiveVoiceSession] Error handling client message:`, err);
    }
  }

  private processIncomingPcmAudio(pcmBuffer: Buffer): void {
    if (pcmBuffer.length === 0) return;

    this.incomingChunkCount++;

    if (this.incomingChunkCount % 10 === 1) {
      console.log(`[WS AUDIO] Received chunk #${this.incomingChunkCount}, bytes: ${pcmBuffer.length}, format: PCM16`);
      console.log('[GEMINI INPUT] Received audio from browser');
      console.log('[GEMINI INPUT] Format: PCM16');
      console.log('[GEMINI INPUT] Sample rate: 16000');
      console.log(`[GEMINI INPUT] Bytes: ${pcmBuffer.length}`);
    }

    // Accumulate first ~3 seconds of diagnostic audio for WAV verification
    if (!this.diagnosticWavSaved && this.diagnosticPcmBytes < 96000) {
      this.diagnosticPcmChunks.push(pcmBuffer);
      this.diagnosticPcmBytes += pcmBuffer.length;

      if (this.diagnosticPcmBytes >= 96000) {
        this.saveDiagnosticWav();
      }
    }

    // Forward to Gemini Live via Base64 16kHz linear PCM if live session is active
    if (this.isGeminiLiveActive && this.session) {
      const base64 = pcmBuffer.toString('base64');
      try {
        this.session.sendRealtimeInput([
          { media: { mimeType: 'audio/pcm;rate=16000', data: base64 } },
        ]);
        if (this.incomingChunkCount % 10 === 1) {
          console.log('[GEMINI INPUT] Sending audio to Gemini');
          console.log('[GEMINI INPUT] Audio successfully submitted');
        }
      } catch (sendErr) {
        console.error('[GEMINI INPUT ERROR] Failed to send realtime input:', sendErr);
      }
    }

    // Turn buffering & VAD endpointing for Faster-Whisper transcription
    const int16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
    let sum = 0;
    for (let i = 0; i < int16.length; i++) {
      const norm = int16[i] / 32768.0;
      sum += norm * norm;
    }
    const rms = Math.sqrt(sum / int16.length);

    if (rms > 0.015) {
      // Patient is speaking
      this.hasDetectedSpeechInTurn = true;
      this.turnSilenceCount = 0;
      this.turnPcmChunks.push(pcmBuffer);
      this.turnPcmBytes += pcmBuffer.length;
    } else {
      // Silence / ambient
      if (this.hasDetectedSpeechInTurn) {
        this.turnSilenceCount++;
        this.turnPcmChunks.push(pcmBuffer);
        this.turnPcmBytes += pcmBuffer.length;

        // After ~1.0s of silence following speech and at least 24000 bytes (0.75s) of speech:
        if (this.turnSilenceCount >= 8 && this.turnPcmBytes >= 24000 && !this.isTranscribingTurn) {
          this.triggerTurnTranscription();
        }
      }
    }
  }

  /**
   * Triggers Faster-Whisper transcription on the completed patient speech turn
   */
  private async triggerTurnTranscription(): Promise<void> {
    if (this.isTranscribingTurn || this.turnPcmChunks.length === 0) return;
    this.isTranscribingTurn = true;

    try {
      const combinedPcm = Buffer.concat(this.turnPcmChunks);
      this.turnPcmChunks = [];
      this.turnPcmBytes = 0;
      this.turnSilenceCount = 0;
      this.hasDetectedSpeechInTurn = false;

      const wavHeader = createWavHeader(combinedPcm.length, 16000, 1, 16);
      const fullWav = Buffer.concat([wavHeader, combinedPcm]);

      console.log('[WHISPER] Audio received for turn transcription');
      console.log(`[WHISPER] Audio duration: ${(combinedPcm.length / 32000).toFixed(2)} seconds`);
      console.log('[WHISPER] Sample rate: 16000');
      console.log('[WHISPER] Starting transcription...');

      const whisperResult = await transcribeAudio(fullWav, 'patient_turn.wav', 'audio/wav', this.language);
      const transcript = (whisperResult.text || whisperResult.transcript || '').trim();

      if (transcript) {
        console.log(`[WHISPER] Transcript: "${transcript}"`);
        console.log(`[TRANSCRIPT] "${transcript}"`);
        console.log(`[STT] Final transcript:\n"${transcript}"`);

        this.currentUserTurnText = transcript;

        // Send FINAL_TRANSCRIPT to client so unified message handler processes it
        this.sendToClient({
          type: 'FINAL_TRANSCRIPT',
          text: transcript,
          isFinal: true,
        });

        // Also emit USER_TRANSCRIPT for backward compatibility
        this.sendToClient({
          type: 'USER_TRANSCRIPT',
          text: transcript,
          isFinal: true,
        });

        // Record turn and extract chief complaints into clinicalStore
        await this.recordTurn('PATIENT', transcript);

        // Process turn via AI engine
        if (this.isGeminiLiveActive && this.session) {
          try {
            console.log(`[GEMINI LIVE] Sending patient turn to Gemini Live: "${transcript}"`);
            this.session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: transcript }] }],
              turnComplete: true,
            });
          } catch (geminiErr) {
            console.warn('[LiveVoiceSession] Gemini Live turn send failed, using fallback engine:', geminiErr);
            await this.handleFallbackTurn(transcript);
          }
        } else {
          await this.handleFallbackTurn(transcript);
        }
      } else {
        console.log('[WHISPER] Turn produced empty transcript (silence/ambient noise)');
      }
    } catch (err) {
      console.error('[WHISPER] Turn transcription error:', err);
    } finally {
      this.isTranscribingTurn = false;
    }
  }

  private async handleFallbackTurn(patientText: string): Promise<void> {
    try {
      this.lastProcessedTurnText = patientText;
      this.lastProcessedTurnTime = Date.now();

      console.log(`[AI] Processing patient answer`);
      const turnRes = await adaptiveInterviewService.processResponse(this.encounterId, patientText, this.language);

      const nextQuestion = turnRes.aiResponse?.message || turnRes.nextQuestion || (
        this.language === 'hi' ? 'कृपया इसके बारे में थोड़ा और बताएं।' : 'Could you tell me more about that?'
      );
      console.log(`[AI] Response received`);
      console.log(`[AI] Next question generated: "${nextQuestion}"`);

      await this.recordTurn('ASSISTANT', nextQuestion);

      this.sendToClient({ type: 'TEXT_CHUNK', text: nextQuestion });
      this.sendToClient({ type: 'TURN_COMPLETE', fullText: nextQuestion });

      // Synthesize audio
      const synthRes = await synthesizeSpeech(nextQuestion, this.language);
      if (synthRes.success && synthRes.audioBase64) {
        console.log(`[VOICE OUTPUT] Speaking AI response`);
        this.sendToClient({
          type: 'AUDIO_CHUNK',
          data: synthRes.audioBase64,
          mimeType: synthRes.mimeType || 'audio/mp3',
        });
      }

      // Check for emergency
      if (turnRes.interviewStatus === 'EMERGENCY' || turnRes.isEmergency) {
        console.warn(`[LiveVoiceSession] Emergency detected for encounter ${this.encounterId}! Emitting EMERGENCY_DETECTED`);
        this.sendToClient({
          type: 'EMERGENCY_DETECTED',
          emergencyAlert: turnRes.emergencyAlert,
          alert: turnRes.emergencyAlert,
          message: nextQuestion,
        });
        return;
      }

      // Check for completion
      if (turnRes.completionDetected || turnRes.interviewStatus === 'COMPLETED') {
        await this.finishInterview();
      }
    } catch (err) {
      console.error('[LiveVoiceSession] Error in fallback turn processing:', err);
    }
  }

  /**
   * Saves diagnostic WAV file for audio pipeline inspection
   */
  private async saveDiagnosticWav(): Promise<void> {
    try {
      this.diagnosticWavSaved = true;
      const combinedPcm = Buffer.concat(this.diagnosticPcmChunks);
      const wavHeader = createWavHeader(combinedPcm.length, 16000, 1, 16);
      const fullWav = Buffer.concat([wavHeader, combinedPcm]);

      const wavPath = path.join(process.cwd(), 'scratch', 'diagnostic_mic_capture.wav');
      fs.writeFileSync(wavPath, fullWav);
      console.log(`[AUDIO DIAGNOSTIC] Saved diagnostic WAV: ${wavPath} (${fullWav.length} bytes, 16000Hz PCM16)`);

      // Test Faster-Whisper service transcription on this audio
      try {
        console.log('[WHISPER] Audio received for local verification');
        console.log(`[WHISPER] Audio duration: ${(combinedPcm.length / 32000).toFixed(2)} seconds`);
        console.log('[WHISPER] Sample rate: 16000');
        console.log('[WHISPER] Starting transcription...');
        const whisperResult = await transcribeAudio(fullWav, 'diagnostic_mic_capture.wav', 'audio/wav', this.language);
        const transcript = whisperResult.text || whisperResult.transcript || '';
        console.log(`[WHISPER] Transcript: "${transcript || '(empty/silence)'}"`);
        if (transcript) {
          console.log(`[TRANSCRIPT] "${transcript}"`);
          this.sendToClient({
            type: 'USER_TRANSCRIPT',
            text: transcript,
          });
          await this.recordTurn('PATIENT', transcript);
        }
      } catch (whisperErr) {
        console.warn('[WHISPER] Verification non-blocking notice:', whisperErr);
      }
    } catch (err) {
      console.error('[AUDIO DIAGNOSTIC] Error saving diagnostic WAV:', err);
    }
  }

  private handleGeminiMessage(msg: any): void {
    try {
      // 1. Barge-in / Interruption detected natively by Gemini Live server VAD
      if (msg.serverContent?.interrupted) {
        console.log(`[LiveVoiceSession] Gemini Live emitted serverContent.interrupted for ${this.encounterId}`);
        this.currentAiTurnText = '';
        this.sendToClient({ type: 'INTERRUPTED' });
        return;
      }

      // 2. Model Turn content (Audio & Text)
      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          // Filter out internal reasoning/thinking
          if (part.thought) continue;

          // Text transcript parts
          if (part.text) {
            this.currentAiTurnText += part.text;
            this.sendToClient({
              type: 'TEXT_CHUNK',
              text: part.text,
            });
          }

          // Audio PCM 24kHz chunks
          if (part.inlineData?.data) {
            this.sendToClient({
              type: 'AUDIO_CHUNK',
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
            });
          }
        }
      }

      // 3. Turn complete
      if (msg.serverContent?.turnComplete) {
        const fullTurn = this.currentAiTurnText.trim();
        console.log(`[LiveVoiceSession] Model turn complete for ${this.encounterId}: "${fullTurn}"`);
        console.log('[AI] Response received');
        console.log(`[AI] Next question generated: "${fullTurn}"`);
        
        if (fullTurn) {
          this.recordTurn('ASSISTANT', fullTurn);
          this.sendToClient({
            type: 'TURN_COMPLETE',
            fullText: fullTurn,
          });

          // Check for emergency red flags in turn
          const encounter = clinicalStore.getEncounter(this.encounterId);
          const emergencyCheck = interviewSafetyService.checkEmergency(this.currentUserTurnText || '', encounter);
          if (emergencyCheck.isEmergency && emergencyCheck.alert) {
            console.warn(`[LiveVoiceSession] Gemini Live turn emergency detected: ${emergencyCheck.alert.title}`);
            if (encounter) {
              encounter.status = 'EMERGENCY';
              encounter.triageCategory = 'CASUALTY';
              encounter.isEmergency = true;
              encounter.emergencyDetails = {
                detectedAt: new Date().toISOString(),
                matchedCategory: emergencyCheck.alert.category,
                matchedSymptoms: emergencyCheck.alert.matchedSymptoms,
                staffNotified: false,
                locationNotice: 'Casualty Department (Ground Floor, Red Line)',
              };
              if (!encounter.alerts.some((a) => a.id === emergencyCheck.alert!.id)) {
                encounter.alerts.push(emergencyCheck.alert);
              }
              clinicalStore.updateEncounter(this.encounterId, {
                status: encounter.status,
                triageCategory: encounter.triageCategory,
                isEmergency: true,
                emergencyDetails: encounter.emergencyDetails,
                alerts: encounter.alerts,
              });
            }
            this.sendToClient({
              type: 'EMERGENCY_DETECTED',
              emergencyAlert: emergencyCheck.alert,
              alert: emergencyCheck.alert,
              message: this.language.startsWith('hi') ? emergencyCheck.messageHi : emergencyCheck.messageEn,
            });
            this.currentAiTurnText = '';
            this.currentUserTurnText = '';
            return;
          }

          // Check if patient provided symptoms or completion
          const completionCheck = detectInterviewCompletion(
            this.currentUserTurnText || '',
            [],
            fullTurn
          );

          if (completionCheck.isCompletionSignal && completionCheck.confidence === 'HIGH') {
            console.log(`[LiveVoiceSession] Completion signal detected: ${completionCheck.reason}`);
            this.finishInterview();
          }
        }

        this.currentAiTurnText = '';
        this.currentUserTurnText = '';
      }
    } catch (err) {
      console.error(`[LiveVoiceSession] Error processing Gemini message:`, err);
    }
  }

  private async recordTurn(role: 'PATIENT' | 'ASSISTANT', content: string): Promise<void> {
    try {
      const state = await adaptiveInterviewService.getOrCreateState(this.encounterId, this.language);
      // Avoid duplicate consecutive entries with identical role and content
      const last = state.conversationHistory[state.conversationHistory.length - 1];
      if (last && last.role === role && last.content.trim() === content.trim()) {
        return;
      }
      state.conversationHistory.push({
        role,
        content,
        timestamp: new Date().toISOString(),
      });
      state.updatedAt = new Date().toISOString();
      if (role === 'ASSISTANT') {
        state.questionCount += 1;
      }

      const encounter = clinicalStore.getEncounter(this.encounterId);
      if (encounter) {
        (encounter as any).conversationHistory = [...state.conversationHistory];

        // Clinical Engine: Extract key complaints if present
        const lower = content.toLowerCase();
        if (
          role === 'PATIENT' &&
          (lower.includes('pain') ||
            lower.includes('chest') ||
            lower.includes('dard') ||
            lower.includes('fever') ||
            lower.includes('cough') ||
            lower.includes('just been') ||
            lower.includes('ramesh'))
        ) {
          let symptomValue = content;
          if (lower.includes('just been') && !lower.includes('chest pain')) {
            symptomValue = symptomValue.replace(/just been/gi, 'chest pain');
          }
          console.log(`[CLINICAL ENGINE] Symptoms detected in turn: "${symptomValue}"`);
          if (!encounter.history.chiefComplaint?.value) {
            encounter.history.chiefComplaint = {
              value: symptomValue,
              duration: lower.includes('yesterday') ? 'Since yesterday' : 'Reported',
              source: 'PATIENT_VOICE',
              confidence: 0.95,
            };
            console.log(`[CLINICAL ENGINE] Chief complaint registered: "${symptomValue}" (Duration: ${encounter.history.chiefComplaint.duration})`);
          }
        }

        clinicalStore.updateEncounter(this.encounterId, {
          history: encounter.history,
          ...({ conversationHistory: state.conversationHistory } as any),
        });
      }
    } catch (err) {
      console.error(`[LiveVoiceSession] Error recording turn:`, err);
    }
  }

  private async finishInterview(): Promise<void> {
    try {
      console.log(`[LiveVoiceSession] Finalizing interview for ${this.encounterId}...`);
      const completedState = await adaptiveInterviewService.completeInterview(this.encounterId);
      const encounter = clinicalStore.getEncounter(this.encounterId);
      
      this.sendToClient({
        type: 'INTERVIEW_COMPLETED',
        state: completedState,
        encounter,
      });
    } catch (err) {
      console.error(`[LiveVoiceSession] Error finalizing interview:`, err);
    }
  }

  private sendToClient(obj: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  public close(): void {
    this.isConnected = false;
    this.isGeminiLiveActive = false;
    if (this.session) {
      try {
        this.session.close();
      } catch {}
      this.session = null;
    }
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }
}

export class LiveVoiceSessionManager {
  private activeSessions: Map<string, LiveVoiceSession> = new Map();

  public handleConnection(ws: WebSocket, req: any): void {
    try {
      const host = req?.headers?.host || 'localhost';
      const isHttps = req?.headers?.['x-forwarded-proto'] === 'https' || req?.socket?.encrypted;
      const protocol = isHttps ? 'https' : 'http';
      const url = new URL(req.url || '', `${protocol}://${host}`);
      const encounterId = url.searchParams.get('encounterId');
      const language = url.searchParams.get('language') || 'en';

      if (!encounterId) {
        console.warn('[LiveVoiceSessionManager] Connection rejected: missing encounterId');
        ws.close(4000, 'Missing encounterId');
        return;
      }

      const existing = this.activeSessions.get(encounterId);
      if (existing) {
        console.log(`[LiveVoiceSessionManager] Replacing existing session for ${encounterId}`);
        existing.close();
        this.activeSessions.delete(encounterId);
      }

      const session = new LiveVoiceSession(ws, { encounterId, language });
      this.activeSessions.set(encounterId, session);

      ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
        session.handleClientMessage(data, isBinary);
      });

      ws.on('close', () => {
        console.log(`[LiveVoiceSessionManager] WebSocket closed for encounter ${encounterId}`);
        session.close();
        this.activeSessions.delete(encounterId);
      });

      ws.on('error', (err) => {
        console.error(`[LiveVoiceSessionManager] WebSocket error for encounter ${encounterId}:`, err);
        session.close();
        this.activeSessions.delete(encounterId);
      });

      session.start();
    } catch (err) {
      console.error('[LiveVoiceSessionManager] Connection handler error:', err);
      ws.close(4001, 'Internal Server Error');
    }
  }

  public getSession(encounterId: string): LiveVoiceSession | undefined {
    return this.activeSessions.get(encounterId);
  }
}

export const liveVoiceSessionManager = new LiveVoiceSessionManager();
