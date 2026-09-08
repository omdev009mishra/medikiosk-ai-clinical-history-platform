import React, { useState } from 'react';
import { FileText, Copy, Check, RotateCcw, Edit3, Printer, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { FinalMedicalSummary, MessageTurn, StructuredMedicalHistory } from '../types';

interface SummaryScreenProps {
  summary: FinalMedicalSummary;
  history: MessageTurn[];
  structuredHistory: StructuredMedicalHistory;
  onEditAnswers: () => void;
  onRestart: () => void;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({
  summary,
  history,
  onEditAnswers,
  onRestart,
}) => {
  const [copied, setCopied] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const formatSummaryText = () => {
    let text = `${summary.title || 'Health Information Summary'}\n`;
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += `----------------------------------------\n`;
    if (summary.chiefComplaint) {
      text += `Chief Concern: ${summary.chiefComplaint}\n\n`;
    }
    summary.sections.forEach((sec) => {
      text += `${sec.label}: ${sec.value}\n`;
    });
    text += `\n${summary.disclaimer}\n`;
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formatSummaryText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 md:py-10" id="summary-screen">
      <div className="bg-white rounded-[32px] sm:rounded-[40px] border border-[#E8E7E0] shadow-md overflow-hidden print:border-none print:shadow-none">
        {/* Header Bar */}
        <div className="bg-[#5B7558] text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#8BA888]/80 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-serif tracking-tight">
                {summary.title || 'Health Information Summary'}
              </h1>
              <p className="text-xs text-[#E8E7E0] mt-0.5">
                Intake completed • Ready to share with healthcare provider
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              id="copy-summary-button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white text-[#3A423B] hover:bg-[#FAF9F6] transition-all shadow-2xs active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#5B7558]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="print-summary-button"
              onClick={handlePrint}
              className="p-2.5 rounded-full bg-[#8BA888]/50 hover:bg-[#8BA888] text-white transition-colors"
              title="Print Summary"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-9">
          {summary.chiefComplaint && (
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-[#F1F4EF] border border-[#8BA888]/30">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5B7558]">
                Primary Health Concern
              </span>
              <p className="text-base sm:text-lg font-serif font-semibold text-[#1F2922] mt-1">
                {summary.chiefComplaint}
              </p>
            </div>
          )}

          {/* Structured Clinical Sections */}
          <div className="space-y-3.5 mb-8">
            {summary.sections && summary.sections.length > 0 ? (
              summary.sections.map((section, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-[#E8E7E0] bg-[#FAF9F6] hover:bg-white transition-colors"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#828C84] block mb-1">
                    {section.label}
                  </span>
                  <p className="text-sm text-[#2D312E] font-medium leading-relaxed">
                    {section.value}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#828C84] italic">
                No specific fields recorded.
              </p>
            )}
          </div>

          {/* Mandatory Disclaimer */}
          <div className="rounded-2xl border border-[#E8E7E0] bg-[#FAF9F6] p-4 sm:p-5 mb-8 flex items-start gap-3.5">
            <ShieldCheck className="w-5 h-5 text-[#8BA888] shrink-0 mt-0.5" />
            <p className="text-xs text-[#4A554C] leading-relaxed">
              {summary.disclaimer ||
                'This summary reflects the information you provided and is not a medical diagnosis.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E8E7E0] print:hidden">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="edit-answers-button"
                onClick={onEditAnswers}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-[#E8E7E0] text-[#3A423B] bg-[#FAF9F6] hover:bg-[#8BA888] hover:text-white hover:border-[#8BA888] transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Answers</span>
              </button>
              <button
                type="button"
                onClick={() => setShowTranscript((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-[#828C84] hover:text-[#2D312E] transition-colors"
              >
                <span>View Full Transcript</span>
                {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              id="start-new-conversation-button"
              onClick={onRestart}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold bg-[#8BA888] hover:bg-[#5B7558] text-white shadow-2xs transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start New Conversation</span>
            </button>
          </div>

          {/* Collapsible Transcript */}
          {showTranscript && (
            <div className="mt-6 pt-6 border-t border-[#E8E7E0] text-xs text-[#4A554C] space-y-3 print:hidden">
              <span className="font-bold text-[#1F2922] uppercase tracking-wider block">
                Full Conversation Transcript
              </span>
              <div className="max-h-64 overflow-y-auto space-y-2 p-3.5 bg-[#FAF9F6] rounded-2xl border border-[#E8E7E0]">
                {history.map((h, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="font-semibold text-[#2D312E]">
                      {h.role === 'assistant' ? `Assistant (Q${h.questionNumber || ''}): ` : 'You: '}
                    </span>
                    <span>{h.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
