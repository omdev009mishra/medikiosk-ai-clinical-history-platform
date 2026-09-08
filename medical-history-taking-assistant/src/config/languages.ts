export interface LanguageItem {
  id: string;
  name: string;
  nativeName: string;
  speechRecognition: string; // BCP-47
  speechSynthesis: string; // BCP-47
  badge: string;
}

export const LANGUAGE_CONFIG: Record<string, LanguageItem> = {
  en: {
    id: 'en',
    name: 'English',
    nativeName: 'English',
    speechRecognition: 'en-IN',
    speechSynthesis: 'en-IN',
    badge: '🇬🇧',
  },
  hi: {
    id: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    speechRecognition: 'hi-IN',
    speechSynthesis: 'hi-IN',
    badge: '🇮🇳',
  },
  mr: {
    id: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    speechRecognition: 'mr-IN',
    speechSynthesis: 'mr-IN',
    badge: '🇮🇳',
  },
  bn: {
    id: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    speechRecognition: 'bn-IN',
    speechSynthesis: 'bn-IN',
    badge: '🇮🇳',
  },
  gu: {
    id: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    speechRecognition: 'gu-IN',
    speechSynthesis: 'gu-IN',
    badge: '🇮🇳',
  },
  pa: {
    id: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    speechRecognition: 'pa-IN',
    speechSynthesis: 'pa-IN',
    badge: '🇮🇳',
  },
  ta: {
    id: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    speechRecognition: 'ta-IN',
    speechSynthesis: 'ta-IN',
    badge: '🇮🇳',
  },
  te: {
    id: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    speechRecognition: 'te-IN',
    speechSynthesis: 'te-IN',
    badge: '🇮🇳',
  },
  kn: {
    id: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    speechRecognition: 'kn-IN',
    speechSynthesis: 'kn-IN',
    badge: '🇮🇳',
  },
  ml: {
    id: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    speechRecognition: 'ml-IN',
    speechSynthesis: 'ml-IN',
    badge: '🇮🇳',
  },
  ur: {
    id: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    speechRecognition: 'ur-IN',
    speechSynthesis: 'ur-IN',
    badge: '🇮🇳',
  },
  or: {
    id: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    speechRecognition: 'or-IN',
    speechSynthesis: 'or-IN',
    badge: '🇮🇳',
  },
  as: {
    id: 'as',
    name: 'Assamese',
    nativeName: 'অসমীয়া',
    speechRecognition: 'as-IN',
    speechSynthesis: 'as-IN',
    badge: '🇮🇳',
  },
};

export const AUTO_DETECT_LANGUAGE: LanguageItem = {
  id: 'auto',
  name: 'Auto Detect',
  nativeName: 'Auto Detect (स्वतः ओळख / स्वतः पहचान)',
  speechRecognition: 'en-IN',
  speechSynthesis: 'en-IN',
  badge: '🌐',
};

// Priority list for quick display on welcome screen
export const PRIMARY_LANGUAGES: LanguageItem[] = [
  LANGUAGE_CONFIG.en,
  LANGUAGE_CONFIG.hi,
  LANGUAGE_CONFIG.mr,
  LANGUAGE_CONFIG.bn,
  LANGUAGE_CONFIG.gu,
  LANGUAGE_CONFIG.pa,
  LANGUAGE_CONFIG.ta,
  LANGUAGE_CONFIG.te,
  LANGUAGE_CONFIG.kn,
  LANGUAGE_CONFIG.ml,
  LANGUAGE_CONFIG.ur,
];

// Additional languages accessible under "More languages"
export const MORE_LANGUAGES: LanguageItem[] = [
  LANGUAGE_CONFIG.or,
  LANGUAGE_CONFIG.as,
];

export function getLanguageConfig(langId?: string): LanguageItem {
  if (!langId || langId === 'auto') {
    return AUTO_DETECT_LANGUAGE;
  }
  return LANGUAGE_CONFIG[langId] || LANGUAGE_CONFIG.en;
}

// Localized helper labels for patient UI
export interface UiTranslations {
  chooseLanguage: string;
  autoDetectNotice: string;
  startIntake: string;
  typePlaceholder: string;
  tapToSpeak: string;
  tapToFinish: string;
  listening: string;
  speakNaturally: string;
  tryAgain: string;
  useAnswer: string;
  typeInstead: string;
  cancel: string;
  suggestedOptions: string;
  urgentCareNotice: string;
  intakeSummary: string;
  completeEarly: string;
  voiceOn: string;
  voiceOff: string;
  question: string;
  of: string;
}

