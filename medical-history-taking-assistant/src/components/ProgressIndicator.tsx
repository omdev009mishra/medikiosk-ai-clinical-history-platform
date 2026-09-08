import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  CheckCircle,
  RotateCcw,
  Activity,
  Globe,
  ChevronDown,
} from 'lucide-react';
import {
  LANGUAGE_CONFIG,
  PRIMARY_LANGUAGES,
  MORE_LANGUAGES,
  AUTO_DETECT_LANGUAGE,
  getLanguageConfig,
  getUiTranslations,
} from '../config/languages';

interface ProgressIndicatorProps {
  currentQuestionNumber: number;
  maxQuestions: number;
  currentLanguage: string;
  onLanguageChange: (langId: string) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onFinishEarly: () => void;
  onRestart: () => void;
  canFinishEarly: boolean;
  isLoading: boolean;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentQuestionNumber,
  maxQuestions,
  currentLanguage,
  onLanguageChange,
  voiceEnabled,
  onToggleVoice,
  onFinishEarly,
  onRestart,
  canFinishEarly,
  isLoading,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const boundedQ = Math.min(currentQuestionNumber, maxQuestions);
  const progressPercent = Math.min(100, Math.round((boundedQ / maxQuestions) * 100));

  const langConfig = getLanguageConfig(currentLanguage);
  const translations = getUiTranslations(currentLanguage);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (langId: string) => {
    setDropdownOpen(false);
    onLanguageChange(langId);
  };

  return (
    <header
      className="w-full bg-white border-b border-[#E8E7E0] sticky top-0 z-20"
      id="progress-header"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand & Title */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#8BA888] rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-semibold tracking-tight text-[#3A423B]">
              Clinical Intake Assistant
            </h1>
            <span className="text-[10px] sm:text-xs font-medium text-[#828C84] block">
              Adaptive History Taking
            </span>
          </div>
        </div>

        {/* Header Controls & Language Picker */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Language Selector Dropdown */}
          <div className="relative" ref={dropdownRef} id="header-language-picker">
            <button
              type="button"
              id="header-language-toggle-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FAF9F6] hover:bg-[#F0EFED] border border-[#E8E7E0] text-[#2D312E] transition-all shadow-2xs"
              title="Change conversation language"
            >
              <Globe className="w-3.5 h-3.5 text-[#5B7558]" />
              <span className="font-medium">
                {currentLanguage === 'auto'
                  ? 'Auto'
                  : langConfig.nativeName}
              </span>
              <ChevronDown className="w-3 h-3 text-[#828C84]" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-56 max-h-72 overflow-y-auto bg-white border border-[#E8E7E0] rounded-2xl shadow-lg p-1.5 z-30 flex flex-col gap-0.5">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#828C84] border-b border-[#E8E7E0]/60 mb-1">
                  Select Language
                </div>

                <button
                  type="button"
                  id="dropdown-lang-auto"
                  onClick={() => handleSelect('auto')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    currentLanguage === 'auto'
                      ? 'bg-[#F1F4EF] font-bold text-[#5B7558]'
                      : 'hover:bg-[#FAF9F6] text-[#2D312E]'
                  }`}
                >
                  <span>🌐 Auto Detect</span>
                  <span className="text-[10px] text-[#828C84]">Smart</span>
                </button>

                {PRIMARY_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    id={`dropdown-lang-${lang.id}`}
                    onClick={() => handleSelect(lang.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      currentLanguage === lang.id
                        ? 'bg-[#F1F4EF] font-bold text-[#5B7558]'
                        : 'hover:bg-[#FAF9F6] text-[#2D312E]'
                    }`}
                  >
                    <span>{lang.nativeName}</span>
                    <span className="text-[10px] text-[#828C84]">{lang.name}</span>
                  </button>
                ))}

                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#828C84] border-t border-[#E8E7E0]/60 mt-1 pt-1">
                  More
                </div>

                {MORE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    id={`dropdown-lang-${lang.id}`}
                    onClick={() => handleSelect(lang.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      currentLanguage === lang.id
                        ? 'bg-[#F1F4EF] font-bold text-[#5B7558]'
                        : 'hover:bg-[#FAF9F6] text-[#2D312E]'
                    }`}
                  >
                    <span>{lang.nativeName}</span>
                    <span className="text-[10px] text-[#828C84]">{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Progress bar container */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-widest text-[#828C84] font-bold mb-0.5">
              Progress
            </span>
            <div className="flex items-center space-x-2">
              <div className="w-20 md:w-32 h-1.5 bg-[#F0EFED] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8BA888] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                  id="progress-bar-fill"
                />
              </div>
              <span className="text-xs font-medium text-[#4A554C] whitespace-nowrap" id="question-counter">
                {boundedQ} / {maxQuestions}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 pl-1.5 sm:pl-2 border-l border-[#E8E7E0]">
            {/* Voice Readout Toggle */}
            <button
              type="button"
              id="voice-toggle-button"
              onClick={onToggleVoice}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                voiceEnabled
                  ? 'bg-[#F1F4EF] border-[#8BA888]/50 text-[#5B7558] hover:bg-[#8BA888]/20'
                  : 'bg-[#FAF9F6] border-[#E8E7E0] text-[#828C84] hover:bg-[#F0EFED]'
              }`}
              title={voiceEnabled ? translations.voiceOn : translations.voiceOff}
            >
              {voiceEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-[#5B7558]" />
                  <span className="hidden lg:inline">{translations.voiceOn}</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[#828C84]" />
                  <span className="hidden lg:inline">{translations.voiceOff}</span>
                </>
              )}
            </button>

            {/* Complete Early */}
            {canFinishEarly && (
              <button
                type="button"
                id="finish-early-button"
                disabled={isLoading}
                onClick={onFinishEarly}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-[#FAF9F6] hover:bg-[#8BA888] hover:text-white text-[#3A423B] border border-[#E8E7E0] transition-all disabled:opacity-50 shadow-2xs"
                title="Finish interview and generate summary"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{translations.completeEarly}</span>
              </button>
            )}

            {/* Restart */}
            <button
              type="button"
              id="restart-conversation-button"
              onClick={onRestart}
              className="p-1.5 rounded-full text-[#828C84] hover:text-[#2D312E] hover:bg-[#F0EFED] transition-colors"
              title="Start new conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
