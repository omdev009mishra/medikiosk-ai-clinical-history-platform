import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Send,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Keyboard,
  Activity,
  Bell,
  HeartPulse,
  MapPin,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { ClinicalEncounter, LanguageCode, InterviewState } from '../../types/client';
import { api } from '../../services/api';
import { LiveVoiceClient, LiveVoiceState, DetailedVoiceState } from '../../services/liveVoiceClient';

export type VoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'patient-speaking'
  | 'speaking'
  | 'processing'
  | 'error'
  | 'paused'
  | 'completed';

export interface InterviewOption {
  id: string;
  label: string;
  value: string;
}

export interface ChatMessage {
  role: 'PATIENT' | 'ASSISTANT';
  content: string;
  timestamp?: string;
}

interface InterviewStepProps {
  encounter?: ClinicalEncounter | null;
  language: LanguageCode;
  onStateUpdated: (updatedEncounter: ClinicalEncounter) => void;
  onNext: () => void;
}

export const InterviewStep: React.FC<InterviewStepProps> = ({
  encounter,
  language,
  onStateUpdated,
  onNext,
}) => {
  const isHindi = language === 'hi';

  const [interviewState, setInterviewState] = useState<InterviewState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestionStr, setCurrentQuestionStr] = useState<string>('');
  const [currentOptions, setCurrentOptions] = useState<InterviewOption[]>([]);
  const [textInput, setTextInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);

  // Live Voice State & Volume
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [detailedState, setDetailedState] = useState<DetailedVoiceState>('IDLE');
  const [liveVolume, setLiveVolume] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectedVoiceLang, setSelectedVoiceLang] = useState<'auto' | 'hi' | 'en' | 'hinglish'>(isHindi ? 'hi' : 'auto');

  // Emergency Routing State
  const [emergencyData, setEmergencyData] = useState<{
    detected: boolean;
    alert?: any;
    message?: string;
    staffNotified?: boolean;
    notifyingStaff?: boolean;
  } | null>(() => {
    if (encounter?.isEmergency || encounter?.status === 'EMERGENCY' || encounter?.triageCategory === 'CASUALTY' || encounter?.triageCategory === 'EMERGENCY') {
      return {
        detected: true,
        alert: encounter.alerts?.find((a) => a.severity === 'CRITICAL') || encounter.alerts?.[0],
        message: encounter.emergencyDetails?.matchedCategory
          ? (isHindi
              ? 'आपके बताए गए लक्षणों के आधार पर, हम तुरंत कैजुअल्टी चिकित्सा सहायता लेने की सलाह देते हैं।'
              : "Based on what you've shared, prompt medical evaluation is advised. Please proceed to the Casualty desk.")
          : undefined,
        staffNotified: encounter.emergencyDetails?.staffNotified || false,
      };
    }
    return null;
  });

  // References
  const liveVoiceClientRef = useRef<LiveVoiceClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const partialAiTextRef = useRef<string>('');
  const isProcessingRef = useRef<boolean>(false);
  const conversationLockedRef = useRef<boolean>(false);
  const lastSubmittedTranscriptRef = useRef<string>('');
  const lastSubmittedTimeRef = useRef<number>(0);
  const processPatientMessageRef = useRef<((msg: string, source: 'text' | 'voice') => Promise<void>) | null>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentQuestionStr]);

  // Handle Full-Duplex Voice Engine Initialization
  const initLiveVoiceSession = useCallback(async () => {
    if (!encounter?.id) return;

    if (liveVoiceClientRef.current) {
      liveVoiceClientRef.current.disconnect();
      liveVoiceClientRef.current = null;
    }

    setVoiceState('connecting');
    setDetailedState('MIC_PERMISSION_REQUESTED');
    setSpeechNotice(
      isHindi
        ? '⚡ जेमिनी लाइव वॉयस इंजन से कनेक्ट हो रहा है...'
        : '⚡ Connecting to Gemini Live Real-Time Voice Engine...'
    );

    const client = new LiveVoiceClient({
      onStateChange: (liveState: LiveVoiceState, detailed?: DetailedVoiceState) => {
        if (detailed) setDetailedState(detailed);

        if (liveState === 'medikiosk-speaking') {
          setVoiceState('speaking');
          setSpeechNotice(
            isHindi
              ? '🔊 मेडीकियोस्क बोल रहा है (रोकने के लिए टोकें या माइक दबाएं)'
              : '🔊 MediKiosk is speaking (speak anytime to interrupt)'
          );
        } else if (liveState === 'patient-speaking') {
          setVoiceState('patient-speaking');
          setSpeechNotice(
            isHindi
              ? '🗣️ आपकी आवाज सुन रहे हैं...'
              : '🗣️ Hearing you speak...'
          );
        } else if (liveState === 'listening') {
          setVoiceState('listening');
          setSpeechNotice(
            isHindi
              ? '🎤 सुन रहे हैं... स्वाभाविक रूप से बोलें'
              : '🎤 Listening... Speak naturally whenever ready'
          );
        } else if (liveState === 'connecting') {
          setVoiceState('connecting');
        } else if (liveState === 'completed') {
          setVoiceState('completed');
          setIsCompleted(true);
        } else if (liveState === 'error') {
          setVoiceState('error');
        } else {
          setVoiceState('idle');
        }
      },

      onVolumeChange: (vol: number) => {
        setLiveVolume(vol);
      },

      onAiTextChunk: (chunk: string) => {
        partialAiTextRef.current += chunk;
        setCurrentQuestionStr(partialAiTextRef.current);
      },

      onAiTurnComplete: (fullText: string) => {
        console.log('[InterviewStep] AI Turn complete:', fullText);
        console.log('[AI] Response received');
        console.log('[AI] Next question generated:', fullText);
        partialAiTextRef.current = '';
        setCurrentQuestionStr(fullText);

        isProcessingRef.current = false;
        setSubmitting(false);

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'ASSISTANT' && last.content.trim() === fullText.trim()) {
            return prev;
          }
          return [
            ...prev,
            { role: 'ASSISTANT', content: fullText.trim(), timestamp: new Date().toISOString() },
          ];
        });
      },

      onFinalTranscript: (transcript: string) => {
        if (!transcript.trim()) return;
        console.log('[VOICE] Sending final transcript to unified message handler');
        processPatientMessageRef.current?.(transcript, 'voice');
      },

      onPartialTranscript: (partial: string) => {
        if (!partial.trim()) return;
        setSpeechNotice(partial);
      },

      onUserTranscript: (transcript: string) => {
        if (!transcript.trim()) return;
        if (!isProcessingRef.current) {
          console.log('[VOICE] Sending final transcript to unified message handler');
          processPatientMessageRef.current?.(transcript, 'voice');
        }
      },

      onInterrupted: () => {
        console.log('[InterviewStep] Instant Barge-in triggered!');
        partialAiTextRef.current = '';
        setVoiceState('patient-speaking');
        setDetailedState('INTERRUPTED');
        setSpeechNotice(
          isHindi ? '⚡ आपने बीच में टोक दिया — आप बोल सकते हैं' : '⚡ Interrupted — listening to you now'
        );
      },

      onInterviewCompleted: async (data: any) => {
        console.log('[InterviewStep] Interview completed:', data);
        setIsCompleted(true);
        setVoiceState('completed');
        setDetailedState('COMPLETED');
        setSpeechNotice(
          isHindi ? '✅ साक्षात्कार संपन्न हुआ। धन्यवाद।' : '✅ Clinical intake completed. Thank you.'
        );
        if (encounter?.id) {
          try {
            const encRes = await api.getEncounter(encounter.id);
            if (encRes.success && encRes.data?.encounter) {
              onStateUpdated(encRes.data.encounter);
            }
          } catch (e) {
            console.warn('[InterviewStep] onInterviewCompleted encounter fetch notice:', e);
          }
        }
      },

      onEmergencyDetected: async (data: any) => {
        console.warn('[InterviewStep] EMERGENCY_DETECTED event from live voice:', data);
        setEmergencyData({
          detected: true,
          alert: data.emergencyAlert || data.alert,
          message: data.message,
          staffNotified: false,
        });
        setVoiceState('completed');
        setDetailedState('COMPLETED');
        setSpeechNotice(
          isHindi
            ? 'कैजुअल्टी प्राथमिकता: कृपया शांत रहें और कैजुअल्टी डेस्क पर जाएं'
            : 'Casualty referral noted — please proceed to the Casualty desk'
        );
        if (encounter?.id) {
          try {
            const encRes = await api.getEncounter(encounter.id);
            if (encRes.success && encRes.data?.encounter) {
              onStateUpdated(encRes.data.encounter);
            }
          } catch (e) {
            console.warn('[InterviewStep] onEmergencyDetected encounter refresh notice:', e);
          }
        }
      },

      onError: (err: string) => {
        console.error('[InterviewStep] Voice error:', err);
        setVoiceState('error');
        setDetailedState('ERROR');
        setSpeechNotice(
          err || (isHindi ? 'वॉयस कनेक्शन त्रुटि। कृपया पुनः प्रयास करें।' : 'Voice connection error. Please retry.')
        );
      },
    });

    liveVoiceClientRef.current = client;

    try {
      const langParam = selectedVoiceLang === 'auto' ? language : selectedVoiceLang;
      await client.connect(encounter.id, langParam);
    } catch (err: any) {
      console.error('[InterviewStep] Connect error:', err);
      setVoiceState('error');
      setDetailedState('ERROR');
      setSpeechNotice(err.message || 'Failed to connect to live voice session');
    }
  }, [encounter?.id, language, selectedVoiceLang, isHindi, onStateUpdated]);

  // Initialize on mount
  useEffect(() => {
    if (encounter?.id) {
      initLiveVoiceSession();
    }

    return () => {
      if (liveVoiceClientRef.current) {
        liveVoiceClientRef.current.disconnect();
        liveVoiceClientRef.current = null;
      }
    };
  }, [encounter?.id, initLiveVoiceSession]);

  // Handle Primary Microphone Button:
  // - If MediKiosk is speaking: trigger immediate barge-in!
  // - If error: reconnect
  // - If listening: reassure user mic is active (NEVER accidentally mute!)
  const handleMicButtonClick = () => {
    if (!liveVoiceClientRef.current) {
      initLiveVoiceSession();
      return;
    }

    if (voiceState === 'speaking') {
      // Instant Barge-In
      liveVoiceClientRef.current.handleBargeIn();
    } else if (voiceState === 'error') {
      initLiveVoiceSession();
    } else if (isMuted) {
      // Unmute if muted
      setIsMuted(false);
      liveVoiceClientRef.current.setMuted(false);
      setSpeechNotice(isHindi ? '🎤 माइक्रोफ़ोन सक्रिय' : '🎤 Microphone active');
    } else {
      // Keep mic actively listening
      setSpeechNotice(isHindi ? '🎤 माइक सक्रिय है, अपनी परेशानी बताएं' : '🎤 Microphone active — speak freely');
    }
  };

  // Dedicated Mute Toggle (Only triggered if user explicitly chooses privacy)
  const toggleMute = () => {
    if (!liveVoiceClientRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    liveVoiceClientRef.current.setMuted(next);
    setSpeechNotice(
      next
        ? isHindi ? '🔇 माइक्रोफ़ोन म्यूट किया गया' : '🔇 Microphone muted'
        : isHindi ? '🎤 माइक्रोफ़ोन सक्रिय' : '🎤 Microphone active'
    );
  };

  // Unified Patient Message Handler (Authoritative pipeline for both Voice and Text)
  const processPatientMessage = async (message: string, source: 'text' | 'voice') => {
    const cleanMessage = (message || '').trim();
    if (!cleanMessage) return;

    // Step 6: Log before submission
    if (source === 'voice') {
      console.log('[VOICE] Final transcript received:', cleanMessage);
      console.log('[VOICE] Attempting unified message submission');
      console.log('[VOICE] isProcessing:', isProcessingRef.current);
      console.log('[VOICE] isSpeaking:', voiceState === 'speaking');
      console.log('[VOICE] isListening:', voiceState === 'listening');
      console.log('[VOICE] conversationLocked:', conversationLockedRef.current);
    }

    if (isProcessingRef.current) {
      console.warn(`[${source.toUpperCase()}] Submission rejected: already processing previous message`);
      return;
    }
    if (conversationLockedRef.current) {
      console.warn(`[${source.toUpperCase()}] Submission rejected: conversation is currently locked`);
      return;
    }

    // Debounce duplicate utterances within 3 seconds
    const now = Date.now();
    if (
      lastSubmittedTranscriptRef.current === cleanMessage &&
      now - lastSubmittedTimeRef.current < 3000
    ) {
      console.log(`[${source.toUpperCase()}] Ignoring duplicate message within debounce window: "${cleanMessage}"`);
      return;
    }
    lastSubmittedTranscriptRef.current = cleanMessage;
    lastSubmittedTimeRef.current = now;

    // Step 8: Required logs in exact order
    console.log(`[CONVERSATION] Patient message received\nSource: ${source}`);
    console.log('[CONVERSATION] Updating clinical context');
    console.log('[AI] Processing patient answer');

    // Acquire lock and transition state
    isProcessingRef.current = true;
    setSubmitting(true);
    setVoiceState('processing');
    setDetailedState('PROCESSING_MESSAGE');
    setSpeechNotice(isHindi ? '🤔 समझ रहे हैं...' : '🤔 Understanding...');

    // Step 9: Add patient message ONCE to UI history
    setMessages((prev) => [
      ...prev,
      { role: 'PATIENT', content: cleanMessage, timestamp: new Date().toISOString() },
    ]);

    if (source === 'text') {
      setTextInput('');
    }

    try {
      if (liveVoiceClientRef.current) {
        liveVoiceClientRef.current.sendTextMessage(cleanMessage);
      } else if (encounter?.id) {
        const langParam = selectedVoiceLang === 'auto' ? language : selectedVoiceLang;
        const res = await api.respondAdaptiveInterview(encounter.id, cleanMessage, langParam);
        if (res.success && res.data) {
          setInterviewState(res.data);
          const aiMsg = res.data.aiResponse?.message || res.data.nextQuestion;
          if (aiMsg) {
            console.log('[AI] Response received');
            console.log('[AI] Next question generated:', aiMsg);
            setCurrentQuestionStr(aiMsg);
            setMessages((prev) => [
              ...prev,
              { role: 'ASSISTANT', content: aiMsg, timestamp: new Date().toISOString() },
            ]);
          }
          if (res.data.interviewStatus === 'EMERGENCY' || res.data.isEmergency || res.data.emergencyAlert) {
            console.warn('[InterviewStep] Emergency detected in REST response:', res.data);
            setEmergencyData({
              detected: true,
              alert: res.data.emergencyAlert,
              message: aiMsg,
              staffNotified: false,
            });
            setVoiceState('completed');
            setDetailedState('COMPLETED');
            setSpeechNotice(
              isHindi
                ? 'कैजुअल्टी प्राथमिकता: कृपया शांत रहें और कैजुअल्टी डेस्क पर जाएं'
                : 'Casualty referral noted — please proceed to the Casualty desk'
            );
          }
        }
        isProcessingRef.current = false;
        setSubmitting(false);
        setVoiceState('listening');
        setDetailedState('MIC_ACTIVE');
      }
    } catch (error) {
      console.error('[VOICE CONVERSATION ERROR]', error);
      isProcessingRef.current = false;
      setSubmitting(false);
      setVoiceState('listening');
      setDetailedState('MIC_ACTIVE');
    }
  };

  // Step 7: Update ref on every render to eliminate stale closure bugs in async voice callbacks
  processPatientMessageRef.current = processPatientMessage;

  // Submit Typed Text Answer (Fallback or Accessibility)
  const handleSendTypedAnswer = (textToSend?: string) => {
    const raw = (textToSend !== undefined ? textToSend : textInput).trim();
    if (!raw) return;

    console.log('[TEXT INPUT] Submit triggered');
    console.log('[TEXT INPUT] Calling unified message handler');
    processPatientMessage(raw, 'text');
  };

  // Emergency Staff Alert Action
  const handleNotifyStaff = async () => {
    if (!encounter?.id || emergencyData?.notifyingStaff) return;
    setEmergencyData((prev) => (prev ? { ...prev, notifyingStaff: true } : null));
    try {
      const res = await api.notifyCasualtyStaff(
        encounter.id,
        `Patient triggered casualty assistance at Kiosk: ${emergencyData?.alert?.title || 'Casualty Referral Symptoms'}`
      );
      if (res.success) {
        setEmergencyData((prev) => (prev ? { ...prev, staffNotified: true, notifyingStaff: false } : null));
      } else {
        setEmergencyData((prev) => (prev ? { ...prev, notifyingStaff: false } : null));
      }
    } catch (err) {
      console.error('Failed to notify staff:', err);
      setEmergencyData((prev) => (prev ? { ...prev, notifyingStaff: false } : null));
    }
  };

  // Immediate Transfer to Casualty Route
  const handleProceedEmergency = async () => {
    if (!encounter?.id) {
      onNext();
      return;
    }
    try {
      await api.escalateCasualty(encounter.id, emergencyData?.alert?.category || 'CASUALTY');
      const encRes = await api.getEncounter(encounter.id);
      if (encRes.success && encRes.data?.encounter) {
        onStateUpdated(encRes.data.encounter);
      }
    } catch (e) {
      console.warn('Error escalating casualty:', e);
    }
    onNext();
  };

  // Return to Standard Conversation
  const handleDismissEmergency = () => {
    setEmergencyData(null);
    setVoiceState('listening');
    setDetailedState('MIC_ACTIVE');
    setSpeechNotice(isHindi ? '🎤 माइक सक्रिय है, अपनी परेशानी बताएं' : '🎤 Microphone active — speak freely');
  };

  // Finalize / Complete Interview
  const handleConfirmCompletion = async () => {
    if (!encounter?.id || isFinishing) return;
    setIsFinishing(true);
    setVoiceState('processing');
    setSpeechNotice(isHindi ? 'साक्षात्कार समाप्त किया जा रहा है...' : 'Completing intake...');

    try {
      // 1. Cleanly disconnect live voice client & mic tracks
      if (liveVoiceClientRef.current) {
        try {
          liveVoiceClientRef.current.completeInterview();
        } catch (e) {
          console.warn('[InterviewStep] WS completeInterview error:', e);
        }
        try {
          liveVoiceClientRef.current.disconnect();
        } catch (e) {
          console.warn('[InterviewStep] WS disconnect error:', e);
        }
        liveVoiceClientRef.current = null;
      }

      // 2. Authoritative REST call to finalize interview and structure data
      const res = await api.completeAdaptiveInterview(encounter.id);
      if (res.success && res.data) {
        setInterviewState(res.data.state || res.data);
      }

      // 3. Fetch full updated clinical encounter
      try {
        const encRes = await api.getEncounter(encounter.id);
        if (encRes.success && encRes.data?.encounter) {
          onStateUpdated(encRes.data.encounter);
        }
      } catch (err) {
        console.warn('[InterviewStep] Error refreshing encounter after completion:', err);
      }

      setIsCompleted(true);
      setVoiceState('completed');

      // 4. Advance immediately to Step 5 (Document Upload)
      onNext();
    } catch (err) {
      console.error('[InterviewStep] Error completing interview:', err);
      // Fallback: still advance so the patient is never stuck
      onNext();
    } finally {
      setIsFinishing(false);
      setSubmitting(false);
    }
  };

  if (!encounter?.id) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
        <p className="text-sm font-bold text-slate-700">
          {isHindi ? 'क्लिनिकल साक्षात्कार लोड हो रहा है...' : 'Initializing clinical interview encounter...'}
        </p>
      </div>
    );
  }

  const conversationList =
    messages.length > 0
      ? messages
      : interviewState?.conversationHistory ||
        (interviewState as any)?.state?.conversationHistory ||
        [];

  const safetyFlagsList =
    interviewState?.safetyFlags ||
    (interviewState as any)?.state?.safetyFlags ||
    [];

  const lastPatientMsg = [...conversationList].reverse().find((m) => m.role === 'PATIENT');
  const activeQuestion =
    currentQuestionStr ||
    [...conversationList].reverse().find((m) => m.role === 'ASSISTANT')?.content ||
    (isHindi
      ? 'नमस्ते! मेडीकियोस्क में आपका स्वागत है। आज आपको क्या परेशानी या लक्षण महसूस हो रहे हैं?'
      : 'Hello! Welcome to MediKiosk. What symptoms or health concerns are you experiencing today?');

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-2 flex flex-col items-center space-y-6 animate-in fade-in duration-300">
      {/* 1. Priority Red Flag Alert Banner */}
      {safetyFlagsList.length > 0 && (
        <div className="w-full p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 shadow-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="font-bold text-rose-900 block">
              {isHindi ? 'आपातकालीन क्लिनिकल संकेत दर्ज' : 'Priority Clinical Signals Noted'}
            </strong>
            <span className="text-rose-800/90 font-medium">
              {isHindi
                ? 'आपके लक्षणों में प्राथमिकता संकेत पाए गए हैं। डॉक्टर को त्वरित सूचना भेज दी गई है।'
                : 'Your symptoms contain priority indicators that have been highlighted for the attending physician.'}
            </span>
          </div>
        </div>
      )}

      {/* 2. Top Voice Controls (Language pill & Detailed Pipeline Badge) */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Language selector pill */}
        <div className="flex items-center bg-white border border-slate-200/80 p-1 rounded-xl shadow-2xs">
          {(['auto', 'hi', 'hinglish', 'en'] as const).map((langKey) => (
            <button
              key={langKey}
              type="button"
              onClick={() => {
                setSelectedVoiceLang(langKey);
                setTimeout(initLiveVoiceSession, 50);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                selectedVoiceLang === langKey
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {langKey === 'auto' ? '🌐 Auto' : langKey === 'hi' ? 'हिंदी' : langKey === 'hinglish' ? 'Hinglish' : 'English'}
            </button>
          ))}
        </div>

        {/* Live Audio Level & Pipeline Status Pill */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200/80 text-teal-900 text-xs font-bold shadow-2xs">
          <span className={`w-2.5 h-2.5 rounded-full ${
            voiceState === 'connecting'
              ? 'bg-amber-500 animate-ping'
              : voiceState === 'speaking'
              ? 'bg-cyan-500 animate-pulse'
              : voiceState === 'patient-speaking'
              ? 'bg-emerald-500 animate-ping'
              : 'bg-teal-600 animate-pulse'
          }`} />
          <span className="tracking-wide">
            {voiceState === 'connecting'
              ? (isHindi ? 'कनेक्ट हो रहा है...' : 'Connecting...')
              : (isHindi ? 'जेमिनी लाइव वॉयस' : 'Gemini Live Full-Duplex')}
          </span>

          {/* Live Mic Level Meter (Visual proof that mic audio is active) */}
          <div className="flex items-center gap-1 pl-1.5 border-l border-teal-200">
            <Activity className="w-3 h-3 text-teal-600" />
            <div className="w-12 h-2 bg-teal-200/70 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 transition-all duration-75 rounded-full"
                style={{ width: `${Math.min(100, Math.round(liveVolume * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2.5 Casualty Guidance Card (Triggered if red flags detected) */}
      {emergencyData?.detected ? (
        <div className="w-full bg-white rounded-3xl border border-rose-200 p-6 sm:p-9 shadow-sm space-y-6 text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-2xs">
            <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {isHindi ? 'कैजुअल्टी प्राथमिकता' : 'Casualty Priority'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isHindi ? 'कैजुअल्टी परामर्श की सलाह' : 'Prompt Medical Attention Advised'}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium max-w-xl mx-auto leading-relaxed">
              {emergencyData.message || (isHindi
                ? 'आपके द्वारा बताए गए लक्षणों के आधार पर, हम अनुशंसा करते हैं कि एक डॉक्टर तुरंत आपकी जांच करें। कृपया शांत रहें, हमारी मेडिकल टीम आपकी सहायता करेगी।'
                : "Based on what you've described, our clinical protocol advises that a physician examine you promptly. Please remain calm — our medical staff is being alerted.")}
            </p>
          </div>

          {/* Calm Guidance Checklist */}
          <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-5 text-left space-y-3.5 max-w-xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div>
                <strong className="text-sm font-bold text-slate-900 block">
                  {isHindi ? 'कृपया आराम से बैठें' : 'Please remain seated and calm'}
                </strong>
                <span className="text-xs text-slate-600 font-medium">
                  {isHindi ? 'अपने साथ किसी परिजन या कियोस्क सहायक को साथ रखें।' : 'Stay seated. Ask a family member or attendant to remain with you.'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div>
                <strong className="text-sm font-bold text-slate-900 block">
                  {isHindi ? 'अस्पताल स्टाफ को सूचित करें' : 'Alert on-duty clinical team'}
                </strong>
                <span className="text-xs text-slate-600 font-medium">
                  {emergencyData.staffNotified
                    ? (isHindi ? '✓ ऑन-ड्यूटी नर्सिंग स्टाफ को सूचित कर दिया गया है। वे आपकी ओर आ रहे हैं।' : '✓ On-duty nursing team notified. An attendant is on the way.')
                    : (isHindi ? 'नीचे दिए गए बटन को दबाकर तुरंत निकटतम नर्स/अटेंडेंट को बुलाएं।' : 'Click the button below to sound a direct alert for the on-duty triage nurse.')}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <div>
                <strong className="text-sm font-bold text-slate-900 block">
                  {isHindi ? 'कैजुअल्टी डेस्क स्थान' : 'Casualty Desk Location'}
                </strong>
                <span className="text-xs text-rose-900 font-bold flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  {isHindi ? 'भूतल (Ground Floor) - लाल पट्टी (Red Floor Line) का अनुसरण करें — कैजुअल्टी डेस्क' : 'Ground Floor — Follow Red Line to Casualty Desk'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xl mx-auto pt-2">
            {/* Notify Staff Button */}
            <button
              type="button"
              onClick={handleNotifyStaff}
              disabled={emergencyData.staffNotified || emergencyData.notifyingStaff}
              className={`w-full sm:w-auto flex-1 py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                emergencyData.staffNotified
                  ? 'bg-emerald-700 text-white'
                  : 'bg-rose-700 hover:bg-rose-800 text-white shadow-sm'
              }`}
            >
              {emergencyData.notifyingStaff ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isHindi ? 'स्टाफ को सूचित किया जा रहा है...' : 'Alerting Hospital Staff...'}</span>
                </>
              ) : emergencyData.staffNotified ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>{isHindi ? '✓ अस्पताल स्टाफ को सूचित किया गया' : '✓ Hospital Staff Alerted'}</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>{isHindi ? 'अस्पताल स्टाफ को सूचित करें' : 'Notify Hospital Staff'}</span>
                </>
              )}
            </button>

            {/* Proceed to Casualty Desk */}
            <button
              type="button"
              onClick={handleProceedEmergency}
              className="w-full sm:w-auto flex-1 py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isHindi ? 'कैजुअल्टी डेस्क पर जाएं' : 'Proceed to Casualty Desk'}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Gentle Dismiss Option */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDismissEmergency}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-4 cursor-pointer"
            >
              {isHindi ? 'मैं ठीक महसूस कर रहा हूँ — सामान्य बातचीत जारी रखें' : 'I am feeling okay — continue standard conversation'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 3. Centerpiece Real-Time AI Voice Orb Stage */}
          {!isCompleted && (
            <div className="flex flex-col items-center justify-center my-4 relative">
              {/* Conversational Status Feedback Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                {voiceState === 'listening' && (
                  <span className="text-teal-800 bg-teal-50 border border-teal-200/80 px-3.5 py-1 rounded-full flex items-center gap-1.5 font-bold text-xs shadow-2xs">
                    <Mic className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                    <span>{isHindi ? 'सुन रहे हैं... आराम से बताएं' : "I'm listening... Speak naturally at your pace"}</span>
                  </span>
                )}
                {voiceState === 'patient-speaking' && (
                  <span className="text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3.5 py-1 rounded-full flex items-center gap-1.5 font-bold text-xs shadow-2xs">
                    <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    <span>{isHindi ? 'आपकी आवाज सुन रहे हैं...' : 'Hearing your voice... Take your time'}</span>
                  </span>
                )}
                {voiceState === 'processing' && (
                  <span className="text-blue-800 bg-blue-50 border border-blue-200/80 px-3.5 py-1 rounded-full flex items-center gap-1.5 font-bold text-xs shadow-2xs animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                    <span>{isHindi ? 'आपके उत्तर को समझ रहे हैं...' : "I'm understanding your response..."}</span>
                  </span>
                )}
                {voiceState === 'speaking' && (
                  <span className="text-cyan-800 bg-cyan-50 border border-cyan-200/80 px-3.5 py-1 rounded-full flex items-center gap-1.5 font-bold text-xs shadow-2xs">
                    <Volume2 className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
                    <span>{isHindi ? 'मेडीकियोस्क बोल रहा है (टोक सकते हैं)' : 'MediKiosk is speaking (speak to interrupt)'}</span>
                  </span>
                )}
                {conversationList.length >= 4 && (
                  <span className="text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full flex items-center gap-1 font-semibold text-[11px]">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{isHindi ? 'बस कुछ ही और सवाल बाकी हैं' : 'Almost finished — just a few more questions'}</span>
                  </span>
                )}
              </div>

              {/* Concentric Sonic Rings driven by live audio volume */}
              {(voiceState === 'listening' || voiceState === 'patient-speaking') && (
                <>
                  <div
                    className="absolute rounded-full bg-teal-400/20 animate-pulse-ring pointer-events-none transition-all duration-100"
                    style={{
                      width: `${176 + liveVolume * 70}px`,
                      height: `${176 + liveVolume * 70}px`,
                    }}
                  />
                  <div
                    className="absolute rounded-full bg-teal-500/10 animate-pulse-ring [animation-delay:0.8s] pointer-events-none transition-all duration-100"
                    style={{
                      width: `${224 + liveVolume * 90}px`,
                      height: `${224 + liveVolume * 90}px`,
                    }}
                  />
                </>
              )}

              {voiceState === 'speaking' && (
                <div
                  className="absolute rounded-full bg-cyan-400/20 animate-pulse-ring pointer-events-none transition-all duration-100"
                  style={{
                    width: `${192 + liveVolume * 80}px`,
                    height: `${192 + liveVolume * 80}px`,
                  }}
                />
              )}

              {/* The AI Orb */}
              <div
                onClick={handleMicButtonClick}
                role="button"
                tabIndex={0}
                title={voiceState === 'speaking' ? 'Click to interrupt' : 'Microphone is active'}
                className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center text-white cursor-pointer select-none transition-all duration-300 z-10 ${
                  voiceState === 'connecting'
                    ? 'bg-gradient-to-tr from-slate-700 via-teal-800 to-slate-800 shadow-md animate-pulse'
                    : voiceState === 'patient-speaking'
                    ? 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-teal-400 scale-105 shadow-2xl shadow-emerald-600/40 ring-4 ring-emerald-300/40'
                    : voiceState === 'speaking'
                    ? 'bg-gradient-to-tr from-teal-700 via-cyan-600 to-blue-500 animate-ai-speaking shadow-xl shadow-cyan-600/30'
                    : isMuted
                    ? 'bg-gradient-to-tr from-slate-600 via-rose-700 to-slate-700 shadow-md ring-4 ring-rose-300/40'
                    : 'bg-gradient-to-tr from-teal-700 via-teal-500 to-emerald-400 animate-ai-listening shadow-xl shadow-teal-600/30'
                }`}
              >
                {/* Orb Inner Graphic */}
                {voiceState === 'connecting' ? (
                  <Loader2 className="w-10 h-10 animate-spin text-teal-200" />
                ) : voiceState === 'patient-speaking' ? (
                  /* Reactive Sound Equalizer Wave */
                  <div className="flex items-center gap-1.5 h-8">
                    <span className="w-1.5 bg-white rounded-full animate-sound-wave-1" />
                    <span className="w-1.5 bg-white rounded-full animate-sound-wave-2" />
                    <span className="w-1.5 bg-white rounded-full animate-sound-wave-3" />
                    <span className="w-1.5 bg-white rounded-full animate-sound-wave-4" />
                    <span className="w-1.5 bg-white rounded-full animate-sound-wave-5" />
                  </div>
                ) : voiceState === 'speaking' ? (
                  <Volume2 className="w-10 h-10 animate-pulse text-cyan-100" />
                ) : isMuted ? (
                  <MicOff className="w-10 h-10 text-rose-200" />
                ) : (
                  <Mic className="w-10 h-10 text-white animate-pulse" />
                )}
              </div>

              {/* Voice State Status Text */}
              <div className="text-center mt-5 space-y-1">
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  {voiceState === 'connecting'
                    ? (isHindi ? 'माइक्रोफ़ोन कनेक्ट हो रहा है...' : 'Connecting to Live Assistant...')
                    : voiceState === 'patient-speaking'
                    ? (isHindi ? 'आपकी बात सुन रहे हैं...' : 'Hearing you speak...')
                    : voiceState === 'speaking'
                    ? (isHindi ? 'मेडीकियोस्क बोल रहा है...' : 'MediKiosk is speaking...')
                    : isMuted
                    ? (isHindi ? 'माइक म्यूट है' : 'Microphone Muted')
                    : (isHindi ? 'सुन रहे हैं...' : "I'm listening...")}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  {voiceState === 'speaking'
                    ? (isHindi ? 'बीच में कभी भी बोलें — तुरंत टोक सकते हैं' : 'Speak anytime — barge-in is active')
                    : voiceState === 'patient-speaking'
                    ? (isHindi ? 'बोलने के बाद स्वाभाविक रूप से रुकें' : 'Speak freely, pause naturally when done')
                    : isMuted
                    ? (isHindi ? 'अनम्यूट करने के लिए बटन दबाएं' : 'Click Unmute to resume speaking')
                    : (isHindi ? 'माइक निरंतर चालू है, आराम से बताएं' : 'Continuous mic active — speak whenever ready')}
                </p>
              </div>
            </div>
          )}

          {/* 4. Live Spoken Clinical Interaction Card */}
          {!isCompleted && (
            <div className="w-full bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm text-center space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-teal-800 bg-teal-50 border border-teal-200/70 px-3 py-1 rounded-full uppercase tracking-wider">
                  {isHindi ? 'वर्तमान बातचीत' : 'Live Interaction'}
                </span>

                {voiceState === 'speaking' && (
                  <span className="text-xs text-cyan-700 font-semibold flex items-center gap-1 animate-pulse">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isHindi ? 'लाइव ऑडियो' : 'Streaming 24kHz Audio'}</span>
                  </span>
                )}
              </div>

              {/* Large, Elder-friendly Question Typography */}
              <p className="text-xl sm:text-3xl font-extrabold text-slate-900 leading-relaxed tracking-tight">
                {activeQuestion}
              </p>

          {/* Suggested Options Pills */}
          {currentOptions && currentOptions.length > 0 && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2">
              {currentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSendTypedAnswer(opt.value || opt.label)}
                  className="px-4 py-2 bg-slate-50 hover:bg-teal-50 text-slate-800 hover:text-teal-900 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 hover:border-teal-300 shadow-2xs transition-all cursor-pointer transform active:scale-95"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Live Transcript Context (Collapsible History) */}
      {!isCompleted && conversationList.length > 0 && (
        <div className="w-full bg-slate-50/80 rounded-2xl border border-slate-200/70 p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-400 font-semibold text-[11px]">
            <span>{isHindi ? 'बातचीत का इतिहास' : 'Live Transcript'}</span>
            <button
              type="button"
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer font-bold"
            >
              <span>{showTranscript ? (isHindi ? 'संक्षिप्त करें' : 'Collapse') : (isHindi ? 'पूरा इतिहास देखें' : 'View full history')}</span>
              {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {!showTranscript ? (
            <div className="space-y-1.5 pt-1">
              {lastPatientMsg && (
                <p className="text-slate-600">
                  <strong className="text-slate-800">{isHindi ? 'आप: ' : 'You: '}</strong>
                  &ldquo;{lastPatientMsg.content}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-48 overflow-y-auto pt-2">
              {conversationList.map((msg, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${msg.role === 'ASSISTANT' ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-800'}`}>
                    {msg.role === 'ASSISTANT' ? 'AI' : 'You'}
                  </span>
                  <p className="text-slate-700 text-xs font-medium leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}

      {/* 6. Live Status Notice */}
      {speechNotice && (
        <div className="w-full p-3 rounded-2xl bg-slate-900 text-white text-xs font-bold text-center shadow-xs flex items-center justify-center gap-2">
          <span>{speechNotice}</span>
          {voiceState === 'error' && (
            <button
              type="button"
              onClick={initLiveVoiceSession}
              className="ml-2 px-2.5 py-1 bg-teal-600 hover:bg-teal-500 rounded-lg text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Connection</span>
            </button>
          )}
        </div>
      )}

      {/* 7. Bottom Action Controls Bar */}
      {!isCompleted && !isFinishing && (
        <div className="w-full flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-3xl border border-slate-200/90 shadow-sm">
            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleMicButtonClick}
              disabled={submitting}
              className={`px-5 py-3.5 rounded-2xl text-white font-extrabold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                voiceState === 'speaking'
                  ? 'bg-cyan-600 hover:bg-cyan-700 ring-4 ring-cyan-300/40'
                  : voiceState === 'patient-speaking'
                  ? 'bg-emerald-600 animate-pulse ring-4 ring-emerald-300'
                  : isMuted
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-teal-700 hover:bg-teal-800'
              }`}
            >
              {voiceState === 'speaking' ? (
                <VolumeX className="w-5 h-5" />
              ) : isMuted ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
              <span>
                {voiceState === 'speaking'
                  ? (isHindi ? 'बोलें (टोकें)' : 'Tap to Interrupt')
                  : voiceState === 'patient-speaking'
                  ? (isHindi ? 'सुन रहे हैं...' : 'Hearing You...')
                  : isMuted
                  ? (isHindi ? 'अनम्यूट करें' : 'Unmute Mic')
                  : (isHindi ? 'माइक चालू है' : 'Mic Active')}
              </span>
            </button>

            {/* Mute toggle button */}
            <button
              type="button"
              onClick={toggleMute}
              className={`p-3 rounded-2xl transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                isMuted
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMuted ? (isHindi ? 'म्यूट' : 'Muted') : (isHindi ? 'माइक' : 'Active')}</span>
            </button>

            {/* Keyboard input toggle */}
            <button
              type="button"
              onClick={() => setShowTextInput(!showTextInput)}
              className="p-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Type response instead"
            >
              <Keyboard className="w-4 h-4" />
              <span className="hidden sm:inline">{isHindi ? 'टाइप करें' : 'Type'}</span>
            </button>

            {/* End Conversation Button */}
            <button
              type="button"
              onClick={handleConfirmCompletion}
              disabled={isFinishing}
              className="px-5 py-3.5 bg-slate-100 hover:bg-teal-50 text-slate-800 hover:text-teal-900 border border-slate-200 hover:border-teal-300 font-extrabold text-xs sm:text-sm rounded-2xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isFinishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  <span>{isHindi ? 'पूर्ण हो रहा है...' : 'Completing...'}</span>
                </>
              ) : (
                <>
                  <span>{isHindi ? 'समाप्त करें' : 'Complete Intake'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Optional Text Input Row */}
          {showTextInput && (
            <div className="w-full flex items-center gap-2 animate-in fade-in duration-200">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendTypedAnswer();
                  }
                }}
                placeholder={isHindi ? 'अपना उत्तर यहाँ टाइप करें...' : 'Type your answer here...'}
                className="flex-1 p-3.5 bg-white border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-hidden shadow-2xs"
              />
              <button
                type="button"
                onClick={() => handleSendTypedAnswer()}
                disabled={!textInput.trim() || submitting}
                className="px-5 py-3.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isHindi ? 'भेजें' : 'Send'}</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* 8. Completed Banner */}
      {isCompleted && (
        <div className="w-full bg-teal-50/80 border border-teal-200 p-8 rounded-3xl text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-teal-700 text-white flex items-center justify-center mx-auto shadow-md shadow-teal-700/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {isHindi ? 'साक्षात्कार सफलतापूर्वक पूरा हुआ!' : 'Clinical Intake Complete!'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-md mx-auto">
            {isHindi
              ? 'आपकी दी गई जानकारी को सुरक्षित रूप से संकलित कर लिया गया है। अब पुराने पर्चे या जांच रिपोर्ट अपलोड करें।'
              : 'Your responses have been prepared for physician review. In the next step, upload any past medical documents or skip to get your token.'}
          </p>
          <button
            type="button"
            onClick={onNext}
            className="px-7 py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer transform active:scale-98"
          >
            <span>{isHindi ? 'दस्तावेज़ चरण पर जाएं' : 'Proceed to Documents'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
