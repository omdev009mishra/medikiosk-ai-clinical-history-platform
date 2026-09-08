import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Check,
  RotateCcw,
  AlertCircle,
  Keyboard,
  X,
} from 'lucide-react';
import { VoiceVisualizer } from './VoiceVisualizer';
import { VoiceState } from '../types';
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
} from '../services/voiceService';
import { getLanguageConfig, getUiTranslations } from '../config/languages';

interface VoiceInputProps {
  language: string;
  onTranscriptSubmitted: (text: string) => void;
  onSwitchToType?: () => void;
  disabled: boolean;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  language,
  onTranscriptSubmitted,
  onSwitchToType,
  disabled,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [transcript, setTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPermanentError, setIsPermanentError] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const supported = isSpeechRecognitionSupported();
  const langConfig = getLanguageConfig(language);
  const translations = getUiTranslations(language);

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Error stopping speech recognition:', err);
      }
      recognitionRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, []);

  // If user switches language mid-turn, stop any active listening session gracefully
  useEffect(() => {
    if (voiceState === 'LISTENING') {
      stopRecognition();
      setVoiceState('IDLE');
      setInterimText('');
    }
  }, [language]);

  const handleStartListening = () => {
    if (disabled) return;
    setErrorMessage(null);
    setIsPermanentError(false);
    setTranscript('');
    setInterimText('');
    setVoiceState('LISTENING');

    if (!supported) {
      setErrorMessage(
        'Speech recognition is not supported in this browser. Please use the keyboard below.'
      );
      setIsPermanentError(true);
      setVoiceState('IDLE');
      return;
    }

    try {
      const recognizer = createSpeechRecognizer({
        lang: language,
        onResult: (res) => {
          if (res.isFinal) {
            setTranscript(res.transcript);
            setInterimText('');
          } else {
            setInterimText(res.transcript);
          }
        },
        onError: (errMessage, permanent) => {
          console.warn('Speech error:', errMessage);
          setErrorMessage(errMessage);
          setIsPermanentError(permanent);
          setVoiceState('IDLE');
        },
        onEnd: () => {
          setVoiceState((prev) => {
            if (prev === 'LISTENING') {
              // If we captured any text, transition to review
              return transcript.trim() || interimText.trim() ? 'READY' : 'IDLE';
            }
            return prev;
          });
        },
      });

      if (recognizer) {
        recognitionRef.current = recognizer;
        recognizer.start();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize microphone');
      setVoiceState('IDLE');
    }
  };

  const handleStopListening = () => {
    stopRecognition();
    const finalVal = (transcript || interimText).trim();
    if (finalVal) {
      setTranscript(finalVal);
      setInterimText('');
      setVoiceState('READY');
    } else {
      setVoiceState('IDLE');
    }
  };

  const handleUseAnswer = () => {
    const finalVal = (transcript || interimText).trim();
    if (finalVal) {
      onTranscriptSubmitted(finalVal);
      setTranscript('');
      setInterimText('');
      setVoiceState('IDLE');
    }
  };

  const handleTryAgain = () => {
    setTranscript('');
    setInterimText('');
    setErrorMessage(null);
    handleStartListening();
  };

  const handleCancel = () => {
    stopRecognition();
    setTranscript('');
    setInterimText('');
    setVoiceState('IDLE');
    setErrorMessage(null);
  };

  const displayReviewText = transcript || interimText;

  return (
    <div className="w-full flex flex-col items-center justify-center my-3" id="voice-input-section">
      {/* Live Waveform & Interim Transcription Banner */}
      {voiceState === 'LISTENING' && (
        <div
          className="mb-4 w-full max-w-md bg-[#F1F4EF] border border-[#8BA888]/40 rounded-2xl p-4 flex flex-col items-center animate-fade-in shadow-xs"
          id="listening-banner"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8BA888] animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#5B7558]">
              {translations.listening}
            </span>
          </div>

          <VoiceVisualizer isActive={true} colorClass="bg-[#8BA888]" />

          {/* Live transcription preview while speaking */}
          <div className="mt-3 w-full bg-white/80 rounded-xl p-2.5 min-h-12 border border-[#8BA888]/30 flex items-center justify-center">
            {interimText || transcript ? (
              <p className="text-sm text-[#2D312E] font-medium text-center leading-relaxed">
                "{interimText || transcript}"
              </p>
            ) : (
              <p className="text-xs text-[#828C84] italic text-center">
                {translations.speakNaturally}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleStopListening}
            className="mt-3 text-xs font-medium text-[#5B7558] hover:underline"
          >
            {translations.tapToFinish}
          </button>
        </div>
      )}

      {/* Captured Transcription Review Dialog / Strip */}
      {voiceState === 'READY' && displayReviewText && (
        <div
          className="mb-4 w-full max-w-lg bg-white border border-[#E8E7E0] rounded-2xl shadow-md p-4 sm:p-5 flex flex-col gap-2.5 animate-fade-in"
          id="voice-review-box"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B7558]">
              Voice Transcription Review
            </span>
            <span className="text-[10px] text-[#828C84]">
              {langConfig.name} ({langConfig.speechRecognition})
            </span>
          </div>

          <p className="text-sm sm:text-base font-medium text-[#2D312E] bg-[#FAF9F6] p-3.5 rounded-xl border border-[#E8E7E0] leading-relaxed">
            "{displayReviewText}"
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1.5">
            <button
              type="button"
              id="voice-try-again-button"
              onClick={handleTryAgain}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#4A554C] hover:bg-[#F0EFED] border border-[#E8E7E0] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#828C84]" />
              <span>{translations.tryAgain}</span>
            </button>

            {onSwitchToType && (
              <button
                type="button"
                id="voice-type-instead-button"
                onClick={() => {
                  handleCancel();
                  onSwitchToType();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#4A554C] hover:bg-[#F0EFED] border border-[#E8E7E0] transition-colors"
              >
                <Keyboard className="w-3.5 h-3.5 text-[#828C84]" />
                <span>{translations.typeInstead}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 rounded-full text-[#828C84] hover:text-[#2D312E] transition-colors"
              title={translations.cancel}
            >
              <X className="w-4 h-4" />
            </button>

            <button
              type="button"
              id="use-voice-answer-button"
              onClick={handleUseAnswer}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#8BA888] hover:bg-[#5B7558] text-white shadow-xs transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{translations.useAnswer}</span>
            </button>
          </div>
        </div>
      )}

      {/* Error notification with explicit Try Again and Type Instead buttons */}
      {errorMessage && (
        <div
          className="mb-4 w-full max-w-md text-xs text-rose-900 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-2xs animate-fade-in"
          id="voice-error-box"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200/60">
            {!isPermanentError && (
              <button
                type="button"
                onClick={handleTryAgain}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-rose-800 bg-white hover:bg-rose-100/60 border border-rose-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{translations.tryAgain}</span>
              </button>
            )}

            {onSwitchToType && (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  onSwitchToType();
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-[#2D312E] bg-white hover:bg-[#FAF9F6] border border-[#E8E7E0] transition-colors"
              >
                <Keyboard className="w-3 h-3" />
                <span>{translations.typeInstead}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Large Microphone Action Button (Natural Tones) */}
      <div className="flex flex-col items-center">
        {voiceState === 'LISTENING' ? (
          <button
            type="button"
            id="stop-listening-button"
            onClick={handleStopListening}
            className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-all active:scale-95 focus:outline-none focus:ring-4 focus:ring-rose-200"
            title={translations.tapToFinish}
          >
            <MicOff className="w-7 h-7" />
          </button>
        ) : (
          <button
            type="button"
            id="start-listening-button"
            disabled={disabled}
            onClick={handleStartListening}
            className="w-16 h-16 bg-[#8BA888] rounded-full flex items-center justify-center shadow-lg hover:bg-[#5B7558] transition-all group relative text-white active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-4 focus:ring-[#8BA888]/30"
            title={`${translations.tapToSpeak} (${langConfig.nativeName})`}
          >
            <div className="absolute inset-0 rounded-full bg-[#8BA888] opacity-25 animate-ping group-hover:hidden pointer-events-none" />
            <Mic className="w-7 h-7" />
          </button>
        )}

        <span className="text-[10px] font-bold uppercase tracking-widest text-[#828C84] mt-2.5 text-center">
          {voiceState === 'LISTENING'
            ? translations.tapToFinish
            : `${translations.tapToSpeak} • ${langConfig.nativeName}`}
        </span>
      </div>
    </div>
  );
};
