import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProgressIndicator } from './ProgressIndicator';
import { CurrentQuestion } from './CurrentQuestion';
import { DynamicOptions } from './DynamicOptions';
import { VoiceInput } from './VoiceInput';
import { TextInput } from './TextInput';
import { ChatHistory } from './ChatHistory';
import { MessageTurn, StructuredMedicalHistory, GeminiResponse } from '../types';
import { getNextMedicalQuestion, requestSummaryGeneration } from '../services/geminiService';
import { SpeechSynthesisService } from '../services/voiceService';
import { getLanguageConfig, getUiTranslations } from '../config/languages';
import { Sparkles } from 'lucide-react';

interface ConversationScreenProps {
  initialLanguage?: string;
  initialMessages?: MessageTurn[];
  initialStructuredHistory?: StructuredMedicalHistory;
  onHistoryUpdate?: (history: MessageTurn[], structured: StructuredMedicalHistory) => void;
  onComplete: (summaryData: any) => void;
  onUrgentStop: (urgentData: { reason?: string; message?: string }) => void;
  onRestart: () => void;
}

const MAX_QUESTIONS = 14;

export const ConversationScreen: React.FC<ConversationScreenProps> = ({
  initialLanguage = 'en',
  initialMessages = [],
  initialStructuredHistory = {},
  onHistoryUpdate,
  onComplete,
  onUrgentStop,
  onRestart,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialLanguage);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number>(
    initialMessages.length > 0
      ? Math.min(MAX_QUESTIONS, Math.floor(initialMessages.length / 2) + 1)
      : 1
  );
  const [currentQuestionText, setCurrentQuestionText] = useState<string>('');
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [reasonForQuestion, setReasonForQuestion] = useState<string | undefined>('Chief complaint identification');

  const [messages, setMessages] = useState<MessageTurn[]>(initialMessages);
  const [structuredHistory, setStructuredHistory] = useState<StructuredMedicalHistory>(
    initialStructuredHistory
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(initialMessages.length === 0);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  const langConfig = getLanguageConfig(selectedLanguage);
  const translations = getUiTranslations(selectedLanguage);

  // Reference to track whether initial question has already been fetched
  const hasInitializedRef = useRef<boolean>(false);

  const fetchInitial = useCallback(async () => {
    setIsLoading(true);
    setIsInitializing(true);
    setErrorBanner(null);
    setRetryAction(null);

    try {
      const result: GeminiResponse = await getNextMedicalQuestion({
        history: [],
        latestAnswer: '',
        questionNumber: 1,
        structuredHistory: {},
        language: selectedLanguage,
        isInitial: true,
      });

      setCurrentQuestionText(result.assistantMessage);
      setCurrentOptions(result.options || []);
      setReasonForQuestion(result.reasonForQuestion || 'Chief complaint identification');

      if (result.detectedLanguage && selectedLanguage === 'auto') {
        setSelectedLanguage(result.detectedLanguage);
      }

      if (voiceEnabled && result.assistantMessage) {
        SpeechSynthesisService.speak(result.assistantMessage, {
          lang: result.language || selectedLanguage,
        });
      }
    } catch (err: any) {
      console.error('Failed to load initial medical question:', err);
      const fallbackMsg =
        selectedLanguage === 'hi'
          ? 'नमस्ते, आज आपको क्या स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं? कृपया बताएं।'
          : selectedLanguage === 'mr'
          ? 'नमस्कार, आज तुम्हाला आरोग्याची कोणती समस्या किंवा त्रास जाणवत आहे? कृपया सांगा.'
          : 'Hello, what health problem or symptoms are you experiencing today?';
      setCurrentQuestionText(fallbackMsg);
      setCurrentOptions(
        selectedLanguage === 'hi'
          ? ['सिरदर्द (Headache)', 'पेट दर्द (Stomach pain)', 'बुखार (Fever)', 'खांसी / सांस लेने में तकलीफ', 'छाती में दर्द']
          : selectedLanguage === 'mr'
          ? ['डोकेदुखी (Headache)', 'पोटदुखी (Stomach pain)', 'ताप (Fever)', 'खोकला / श्वास घेण्यास त्रास', 'छातीत दुखणे']
          : ['Headache', 'Abdominal pain', 'Fever and chills', 'Cough or shortness of breath', 'Chest discomfort']
      );
      setErrorBanner(
        err?.message?.includes('high demand') || err?.message?.includes('503')
          ? 'AI service is temporarily busy. A standard intake question has been loaded, or you can retry.'
          : 'Could not connect to AI service. Default question loaded.'
      );
      setRetryAction(() => () => fetchInitial());
    } finally {
      setIsLoading(false);
      setIsInitializing(false);
    }
  }, [selectedLanguage, voiceEnabled]);

  // 1. Dynamic Initialization: Fetch opening question dynamically from Gemini in the selected language
  useEffect(() => {
    if (initialMessages.length > 0) {
      const lastAssistantMsg = [...initialMessages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistantMsg) {
        setCurrentQuestionText(lastAssistantMsg.message);
      }
      setIsInitializing(false);
      return;
    }

    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    fetchInitial();

    return () => {
      SpeechSynthesisService.stop();
    };
  }, [fetchInitial, initialMessages]);

  // 2. Language switch handler (when changed in header)
  const handleLanguageChange = async (newLangId: string) => {
    if (newLangId === selectedLanguage && selectedLanguage !== 'auto') return;
    setSelectedLanguage(newLangId);
    SpeechSynthesisService.stop();
    setErrorBanner(null);

    // If we have a current question, ask Gemini to re-render in the new language
    if (currentQuestionText && !isInitializing) {
      setIsLoading(true);
      try {
        const result: GeminiResponse = await getNextMedicalQuestion({
          history: messages,
          latestAnswer: '',
          questionNumber: currentQuestionNumber,
          structuredHistory,
          language: newLangId,
          isLanguageSwitch: true,
        });

        if (result.assistantMessage) {
          setCurrentQuestionText(result.assistantMessage);
          setCurrentOptions(result.options || []);
          if (result.reasonForQuestion) {
            setReasonForQuestion(result.reasonForQuestion);
          }

          if (voiceEnabled) {
            SpeechSynthesisService.speak(result.assistantMessage, {
              lang: newLangId,
            });
          }
        }
      } catch (err: any) {
        console.warn('Language switch translation failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleToggleVoice = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    SpeechSynthesisService.setMuted(!nextVal);
    if (nextVal && currentQuestionText) {
      SpeechSynthesisService.speak(currentQuestionText, {
        lang: selectedLanguage,
      });
    }
  };

  const handleSpeakQuestion = () => {
    if (currentQuestionText) {
      SpeechSynthesisService.speak(currentQuestionText, {
        lang: selectedLanguage,
      });
    }
  };

  // 3. User answer submission (text or voice)
  const handleAnswerSubmission = useCallback(
    async (answerText: string) => {
      if (isLoading || !answerText.trim()) return;

      SpeechSynthesisService.stop();
      setErrorBanner(null);
      setIsLoading(true);

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 1. Add current assistant question to history transcript
      const assistantTurn: MessageTurn = {
        id: `assistant-${currentQuestionNumber}-${Date.now()}`,
        role: 'assistant',
        message: currentQuestionText,
        questionNumber: currentQuestionNumber,
        language: selectedLanguage,
        timestamp,
      };

      // 2. Add user response to history transcript
      const userTurn: MessageTurn = {
        id: `user-${currentQuestionNumber}-${Date.now() + 1}`,
        role: 'user',
        message: answerText,
        language: selectedLanguage,
        timestamp,
      };

      const updatedMessages = [...messages, assistantTurn, userTurn];
      setMessages(updatedMessages);

      try {
        const result: GeminiResponse = await getNextMedicalQuestion({
          history: updatedMessages,
          latestAnswer: answerText,
          questionNumber: currentQuestionNumber,
          structuredHistory,
          language: selectedLanguage,
        });

        // If Auto Detect was used or user spoke in a different language, update selected language
        if (result.detectedLanguage && result.detectedLanguage !== selectedLanguage) {
          setSelectedLanguage(result.detectedLanguage);
        }

        // Merge updated structured clinical history (preserved in standard English)
        const mergedStructured = result.structuredHistory || structuredHistory;
        if (result.structuredHistory) {
          setStructuredHistory(result.structuredHistory);
        }
        if (onHistoryUpdate) {
          onHistoryUpdate(updatedMessages, mergedStructured);
        }

        // Check for urgent red flags
        if (result.status === 'urgent_stop' || result.riskLevel === 'urgent') {
          onUrgentStop({
            reason: result.urgentReason,
            message: result.assistantMessage,
          });
          return;
        }

        // Check for interview completion (or maximum 14 questions reached)
        if (result.status === 'complete' || currentQuestionNumber >= MAX_QUESTIONS) {
          if (result.finalSummary) {
            onComplete(result.finalSummary);
          } else {
            // Request final summary synthesis if not already provided
            const sumRes = await requestSummaryGeneration({
              history: updatedMessages,
              structuredHistory: result.structuredHistory || structuredHistory,
              language: result.language || selectedLanguage,
            });
            onComplete(sumRes);
          }
          return;
        }

        // Advance to next dynamically determined question
        const nextQNum = Math.min(MAX_QUESTIONS, currentQuestionNumber + 1);
        setCurrentQuestionNumber(nextQNum);
        setCurrentQuestionText(result.assistantMessage);
        setCurrentOptions(result.options || []);
        setReasonForQuestion(result.reasonForQuestion);

        // Speak next question in active language if voice is enabled
        if (voiceEnabled && result.assistantMessage) {
          SpeechSynthesisService.speak(result.assistantMessage, {
            lang: result.language || selectedLanguage,
          });
        }
      } catch (err: any) {
        console.error('Error in medical interview step:', err);
        const errMsg =
          typeof err?.message === 'string'
            ? err.message
            : 'Failed to analyze answer. Please try again.';
        setErrorBanner(errMsg);
        setRetryAction(() => () => handleAnswerSubmission(answerText));
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentQuestionNumber,
      currentQuestionText,
      isLoading,
      messages,
      onComplete,
      onUrgentStop,
      onHistoryUpdate,
      selectedLanguage,
      structuredHistory,
      voiceEnabled,
    ]
  );

  const handleFinishEarly = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      SpeechSynthesisService.stop();
      const sumRes = await requestSummaryGeneration({
        history: messages,
        structuredHistory,
        language: selectedLanguage,
      });
      onComplete(sumRes);
    } catch (err: any) {
      const errMsg = 'Failed to generate summary: ' + (err?.message || 'Server busy');
      setErrorBanner(errMsg);
      setRetryAction(() => () => handleFinishEarly());
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#2D312E]" id="conversation-screen">
      {/* Top Header with Progress, Language Picker & Controls */}
      <ProgressIndicator
        currentQuestionNumber={currentQuestionNumber}
        maxQuestions={MAX_QUESTIONS}
        currentLanguage={selectedLanguage}
        onLanguageChange={handleLanguageChange}
        voiceEnabled={voiceEnabled}
        onToggleVoice={handleToggleVoice}
        onFinishEarly={handleFinishEarly}
        onRestart={onRestart}
        canFinishEarly={currentQuestionNumber >= 3}
        isLoading={isLoading}
      />

      {/* Main Conversation Body */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-4 flex flex-col justify-between">
        <div className="w-full">
          {/* Prior conversation turns */}
          <ChatHistory messages={messages} />

          {/* Error Banner if any */}
          {errorBanner && (
            <div className="my-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3 shadow-2xs animate-fade-in">
              <span className="flex-1 leading-relaxed">{errorBanner}</span>
              <div className="flex items-center gap-2 shrink-0">
                {retryAction && (
                  <button
                    type="button"
                    onClick={() => {
                      const act = retryAction;
                      setErrorBanner(null);
                      setRetryAction(null);
                      act();
                    }}
                    className="px-2.5 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] transition-colors"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setErrorBanner(null);
                    setRetryAction(null);
                  }}
                  className="text-rose-600 hover:text-rose-900 font-semibold text-[11px]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Initial Loading Skeleton */}
          {isInitializing ? (
            <div className="w-full my-8 p-8 sm:p-12 rounded-[32px] bg-white border border-[#E8E7E0] shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F1F4EF] flex items-center justify-center text-[#5B7558] mb-4">
                <Sparkles className="w-6 h-6 animate-pulse text-[#8BA888]" />
              </div>
              <h3 className="text-base font-semibold text-[#2D312E] mb-1">
                Initiating Clinical Intake
              </h3>
              <p className="text-xs text-[#828C84] max-w-sm">
                Preparing personalized conversation in {langConfig.nativeName}...
              </p>
            </div>
          ) : (
            <>
              {/* Current Dynamic Question */}
              <CurrentQuestion
                questionNumber={currentQuestionNumber}
                questionText={currentQuestionText}
                reasonForQuestion={reasonForQuestion}
                onSpeakQuestion={handleSpeakQuestion}
                isLoading={isLoading}
              />

              {/* Dynamic contextual options if available */}
              <DynamicOptions
                options={currentOptions}
                onSelectOption={(opt) => handleAnswerSubmission(opt)}
                disabled={isLoading}
                language={selectedLanguage}
              />

              {/* Multilingual Voice Input (Tap to speak in active language) */}
              <VoiceInput
                language={selectedLanguage}
                onTranscriptSubmitted={(transcript) => handleAnswerSubmission(transcript)}
                onSwitchToType={() => document.getElementById('chat-text-input')?.focus()}
                disabled={isLoading}
              />
            </>
          )}
        </div>
      </main>

      {/* Bottom Text Input Bar */}
      <TextInput
        language={selectedLanguage}
        onSubmit={(text) => handleAnswerSubmission(text)}
        disabled={isLoading || isInitializing}
        placeholder={isLoading ? 'Analyzing answer...' : undefined}
      />
    </div>
  );
};
