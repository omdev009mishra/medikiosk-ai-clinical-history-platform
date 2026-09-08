/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ConversationScreen } from './components/ConversationScreen';
import { SafetyAlert } from './components/SafetyAlert';
import { SummaryScreen } from './components/SummaryScreen';
import { AppScreen, FinalMedicalSummary, MessageTurn, StructuredMedicalHistory } from './types';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [summaryData, setSummaryData] = useState<FinalMedicalSummary | null>(null);
  const [urgentData, setUrgentData] = useState<{ reason?: string; message?: string } | null>(null);
  const [conversationHistory, setConversationHistory] = useState<MessageTurn[]>([]);
  const [structuredHistory, setStructuredHistory] = useState<StructuredMedicalHistory>({});

  const handleStart = (lang: string) => {
    setSelectedLanguage(lang);
    setScreen('conversation');
  };

  const handleComplete = (summary: FinalMedicalSummary) => {
    setSummaryData(summary);
    setScreen('summary');
  };

  const handleUrgentStop = (data: { reason?: string; message?: string }) => {
    setUrgentData(data);
    setScreen('urgent_alert');
  };

  const handleEditAnswers = () => {
    setScreen('conversation');
  };

  const handleRestart = () => {
    setSummaryData(null);
    setUrgentData(null);
    setConversationHistory([]);
    setStructuredHistory({});
    setScreen('welcome');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#2D312E] font-sans">
      {screen === 'welcome' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <WelcomeScreen onStart={handleStart} />
        </div>
      )}

      {screen === 'conversation' && (
        <ConversationScreen
          initialLanguage={selectedLanguage}
          initialMessages={conversationHistory}
          initialStructuredHistory={structuredHistory}
          onHistoryUpdate={(h, s) => {
            setConversationHistory(h);
            setStructuredHistory(s);
          }}
          onComplete={handleComplete}
          onUrgentStop={handleUrgentStop}
          onRestart={handleRestart}
        />
      )}

      {screen === 'urgent_alert' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <SafetyAlert
            urgentReason={urgentData?.reason}
            assistantMessage={urgentData?.message}
            history={conversationHistory}
            structuredHistory={structuredHistory}
            onRestart={handleRestart}
          />
        </div>
      )}

      {screen === 'summary' && summaryData && (
        <div className="min-h-screen py-6 px-4">
          <SummaryScreen
            summary={summaryData}
            history={conversationHistory}
            structuredHistory={structuredHistory}
            onEditAnswers={handleEditAnswers}
            onRestart={handleRestart}
          />
        </div>
      )}
    </div>
  );
}
