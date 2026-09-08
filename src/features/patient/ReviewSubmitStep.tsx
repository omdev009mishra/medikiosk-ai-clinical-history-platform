import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Printer,
  Sparkles,
  RefreshCw,
  Building2,
  Calendar,
  AlertTriangle,
  FileCheck,
  Stethoscope,
  ArrowRight,
  Clock,
  Check,
  HeartPulse,
} from 'lucide-react';
import { ClinicalEncounter, LanguageCode, Patient } from '../../types/client';
import { api } from '../../services/api';
import { SpeechService } from '../../services/speech';

interface ReviewSubmitStepProps {
  encounter: ClinicalEncounter;
  patient: Patient;
  language: LanguageCode;
  onStartNewIntake: () => void;
  onOpenDoctorAuth?: () => void;
}

export const ReviewSubmitStep: React.FC<ReviewSubmitStepProps> = ({
  encounter,
  patient,
  language,
  onStartNewIntake,
  onOpenDoctorAuth,
}) => {
  const isHindi = language === 'hi';
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoResetTimer, setAutoResetTimer] = useState<number>(45);

  // Auto-reset countdown once submitted so the kiosk is ready for the next patient in line
  useEffect(() => {
    let interval: any = null;
    if (submitted) {
      interval = setInterval(() => {
        setAutoResetTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            onStartNewIntake();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [submitted, onStartNewIntake]);

  const handleSubmitIntake = async () => {
    setGenerating(true);
    try {
      // Trigger AI summary generation
      const res = await api.generateSummary(encounter.id);
      if (res.success) {
        setSubmitted(true);
        const speechMsg = isHindi
          ? `धन्यवाद ${patient.name} जी। आपका टोकन नंबर ${encounter.tokenNumber} है। आपकी जानकारी डॉक्टर के पास भेज दी गई है।`
          : `Thank you ${patient.name}. Your OPD token number is ${encounter.tokenNumber}. Your information has been securely prepared for the doctor.`;
        SpeechService.speak(speechMsg, isHindi ? 'hi' : 'en');
      }
    } catch (e) {
      console.error('Error finalizing intake:', e);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-4 flex flex-col items-center animate-in fade-in duration-300">
      {!submitted ? (
        /* Pre-submission confirmation card */
        <div className="w-full bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <HeartPulse className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isHindi ? 'केस समीक्षा व टोकन जारी करें' : 'Review & Generate Token'}
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {isHindi
                ? 'डॉक्टर के लिए आपकी केस हिस्ट्री तैयार कर ली गई है'
                : 'Your intake details are organized and ready for the attending physician'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-semibold">{isHindi ? 'मरीज का नाम:' : 'Patient Name:'}</span>
              <strong className="text-slate-900">{patient.name} ({patient.age} / {patient.gender})</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-semibold">{isHindi ? 'आभा संख्या:' : 'ABHA ID:'}</span>
              <span className="font-mono text-slate-700">{patient.abhaId || 'Direct Kiosk Registration'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-semibold">{isHindi ? 'मुख्य समस्या:' : 'Chief Complaint:'}</span>
              <span className="text-teal-900 font-bold">{encounter.chiefComplaint?.value || 'Recorded via clinical interview'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmitIntake}
            disabled={generating}
            className="w-full py-4 px-6 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-extrabold text-base sm:text-lg rounded-2xl shadow-md shadow-teal-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-98"
          >
            {generating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{isHindi ? 'टोकन तैयार हो रहा है...' : 'Preparing Doctor Token...'}</span>
              </>
            ) : (
              <>
                <span>{isHindi ? 'टोकन जारी करें और समाप्त करें' : 'Generate Token & Finish'}</span>
                <ArrowRight className="w-5 h-5 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>
      ) : (
        /* The Clean Success / Token Screen */
        <div className="w-full bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-md text-center space-y-8 animate-in zoom-in-95 duration-300">
          {/* Emerald Checkmark Badge */}
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center mx-auto shadow-xs">
            <Check className="w-10 h-10 stroke-[3]" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {isHindi ? 'आप पूरी तरह तैयार हैं!' : "You're all set!"}
            </h2>
            <p className="text-sm sm:text-base text-slate-500 font-medium max-w-md mx-auto">
              {isHindi
                ? 'आपकी जानकारी सुरक्षित रूप से डॉक्टर के वर्कस्टेशन पर भेज दी गई है।'
                : 'Your information has been securely prepared for the doctor.'}
            </p>
          </div>

          {/* Token Card */}
          <div className="max-w-sm mx-auto bg-slate-50/90 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-2 shadow-inner">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
              {isHindi ? 'आपका टोकन' : 'Your Token'}
            </span>
            <span className="text-4xl sm:text-6xl font-black text-teal-800 tracking-tight block font-mono">
              {encounter.tokenNumber || 'A-101'}
            </span>
            <span className="text-xs font-semibold text-slate-600 block pt-2">
              {isHindi
                ? 'कृपया परामर्श के लिए ओपीडी लाउंज में प्रतीक्षा करें।'
                : 'Please wait for your consultation.'}
            </span>
            <span className="text-[11px] text-teal-700 font-bold block">
              Assigned: Chamber 108 (Dr. Alok Verma)
            </span>
          </div>

          {/* Actions: Print Token & Done */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto pt-2">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto flex-1 py-3.5 px-6 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-extrabold text-sm rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>{isHindi ? 'पर्ची प्रिंट करें' : 'Print Token'}</span>
            </button>

            <button
              type="button"
              onClick={onStartNewIntake}
              className="w-full sm:w-auto flex-1 py-3.5 px-8 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-extrabold text-sm rounded-2xl shadow-md shadow-teal-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isHindi ? 'पूर्ण' : 'Done'}</span>
              <Check className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* Auto-reset timer hint */}
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1.5 pt-4 border-t border-slate-100">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {isHindi
                ? `कियोस्क ${autoResetTimer} सेकंड में अगले मरीज के लिए रीसेट हो जाएगा`
                : `Kiosk will reset for the next patient in ${autoResetTimer}s`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
