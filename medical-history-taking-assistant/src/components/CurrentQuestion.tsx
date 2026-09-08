import React from 'react';
import { Volume2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CurrentQuestionProps {
  questionNumber: number;
  questionText: string;
  reasonForQuestion?: string;
  onSpeakQuestion: () => void;
  isLoading: boolean;
}

export const CurrentQuestion: React.FC<CurrentQuestionProps> = ({
  questionNumber,
  questionText,
  reasonForQuestion,
  onSpeakQuestion,
  isLoading,
}) => {
  return (
    <div className="w-full my-4" id="current-question-container">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${questionNumber}-${questionText.substring(0, 10)}`}
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.99 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="bg-white rounded-[28px] sm:rounded-[36px] p-6 sm:p-9 shadow-md border border-[#E8E7E0] text-center relative overflow-hidden"
        >
          {/* Top Bar: Current Question Badge and Listen Trigger */}
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#F1F4EF] text-[#5B7558] rounded-full text-xs font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8BA888]" />
              <span>Current Question • #{questionNumber}</span>
            </div>

            <button
              type="button"
              id="replay-audio-button"
              onClick={onSpeakQuestion}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-[#5B7558] hover:text-[#3A423B] bg-[#FAF9F6] border border-[#E8E7E0] hover:bg-[#F1F4EF] transition-all"
              title="Read question aloud"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#8BA888]" />
              <span className="text-[11px] font-medium hidden sm:inline">Listen</span>
            </button>
          </div>

          {/* Editorial Display Question in Serif */}
          <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-[#1F2922] px-2 sm:px-6 leading-relaxed sm:leading-snug">
            {questionText}
          </h2>

          {/* Adaptive Clinical Rationale */}
          {reasonForQuestion && (
            <div className="mt-5 pt-4 border-t border-[#E8E7E0] flex items-center justify-center gap-2 text-xs text-[#828C84]">
              <Sparkles className="w-3.5 h-3.5 text-[#8BA888] shrink-0" />
              <span className="italic">Clinical Focus: {reasonForQuestion}</span>
            </div>
          )}

          {isLoading && (
            <div className="mt-4 pt-3 flex items-center justify-center gap-2 text-xs text-[#5B7558] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#8BA888] animate-ping" />
              <span>Analyzing clinical responses & dynamically determining next question...</span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
