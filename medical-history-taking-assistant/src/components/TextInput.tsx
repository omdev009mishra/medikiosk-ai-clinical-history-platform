import React, { useState } from 'react';
import { Send, CornerDownLeft } from 'lucide-react';
import { getUiTranslations } from '../config/languages';

interface TextInputProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
  language?: string;
  placeholder?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  onSubmit,
  disabled,
  language = 'en',
  placeholder,
}) => {
  const [value, setValue] = useState('');
  const translations = getUiTranslations(language);

  const effectivePlaceholder = placeholder || translations.typePlaceholder;

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="w-full bg-white border-t border-[#E8E7E0] p-3 sm:p-4 sticky bottom-0 z-20"
      id="text-input-bar"
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <input
              id="chat-text-input"
              type="text"
              value={value}
              disabled={disabled}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={effectivePlaceholder}
              className="w-full pl-4 sm:pl-5 pr-11 py-3 bg-[#FAF9F6] border border-[#E8E7E0] rounded-2xl text-sm text-[#2D312E] placeholder-[#828C84] focus:outline-none focus:ring-2 focus:ring-[#8BA888] focus:bg-white transition-all disabled:opacity-50 shadow-2xs"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center text-[#828C84] pointer-events-none">
              <CornerDownLeft className="w-4 h-4" />
            </div>
          </div>

          <button
            type="button"
            id="send-message-button"
            disabled={disabled || !value.trim()}
            onClick={handleSend}
            className="p-3 rounded-2xl bg-[#8BA888] hover:bg-[#5B7558] text-white transition-all disabled:opacity-35 disabled:pointer-events-none shrink-0 shadow-2xs active:scale-95"
            title="Send answer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] text-[#828C84] text-center italic">
          Disclaimer: This assistant collects health information and does not provide medical diagnoses.
        </p>
      </div>
    </div>
  );
};
