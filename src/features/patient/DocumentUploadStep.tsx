import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Camera,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Eye,
  Pill,
  Activity,
  Calendar,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { ClinicalEncounter, LanguageCode, DocumentRecord } from '../../types/client';
import { api } from '../../services/api';

interface DocumentUploadStepProps {
  encounter: ClinicalEncounter;
  language: LanguageCode;
  onStateUpdated: (updatedEncounter: ClinicalEncounter) => void;
  onNext: () => void;
}

export const DocumentUploadStep: React.FC<DocumentUploadStepProps> = ({
  encounter,
  language,
  onStateUpdated,
  onNext,
}) => {
  const isHindi = language === 'hi';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [documentType, setDocumentType] = useState<'PRESCRIPTION' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'OTHER'>('LAB_REPORT');
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);

  // Quick Demo Samples
  const handleLoadSample = async (type: 'LIPID_REPORT' | 'AIIA_PRESCRIPTION') => {
    setUploading(true);
    try {
      if (type === 'LIPID_REPORT') {
        const sampleText = `METROPOLIS HEALTHCARE & AIIA LAB REPORT
Patient Name: ${encounter.patientId} | Date: 15-Aug-2026
TEST NAME               RESULT    UNIT     REFERENCE RANGE   STATUS
Serum Total Cholesterol 248       mg/dL    < 200 mg/dL       HIGH
Serum Triglycerides     210       mg/dL    < 150 mg/dL       HIGH
Serum LDL Cholesterol   165       mg/dL    < 100 mg/dL       HIGH
Serum HDL Cholesterol   38        mg/dL    > 40 mg/dL        LOW
Serum Creatinine        0.9       mg/dL    0.7 - 1.2 mg/dL   NORMAL
Impression: Mixed dyslipidemia with atherogenic risk.`;

        const res = await api.uploadDocument(encounter.id, {
          documentType: 'LAB_REPORT',
          fileName: 'Lipid_Panel_Report.pdf',
          rawText: sampleText,
        });

        if (res.success) {
          const updated: ClinicalEncounter = {
            ...encounter,
            documents: [...encounter.documents, res.data.document],
            timeline: res.data.allTimeline,
          };
          onStateUpdated(updated);
          setPreviewDoc(res.data.document);
        }
      } else {
        const sampleRx = `ALL INDIA INSTITUTE OF AYURVEDA (AIIA) OPD
Department of Kayachikitsa | Date: 12-May-2026
Diagnosis: Ardhavabhedaka / Vata-Pitta Shiroroga (Migraine)
Rx:
1. Cap. Brahmi Rasayana - 500mg BD with warm milk (60 days)
2. Pathyadi Kwatha - 20ml BD with equal warm water before meals (30 days)
3. Tab. Sutshekhar Rasa - 1 tab BD after food
Advice: Avoid direct sunlight (Atapa), avoid spicy fried food (Vidahi Ahara).`;

        const res = await api.uploadDocument(encounter.id, {
          documentType: 'PRESCRIPTION',
          fileName: 'AIIA_Prescription.jpg',
          rawText: sampleRx,
        });

        if (res.success) {
          const updated: ClinicalEncounter = {
            ...encounter,
            documents: [...encounter.documents, res.data.document],
            timeline: res.data.allTimeline,
          };
          onStateUpdated(updated);
          setPreviewDoc(res.data.document);
        }
      }
    } catch (e) {
      console.error('Sample upload error:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploading(true);
      try {
        const res = await api.uploadDocument(encounter.id, {
          documentType,
          fileName: file.name,
          mimeType: file.type,
          base64Data: base64,
        });

        if (res.success) {
          const updated: ClinicalEncounter = {
            ...encounter,
            documents: [...encounter.documents, res.data.document],
            timeline: res.data.allTimeline,
          };
          onStateUpdated(updated);
          setPreviewDoc(res.data.document);
        }
      } catch (err) {
        console.error('File upload error:', err);
      } finally {
        setUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-4 flex flex-col items-center animate-in fade-in duration-300">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Headline & Subtext */}
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {isHindi ? 'क्या आपके पास पुराने मेडिकल पर्चे या रिपोर्ट हैं?' : 'Do you have previous medical reports?'}
        </h2>
        <p className="text-sm sm:text-base text-slate-500 font-medium mt-2 max-w-lg mx-auto">
          {isHindi
            ? 'आप उन्हें स्कैन या अपलोड कर सकते हैं, हम डॉक्टर के लिए जानकारी व्यवस्थित कर देंगे।'
            : 'You can upload them and we will organize the information for your doctor.'}
        </p>
      </div>

      {/* Loading Animation: "We are reading your medical document..." */}
      {uploading ? (
        <div className="w-full bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm my-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto shadow-inner">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {isHindi ? 'हम आपके मेडिकल दस्तावेज़ को पढ़ रहे हैं...' : 'We are reading your medical document...'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isHindi
              ? 'दवाइयों के नाम, खुराक व लैब रिपोर्ट के मान सुरक्षित रूप से निकाले जा रहे हैं।'
              : 'Safely organizing prescriptions, lab values, and history for your doctor.'}
          </p>
        </div>
      ) : (
        /* Main Action Grid */
        <div className="w-full space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Scan Document Option */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-6 bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-400 rounded-3xl text-left transition-all flex flex-col justify-between h-44 shadow-xs hover:shadow-md cursor-pointer group active:scale-98"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-50 group-hover:bg-teal-700 text-teal-700 group-hover:text-white flex items-center justify-center transition-colors">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-bold text-slate-900 block group-hover:text-teal-900">
                  {isHindi ? '📷 दस्तावेज़ स्कैन करें' : 'Scan Document'}
                </span>
                <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                  {isHindi ? 'कैमरे से पर्चे की फोटो लें' : 'Use kiosk camera to capture slip'}
                </span>
              </div>
            </button>

            {/* Upload File Option */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-6 bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-400 rounded-3xl text-left transition-all flex flex-col justify-between h-44 shadow-xs hover:shadow-md cursor-pointer group active:scale-98"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-50 group-hover:bg-teal-700 text-teal-700 group-hover:text-white flex items-center justify-center transition-colors">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-bold text-slate-900 block group-hover:text-teal-900">
                  {isHindi ? '📁 फ़ाइल अपलोड करें' : 'Upload File'}
                </span>
                <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                  {isHindi ? 'PDF या इमेज फ़ाइल चुनें' : 'Upload PDF, JPG, or PNG report'}
                </span>
              </div>
            </button>
          </div>

          {/* Quick Demo Test Buttons */}
          <div className="bg-slate-100/80 border border-slate-200/80 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                <span>{isHindi ? 'त्वरित डेमो परीक्षण रिपोर्ट' : 'One-Click Demo Test Reports'}</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Quick OCR demo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleLoadSample('LIPID_REPORT')}
                className="p-3 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl text-left text-xs font-bold text-slate-900 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>📄 Lipid Panel Report (Abnormal)</span>
                <span className="text-[10px] text-teal-700 font-semibold">Load</span>
              </button>

              <button
                type="button"
                onClick={() => handleLoadSample('AIIA_PRESCRIPTION')}
                className="p-3 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl text-left text-xs font-bold text-slate-900 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>📄 AIIA Ayurvedic Prescription</span>
                <span className="text-[10px] text-teal-700 font-semibold">Load</span>
              </button>
            </div>
          </div>

          {/* Scanned Document Preview (If uploaded) */}
          {previewDoc && (
            <div className="bg-white rounded-3xl border border-teal-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-teal-900">
                  <FileCheck className="w-4 h-4 text-teal-700" />
                  <span>{previewDoc.fileName}</span>
                </span>
                <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                  Successfully Read
                </span>
              </div>

              {previewDoc.extractedEntities?.medications && previewDoc.extractedEntities.medications.length > 0 && (
                <div className="pt-2 border-t border-slate-100 text-xs">
                  <span className="font-semibold text-slate-500 block mb-1">Identified Medicines:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {previewDoc.extractedEntities.medications.map((m, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/70 font-semibold text-[11px]">
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation: Skip for now vs Continue */}
      <div className="w-full flex items-center justify-between pt-8 border-t border-slate-200/70 mt-6">
        <button
          type="button"
          onClick={onNext}
          className="text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 px-4 py-2 rounded-xl transition-colors cursor-pointer"
        >
          {isHindi ? 'अभी छोड़ें (Skip for now)' : 'Skip for now'}
        </button>

        <button
          type="button"
          onClick={onNext}
          className="py-3.5 px-6 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold text-sm rounded-2xl shadow-sm transition-all flex items-center gap-2 cursor-pointer transform active:scale-98"
        >
          <span>{isHindi ? 'आगे बढ़ें' : 'Continue'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
