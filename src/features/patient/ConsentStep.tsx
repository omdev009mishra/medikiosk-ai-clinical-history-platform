import React, { useState } from 'react';
import { ShieldCheck, Volume2, CheckCircle2, ArrowRight, Shield, Lock, VolumeX } from 'lucide-react';
import { LanguageCode } from '../../types/client';
import { SpeechService } from '../../services/speech';

interface ConsentStepProps {
  language: LanguageCode;
  patientName: string;
  onConsentGranted: () => void;
}

export const ConsentStep: React.FC<ConsentStepProps> = ({
  language,
  patientName,
  onConsentGranted,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const isHindi = language === 'hi';

  const consentSpeechText = isHindi
    ? `नमस्ते ${patientName} जी। आपके स्वास्थ्य इतिहास और पुराने पर्चों की जानकारी केवल डॉक्टर के परामर्श और आयुष्मान भारत ई-हॉस्पिटल रिकॉर्ड के लिए सुरक्षित रखी जाएगी। क्या आप सहमति देते हैं?`
    : `Hello ${patientName}. Your clinical history and uploaded documents will be securely processed solely for your consultation with the physician and Ayushman Bharat health records. Do you grant consent?`;

  const handlePlayVoice = () => {
    if (isPlayingAudio) {
      SpeechService.stopSpeaking();
      setIsPlayingAudio(false);
      return;
    }
    setIsPlayingAudio(true);
    SpeechService.speak(consentSpeechText, isHindi ? 'hi' : 'en', () => {
      setIsPlayingAudio(false);
    });
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-4 flex flex-col items-center animate-in fade-in duration-300">
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {isHindi ? 'क्लिनिकल डेटा संग्रह सहमति' : 'Data Processing Consent'}
        </h2>
        <p className="text-sm text-slate-500 font-medium mt-1">
          {isHindi
            ? `नागरिक: ${patientName} &bull; डिजिटल व्यक्तिगत डेटा संरक्षण (DPDP)`
            : `Patient: ${patientName} &bull; DPDP Act 2023 & ABDM Compliant`}
        </p>
      </div>

      {/* Main Consent Card */}
      <div className="w-full bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm mb-6 space-y-6">
        {/* Audio Guidance Pill */}
        <div className="flex items-center justify-between bg-teal-50/70 border border-teal-200/70 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center">
              <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                {isHindi ? 'ऑडियो सहमति विवरण सुनें' : 'Listen to Spoken Consent'}
              </div>
              <div className="text-[11px] text-slate-500">
                {isHindi ? 'आपकी चुनी हुई भाषा में' : 'Read aloud in your language'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePlayVoice}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              isPlayingAudio
                ? 'bg-teal-800 text-white shadow-xs'
                : 'bg-white text-teal-800 border border-teal-300/80 hover:bg-teal-100/50 shadow-2xs'
            }`}
          >
            {isPlayingAudio ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>{isHindi ? 'रोकें' : 'Stop'}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isHindi ? 'सुनाएं' : 'Play'}</span>
              </>
            )}
          </button>
        </div>

        {/* Purpose Points */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900 font-bold block mb-0.5">
                {isHindi ? '1. क्लिनिकल इतिहास संकलन (Clinical History)' : '1. Clinical History Preparation'}
              </strong>
              {isHindi
                ? 'आपकी वर्तमान तकलीफ, दर्द व लक्षणों की जानकारी तैयार करके डॉक्टर के वर्कस्टेशन पर भेजी जाएगी।'
                : 'Your symptoms and health details will be organized for your attending physician.'}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900 font-bold block mb-0.5">
                {isHindi ? '2. सुरक्षित दस्तावेज पठन (Secure Document OCR)' : '2. Medical Document Analysis'}
              </strong>
              {isHindi
                ? 'अपलोड किए गए पुराने पर्चों या जांच रिपोर्टों से दवाइयों की जानकारी सुरक्षित रूप से निकाली जाएगी।'
                : 'Uploaded prescriptions or lab reports will be extracted to verify past medications.'}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900 font-bold block mb-0.5">
                {isHindi ? '3. गोपनीयता व सुरक्षा (Privacy Guarantee)' : '3. Privacy & ABDM Integration'}
              </strong>
              {isHindi
                ? 'यह जानकारी केवल आपके इलाज के लिए उपयोग होगी और किसी तीसरे पक्ष से साझा नहीं की जाएगी।'
                : 'Your health data is encrypted, strictly confidential, and protected under the DPDP Act.'}
            </div>
          </div>
        </div>

        {/* Primary Agreement Button */}
        <button
          type="button"
          onClick={onConsentGranted}
          className="w-full py-4 px-6 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-extrabold text-base rounded-2xl shadow-md shadow-teal-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-98"
        >
          <span>{isHindi ? 'मैं सहमति देता/देती हूँ &bull; आगे बढ़ें' : 'I Agree & Continue'}</span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
