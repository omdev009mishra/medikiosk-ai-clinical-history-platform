import React, { useState } from 'react';
import { AlertOctagon, PhoneCall, Copy, RotateCcw, Check, ShieldAlert } from 'lucide-react';
import { EMERGENCY_NUMBERS } from '../services/safetyService';
import { MessageTurn, StructuredMedicalHistory } from '../types';

interface SafetyAlertProps {
  urgentReason?: string;
  assistantMessage?: string;
  history: MessageTurn[];
  structuredHistory: StructuredMedicalHistory;
  onRestart: () => void;
}

export const SafetyAlert: React.FC<SafetyAlertProps> = ({
  urgentReason,
  assistantMessage = "Some of the symptoms you've described may require urgent medical attention. Please seek immediate medical care or contact your local emergency service.",
  history,
  onRestart,
}) => {
  const [copied, setCopied] = useState(false);

  const formattedTranscript = history
    .map((h) => `[${h.role === 'assistant' ? 'Question' : 'User Response'}]: ${h.message}`)
    .join('\n\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `URGENT MEDICAL INTAKE REPORT\nDate: ${new Date().toLocaleString()}\n\nREASON FOR ALERT:\n${urgentReason || 'Potential emergency symptoms reported'}\n\nCONVERSATION RECORD:\n${formattedTranscript}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8" id="safety-alert-screen">
      <div className="bg-white rounded-[32px] sm:rounded-[40px] border-2 border-rose-500 shadow-lg p-6 sm:p-9">
        {/* Red Flag Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-2xs">
            <AlertOctagon className="w-7 h-7 animate-bounce" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-700">
              Urgent Medical Alert
            </span>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#1F2922]">
              Immediate Care Recommended
            </h1>
          </div>
        </div>

        {/* Primary Alert Warning */}
        <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 sm:p-5 mb-6">
          <p className="text-sm font-semibold text-rose-950 leading-relaxed">
            {assistantMessage}
          </p>
          {urgentReason && (
            <div className="mt-3 pt-3 border-t border-rose-200 flex items-start gap-2 text-xs text-rose-900">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <span className="font-bold">Concerning Indicator:</span> {urgentReason}
              </div>
            </div>
          )}
        </div>

        {/* Emergency Contact Quick Access */}
        <div className="mb-6">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#828C84] mb-3">
            Emergency Hotlines by Region
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {EMERGENCY_NUMBERS.map((item) => (
              <a
                key={item.region}
                href={`tel:${item.number}`}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF9F6] hover:bg-rose-50 border border-[#E8E7E0] hover:border-rose-300 transition-colors group"
              >
                <div>
                  <div className="text-xs font-medium text-[#4A554C] group-hover:text-rose-950">
                    {item.region}
                  </div>
                  <div className="text-base font-bold text-rose-700 font-serif">
                    Dial {item.number}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  <PhoneCall className="w-4 h-4" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Clinical Note for ER Staff */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F6] border border-[#E8E7E0] mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3A423B]">
              Intake History to Show Emergency Personnel
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B7558] hover:text-[#3A423B] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#5B7558]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Notes</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-[#4A554C] line-clamp-3 bg-white p-3 rounded-xl border border-[#E8E7E0]">
            {formattedTranscript || 'No symptoms entered yet.'}
          </p>
        </div>

        {/* Reset Action */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E8E7E0] text-[#3A423B] bg-[#FAF9F6] hover:bg-[#F0EFED] text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Start Over (New Case)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
