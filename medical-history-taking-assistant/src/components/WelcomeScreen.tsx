import React, { useState } from 'react';
import {
  ShieldCheck,
  Activity,
  MessageSquareHeart,
  Mic,
  FileText,
  ArrowRight,
  Globe,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  PRIMARY_LANGUAGES,
  MORE_LANGUAGES,
  AUTO_DETECT_LANGUAGE,
  getLanguageConfig,
  getUiTranslations,
} from '../config/languages';

interface WelcomeScreenProps {
  onStart: (selectedLanguage: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [showMoreLanguages, setShowMoreLanguages] = useState<boolean>(false);

  const currentTranslations = getUiTranslations(selectedLanguage);
  const currentLangConfig = getLanguageConfig(selectedLanguage);

  const handleLanguageSelect = (langId: string) => {
    setSelectedLanguage(langId);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12" id="welcome-screen">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white rounded-[32px] sm:rounded-[40px] border border-[#E8E7E0] shadow-md p-6 sm:p-10 text-[#2D312E]"
      >
        {/* Header Badge & Title */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#8BA888] flex items-center justify-center text-white shadow-2xs">
            <Activity className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#1F2922] tracking-tight">
              Clinical Intake Assistant
            </h1>
            <p className="text-xs sm:text-sm text-[#828C84] font-medium">
              Natural, adaptive conversational health history taking
            </p>
          </div>
        </div>

        {/* Informational intro */}
        <p className="text-sm sm:text-base text-[#4A554C] leading-relaxed mb-6">
          This system conducts an intelligent clinical interview tailored dynamically to your specific health concern. Questions adapt step-by-step to your answers rather than following a rigid form.
        </p>

        {/* 1. LANGUAGE SELECTION SECTION */}
        <div className="mb-7 rounded-3xl border border-[#E8E7E0] bg-[#FAF9F6] p-4 sm:p-5" id="language-selection-section">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#8BA888]" />
              <label htmlFor="language-selection-section" className="text-xs font-bold uppercase tracking-wider text-[#5B7558]">
                {currentTranslations.chooseLanguage}
              </label>
            </div>
            {selectedLanguage === 'auto' ? (
              <span className="text-[11px] font-medium text-[#5B7558] bg-[#F1F4EF] px-2.5 py-0.5 rounded-full border border-[#8BA888]/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#8BA888]" />
                Auto-detection active
              </span>
            ) : (
              <span className="text-[11px] font-medium text-[#5B7558] bg-[#F1F4EF] px-2.5 py-0.5 rounded-full border border-[#8BA888]/30">
                {currentLangConfig.nativeName} ({currentLangConfig.name})
              </span>
            )}
          </div>

          {/* Primary Language Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
            {PRIMARY_LANGUAGES.map((lang) => {
              const isSelected = selectedLanguage === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  id={`lang-btn-${lang.id}`}
                  onClick={() => handleLanguageSelect(lang.id)}
                  className={`px-3 py-2 rounded-2xl text-xs font-medium transition-all text-left flex items-center justify-between border ${
                    isSelected
                      ? 'bg-[#8BA888] text-white border-[#8BA888] shadow-xs'
                      : 'bg-white text-[#2D312E] hover:bg-[#F0EFED] border-[#E8E7E0]'
                  }`}
                >
                  <span className="truncate">{lang.nativeName}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[#828C84]'}`}>
                    {lang.name}
                  </span>
                </button>
              );
            })}

            {/* Toggle More Languages */}
            <button
              type="button"
              id="toggle-more-languages-btn"
              onClick={() => setShowMoreLanguages(!showMoreLanguages)}
              className="px-3 py-2 rounded-2xl text-xs font-medium bg-white hover:bg-[#F0EFED] border border-[#E8E7E0] text-[#5B7558] flex items-center justify-center gap-1 transition-colors"
            >
              <span>More languages</span>
              {showMoreLanguages ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Expanded More Languages (Odia, Assamese, etc.) */}
          {showMoreLanguages && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 pb-2 border-t border-[#E8E7E0]/60 mt-2"
            >
              {MORE_LANGUAGES.map((lang) => {
                const isSelected = selectedLanguage === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    id={`lang-btn-${lang.id}`}
                    onClick={() => handleLanguageSelect(lang.id)}
                    className={`px-3 py-2 rounded-2xl text-xs font-medium transition-all text-left flex items-center justify-between border ${
                      isSelected
                        ? 'bg-[#8BA888] text-white border-[#8BA888] shadow-xs'
                        : 'bg-white text-[#2D312E] hover:bg-[#F0EFED] border-[#E8E7E0]'
                    }`}
                  >
                    <span>{lang.nativeName}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[#828C84]'}`}>
                      {lang.name}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* Auto Detect Option */}
          <div className="pt-2 border-t border-[#E8E7E0]/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <button
              type="button"
              id="lang-btn-auto"
              onClick={() => handleLanguageSelect('auto')}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold border transition-all ${
                selectedLanguage === 'auto'
                  ? 'bg-[#5B7558] text-white border-[#5B7558] shadow-2xs'
                  : 'bg-white text-[#5B7558] hover:bg-[#F0EFED] border-[#8BA888]/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto Detect (स्वतः ओळख / स्वतः पहचान)</span>
            </button>

            <span className="text-[11px] text-[#828C84] italic">
              {selectedLanguage === 'auto'
                ? currentTranslations.autoDetectNotice
                : 'Supports Hindi, Marathi, Hinglish & regional languages'}
            </span>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E8E7E0] flex items-start gap-3">
            <MessageSquareHeart className="w-4 h-4 text-[#8BA888] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#2D312E]">Adaptive Flow</p>
              <p className="text-xs text-[#828C84] mt-0.5">Calculates the next best question per answer</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E8E7E0] flex items-start gap-3">
            <Mic className="w-4 h-4 text-[#8BA888] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#2D312E]">Voice & Text</p>
              <p className="text-xs text-[#828C84] mt-0.5">Speak via mic or type in your language</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E8E7E0] flex items-start gap-3">
            <FileText className="w-4 h-4 text-[#8BA888] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#2D312E]">Structured Summary</p>
              <p className="text-xs text-[#828C84] mt-0.5">Organized report ready for your doctor</p>
            </div>
          </div>
        </div>

        {/* Mandatory Medical Notice */}
        <div className="rounded-2xl border border-[#8BA888]/40 bg-[#F1F4EF] p-4 sm:p-5 mb-7" id="medical-disclaimer-box">
          <div className="flex gap-3.5">
            <ShieldCheck className="w-5 h-5 text-[#5B7558] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#5B7558] mb-1">
                Important Medical Notice
              </h2>
              <p className="text-xs text-[#3A423B] leading-relaxed">
                This assistant collects general health information and helps organize the information you provide. It does not diagnose medical conditions or replace a qualified healthcare professional.
              </p>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <span className="text-xs text-[#828C84] font-medium">
            Hard maximum of 14 focused questions
          </span>
          <button
            id="start-intake-button"
            onClick={() => onStart(selectedLanguage)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#8BA888] hover:bg-[#5B7558] text-white font-medium text-sm transition-all shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#8BA888]/40"
          >
            <span>{currentTranslations.startIntake}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
