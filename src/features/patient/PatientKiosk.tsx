import React, { useState, useEffect } from 'react';
import { RotateCcw, Check, ArrowLeft, Loader2, Sparkles, Shield, Lock } from 'lucide-react';
import { ClinicalEncounter, LanguageCode, Patient, IntakeMode } from '../../types/client';
import { LanguageStep } from './LanguageStep';
import { IdentifyStep } from './IdentifyStep';
import { ConsentStep } from './ConsentStep';
import { InterviewStep } from './InterviewStep';
import { DocumentUploadStep } from './DocumentUploadStep';
import { ReviewSubmitStep } from './ReviewSubmitStep';
import { api } from '../../services/api';

interface PatientKioskProps {
  onOpenDoctorAuth: () => void;
  mode: IntakeMode;
  onModeChange: (mode: IntakeMode) => void;
}

export const PatientKiosk: React.FC<PatientKioskProps> = ({ onOpenDoctorAuth, mode, onModeChange }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [language, setLanguage] = useState<LanguageCode>('hi');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounter, setEncounter] = useState<ClinicalEncounter | null>(null);

  const steps = [
    { num: 1, labelHi: 'भाषा', labelEn: 'Language' },
    { num: 2, labelHi: 'पहचान (ABHA)', labelEn: 'Identity' },
    { num: 3, labelHi: 'सहमति', labelEn: 'Consent' },
    { num: 4, labelHi: 'बातचीत', labelEn: 'Conversation' },
    { num: 5, labelHi: 'दस्तावेज़', labelEn: 'Documents' },
    { num: 6, labelHi: 'टोकन पर्ची', labelEn: 'Token' },
  ];

  const isHindi = language === 'hi';

  // Reset function to clear session and return to step 1 for the next citizen
  const handleStartNewIntake = () => {
    setCurrentStep(1);
    setPatient(null);
    setEncounter(null);
    setLanguage('hi');
  };

  // When patient is identified, create or load active encounter
  const handlePatientIdentified = async (p: Patient) => {
    setPatient(p);
    try {
      const res = await api.createEncounter(p.id, mode, language);
      if (res.success) {
        setEncounter(res.data);
      }
    } catch (e) {
      console.error('Error creating encounter:', e);
    }
  };

  // Ensure patient exists if navigating forward
  useEffect(() => {
    if (currentStep >= 3 && !patient) {
      const defaultPatient: Patient = {
        id: 'PAT_001',
        abhaId: '91-8273-4412-9012',
        abhaAddress: 'ramesh.kumar54@abdm',
        name: 'Ramesh Kumar',
        age: 54,
        gender: 'MALE',
        phone: '+91 98765 43210',
        address: 'House No. 42, Sector 12, RK Puram, New Delhi',
        registeredAt: new Date().toISOString(),
      };
      setPatient(defaultPatient);
    }
  }, [currentStep, patient]);

  // Ensure encounter exists if navigating to step 4 or beyond
  useEffect(() => {
    if (currentStep >= 4 && !encounter) {
      const patId = patient?.id || 'PAT_001';
      api.createEncounter(patId, mode, language).then((res) => {
        if (res.success && res.data) {
          setEncounter(res.data);
        }
      }).catch((err) => {
        console.error('[PatientKiosk] Failed to auto-create encounter:', err);
      });
    }
  }, [currentStep, encounter, patient, mode, language]);

  const handleConsentGranted = async () => {
    if (encounter) {
      await api.updateConsent(encounter.id, 'GRANTED', 'AUDIO_GUIDED');
    }
    setCurrentStep(4);
  };

  const handleResetKiosk = () => {
    if (window.confirm(isHindi ? 'क्या आप नया पंजीकरण शुरू करना चाहते हैं?' : 'Reset kiosk to start a new patient intake?')) {
      handleStartNewIntake();
    }
  };

  const currentStepObj = steps.find((s) => s.num === currentStep) || steps[0];

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/70 flex flex-col justify-between">
      {/* Minimal Progressive Stepper (Calm, Non-Technical) */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-slate-200/80 py-3.5 px-4 sticky top-18 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          {/* Back Step Button */}
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{isHindi ? 'वापस जाएं' : 'Back'}</span>
            </button>
          ) : (
            <div className="w-16" />
          )}

          {/* Minimalist Progress Indicator: "Step X of 6" + Clean Track */}
          <div className="flex flex-col items-center gap-2 flex-1 max-w-md">
            <div className="flex items-center justify-between w-full text-xs">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="text-teal-700">
                  {isHindi ? `चरण ${currentStep}` : `Step ${currentStep}`}
                </span>
                <span className="text-slate-400 font-normal">
                  {isHindi ? 'कुल 6' : 'of 6'}
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="font-semibold text-slate-700">
                  {isHindi ? currentStepObj.labelHi : currentStepObj.labelEn}
                </span>
              </span>
              <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
                {Math.round((currentStep / 6) * 100)}%
              </span>
            </div>

            {/* Stepper Dots & Connected Bar */}
            <div className="flex items-center gap-1.5 w-full">
              {steps.map((s) => {
                const isDone = currentStep > s.num;
                const isCurrent = currentStep === s.num;
                return (
                  <div key={s.num} className="flex-1 flex items-center gap-1.5">
                    <div
                      onClick={() => isDone && setCurrentStep(s.num)}
                      className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                        isCurrent
                          ? 'bg-teal-600 ring-2 ring-teal-600/30 shadow-xs'
                          : isDone
                          ? 'bg-teal-700 cursor-pointer hover:bg-teal-800'
                          : 'bg-slate-200'
                      }`}
                      title={isHindi ? s.labelHi : s.labelEn}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quiet Reset / Restart Button */}
          <button
            type="button"
            onClick={handleResetKiosk}
            title={isHindi ? 'नया मरीज शुरू करें' : 'Start New Patient Intake'}
            className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isHindi ? 'प्रारंभ' : 'Restart'}</span>
          </button>
        </div>
      </div>

      {/* Main Step Render Container */}
      <main className="flex-1 flex flex-col justify-center py-6 px-4">
        {currentStep === 1 && (
          <LanguageStep
            selectedLanguage={language}
            onSelect={(lang) => setLanguage(lang)}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <IdentifyStep
            language={language}
            onPatientIdentified={handlePatientIdentified}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          patient ? (
            <ConsentStep
              language={language}
              patientName={patient.name}
              onConsentGranted={handleConsentGranted}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {isHindi ? 'नागरिक विवरण लोड हो रहा है...' : 'Loading patient profile...'}
              </p>
            </div>
          )
        )}

        {currentStep === 4 && (
          encounter ? (
            <InterviewStep
              encounter={encounter}
              language={language}
              onStateUpdated={(updated) => setEncounter(updated)}
              onNext={() => setCurrentStep(5)}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {isHindi ? 'क्लिनिकल साक्षात्कार लोड हो रहा है...' : 'Initializing clinical interview session...'}
              </p>
            </div>
          )
        )}

        {currentStep === 5 && (
          encounter ? (
            <DocumentUploadStep
              encounter={encounter}
              language={language}
              onStateUpdated={(updated) => setEncounter(updated)}
              onNext={() => setCurrentStep(6)}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {isHindi ? 'दस्तावेज़ प्रणाली लोड हो रही है...' : 'Loading document OCR system...'}
              </p>
            </div>
          )
        )}

        {currentStep === 6 && (
          encounter && patient ? (
            <ReviewSubmitStep
              encounter={encounter}
              patient={patient}
              language={language}
              onStartNewIntake={handleStartNewIntake}
              onOpenDoctorAuth={onOpenDoctorAuth}
            />
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {isHindi ? 'समीक्षा विवरण लोड हो रहे हैं...' : 'Loading summary review...'}
              </p>
            </div>
          )
        )}
      </main>

      {/* Discrete Hospital Staff Footer Note */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200/50 bg-white/40">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-teal-600" />
            <span>Digital India &bull; Ministry of Ayush &bull; ABDM Compliant</span>
          </span>
          <button
            type="button"
            onClick={onOpenDoctorAuth}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-[11px] flex items-center gap-1"
          >
            <Lock className="w-3 h-3" />
            <span>Staff Portal</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
