import React from 'react';
import { Volume2, ArrowRight, HeartPulse, Check, Sparkles } from 'lucide-react';
import { LanguageCode } from '../../types/client';
import { SpeechService } from '../../services/speech';

interface LanguageStepProps {
  selectedLanguage: LanguageCode;
  onSelect: (lang: LanguageCode) => void;
  onNext: () => void;
}

interface LanguageCardData {
  code: LanguageCode;
  nativeName: string;
  englishName: string;
  greeting: string;
  sampleSpeech: string;
  flagEmoji: string;
}

const LANGUAGES: LanguageCardData[] = [
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    greeting: 'नमस्ते! कृपया अपनी भाषा चुनें',
    sampleSpeech: 'नमस्ते! मेडीकियोस्क में आपका स्वागत है।',
    flagEmoji: '🇮🇳',
  },
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English (India)',
    greeting: 'Hello! Please select your language',
    sampleSpeech: 'Hello! Welcome to MediKiosk.',
    flagEmoji: '🇮🇳',
  },
  {
    code: 'mr',
    nativeName: 'मराठी',
    englishName: 'Marathi',
    greeting: 'नमस्कार! आपली भाषा निवडा',
    sampleSpeech: 'नमस्कार! मेडीकियोस्क मध्ये आपले स्वागत आहे.',
    flagEmoji: '🇮🇳',
  },
  {
    code: 'gu',
    nativeName: 'ગુજરાતી',
    englishName: 'Gujarati',
    greeting: 'નમસ્તે! તમારી ભાષા પસંદ કરો',
    sampleSpeech: 'નમસ્તે! મેડીકિયોસ્ક માં આપનું સ્વાગત છે.',
    flagEmoji: '🇮🇳',
  },
  {
    code: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    greeting: 'নমস্কার! আপনার ভাষা বাছুন',
    sampleSpeech: 'নমস্কার! মেডিকিয়স্কে আপনাকে স্বাগতম।',
    flagEmoji: '🇮🇳',
  },
  {
    code: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    greeting: 'வணக்கம்! உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
    sampleSpeech: 'வணக்கம்! மெடிகியோஸ்கிற்கு வரவேற்கிறோம்.',
    flagEmoji: '🇮🇳',
  },
  {
    code: 'te',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
    greeting: 'నమస్కారం! మీ భాషను ఎంచుకోండి',
    sampleSpeech: 'నమస్కారం! మెడికియోస్క్‌కి స్వాగతం.',
    flagEmoji: '🇮🇳',
  },
];

export const LanguageStep: React.FC<LanguageStepProps> = ({
  selectedLanguage,
  onSelect,
  onNext,
}) => {
  const handlePlayVoice = (e: React.MouseEvent, lang: LanguageCardData) => {
    e.stopPropagation();
    SpeechService.speak(lang.sampleSpeech, lang.code === 'hi' ? 'hi' : 'en');
  };

  const currentLang = LANGUAGES.find((l) => l.code === selectedLanguage) || LANGUAGES[0];
  const isHindi = selectedLanguage === 'hi';

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex flex-col items-center animate-in fade-in duration-300">
      {/* Welcoming Brand Hero */}
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-teal-700/20 mb-5">
          <HeartPulse className="w-9 h-9 stroke-[2.2]" />
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Welcome to MediKiosk
        </h1>

        <p className="text-base sm:text-xl font-semibold text-teal-800 mt-2 italic font-serif">
          &ldquo;Tell us how you feel. We will guide you.&rdquo;
        </p>

        <p className="text-xs sm:text-sm font-medium text-slate-500 mt-2 max-w-md">
          {isHindi
            ? 'अपनी पसंद की भाषा चुनें &bull; आप बोलकर या छूकर जवाब दे सकते हैं'
            : 'Choose your preferred language &bull; You can speak naturally or tap the screen'}
        </p>
      </div>

      {/* Language Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 w-full mb-8">
        {LANGUAGES.map((lang) => {
          const isSelected = selectedLanguage === lang.code;
          return (
            <div
              key={lang.code}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(lang.code);
                  SpeechService.speak(lang.sampleSpeech, lang.code === 'hi' ? 'hi' : 'en');
                }
              }}
              onClick={() => {
                onSelect(lang.code);
                SpeechService.speak(lang.sampleSpeech, lang.code === 'hi' ? 'hi' : 'en');
              }}
              className={`relative p-5 rounded-2xl text-left transition-all duration-200 flex flex-col justify-between h-34 select-none cursor-pointer border ${
                isSelected
                  ? 'border-teal-600 bg-teal-50/70 shadow-md ring-2 ring-teal-600/25 -translate-y-0.5'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block leading-tight">
                    {lang.nativeName}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 block">
                    {lang.englishName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-base">{lang.flagEmoji}</span>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-teal-700 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Hear Sample Voice Button */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/90">
                <span className="text-[11px] text-slate-400 font-medium truncate max-w-[140px]">
                  {lang.greeting}
                </span>

                <button
                  type="button"
                  onClick={(e) => handlePlayVoice(e, lang)}
                  title="Hear sample audio"
                  className="flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50/80 hover:bg-teal-100/80 px-2 py-1 rounded-lg transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Hear</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Large, Fixed Predictable Continue Button */}
      <div className="w-full max-w-md flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onNext}
          className="w-full py-4 px-8 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-extrabold text-base sm:text-lg rounded-2xl shadow-lg shadow-teal-700/20 hover:shadow-xl hover:shadow-teal-700/30 transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-98"
        >
          <span>
            {isHindi ? 'आगे बढ़ें' : 'Continue'}
          </span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>

        <p className="text-xs text-slate-400 font-medium text-center">
          {isHindi
            ? `चुनी गई भाषा: ${currentLang.nativeName} (${currentLang.englishName})`
            : `Selected language: ${currentLang.nativeName} (${currentLang.englishName})`}
        </p>
      </div>
    </div>
  );
};