export const UI_TRANSLATIONS: Record<string, UiTranslations> = {
  en: {
    chooseLanguage: 'Choose your language',
    autoDetectNotice: 'Language will be detected automatically from your first response',
    startIntake: 'I Understand — Start',
    typePlaceholder: 'Type your answer here (English, Hinglish, or your language)...',
    tapToSpeak: 'Tap to speak',
    tapToFinish: 'Tap to finish speaking',
    listening: 'Listening... Speak naturally',
    speakNaturally: 'Speak in English, Hinglish, or your preferred language',
    tryAgain: 'Try Again',
    useAnswer: 'Use Answer',
    typeInstead: 'Type Instead',
    cancel: 'Cancel',
    suggestedOptions: 'Suggested options (or speak/type below):',
    urgentCareNotice: 'Immediate Care Recommended',
    intakeSummary: 'Health Information Summary',
    completeEarly: 'Complete Early',
    voiceOn: 'Voice On',
    voiceOff: 'Voice Off',
    question: 'Question',
    of: 'of',
  },
  hi: {
    chooseLanguage: 'अपनी भाषा चुनें',
    autoDetectNotice: 'आपके पहले उत्तर से भाषा अपने आप पहचान ली जाएगी',
    startIntake: 'समझ गया — शुरू करें',
    typePlaceholder: 'यहाँ अपना उत्तर लिखें (हिन्दी, हिंग्लिश या कोई भी भाषा)...',
    tapToSpeak: 'बोलने के लिए दबाएं',
    tapToFinish: 'समाप्त करने के लिए दबाएं',
    listening: 'सुन रहा हूँ... बेझिझक बोलें',
    speakNaturally: 'आप हिन्दी या हिंग्लिश में स्वाभाविक रूप से बोल सकते हैं',
    tryAgain: 'फिर से बोलें',
    useAnswer: 'यह उत्तर चुनें',
    typeInstead: 'टाइप करके लिखें',
    cancel: 'रद्द करें',
    suggestedOptions: 'सुझाए गए विकल्प (या नीचे बोलें/लिखें):',
    urgentCareNotice: 'तत्काल चिकित्सा सहायता की आवश्यकता',
    intakeSummary: 'स्वास्थ्य जानकारी सारांश',
    completeEarly: 'जल्दी समाप्त करें',
    voiceOn: 'आवाज़ चालू',
    voiceOff: 'आवाज़ बंद',
    question: 'प्रश्न',
    of: 'का',
  },
  mr: {
    chooseLanguage: 'आपली भाषा निवडा',
    autoDetectNotice: 'आपल्या पहिल्या उत्तरावरून भाषा आपोआप ओळखली जाईल',
    startIntake: 'समजले — सुरू करा',
    typePlaceholder: 'येथे आपले उत्तर लिहा (मराठी किंवा कोणत्याही भाषेत)...',
    tapToSpeak: 'बोलण्यासाठी टॅप करा',
    tapToFinish: 'पूर्ण करण्यासाठी टॅप करा',
    listening: 'ऐकत आहे... सहजतेने बोला',
    speakNaturally: 'मराठीत किंवा आपल्या भाषेत सहजतेने बोला',
    tryAgain: 'पुन्हा प्रयत्न करा',
    useAnswer: 'हे उत्तर वापरा',
    typeInstead: 'टाइप करा',
    cancel: 'रद्द करा',
    suggestedOptions: 'सुचवलेले पर्याय (किंवा खाली बोला/लिहा):',
    urgentCareNotice: 'त्वरित वैद्यकीय सल्ला आवश्यक',
    intakeSummary: 'आरोग्य माहिती सारांश',
    completeEarly: 'लवकर पूर्ण करा',
    voiceOn: 'आवाज सुरू',
    voiceOff: 'आवाज बंद',
    question: 'प्रश्न',
    of: 'पैकी',
  },
};

export function getUiTranslations(langId: string): UiTranslations {
  return UI_TRANSLATIONS[langId] || UI_TRANSLATIONS.en;
}
