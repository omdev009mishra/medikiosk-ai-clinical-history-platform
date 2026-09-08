import React from 'react';
import { motion } from 'motion/react';
import { getUiTranslations } from '../config/languages';

interface DynamicOptionsProps {
  options: string[];
  onSelectOption: (option: string) => void;
  disabled: boolean;
  language?: string;
}

export const DynamicOptions: React.FC<DynamicOptionsProps> = ({
  options,
  onSelectOption,
  disabled,
  language = 'en',
}) => {
  if (!options || options.length === 0) {
    return null;
  }

  const translations = getUiTranslations(language);

  return (
    <div className="w-full my-3" id="dynamic-options-container">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#828C84] mb-2.5 text-center sm:text-left">
        {translations.suggestedOptions}
      </p>
      <div className="flex flex-wrap justify-center sm:justify-start gap-2">
        {options.map((option, idx) => (
          <motion.button
            key={`${option}-${idx}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, delay: idx * 0.03 }}
            type="button"
            disabled={disabled}
            onClick={() => onSelectOption(option)}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[#FAF9F6] border border-[#E8E7E0] rounded-full text-xs sm:text-sm font-medium text-[#2D312E] hover:bg-[#8BA888] hover:text-white hover:border-[#8BA888] transition-all shadow-2xs active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {option}
          </motion.button>
        ))}
      </div>
    </div>
  );
};
