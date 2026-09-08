import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileCode, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface FHIRViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounterId?: string;
}

export const FHIRViewerModal: React.FC<FHIRViewerModalProps> = ({ isOpen, onClose, encounterId = 'ENC_001' }) => {
  const [bundleData, setBundleData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFHIR();
    }
  }, [isOpen, encounterId]);

  const loadFHIR = async () => {
    setLoading(true);
    try {
      const res = await api.getFHIRBundle(encounterId);
      if (res.success) {
        setBundleData(res.data);
      }
    } catch (e) {
      console.error('Error fetching FHIR Bundle:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!bundleData) return;
    navigator.clipboard.writeText(JSON.stringify(bundleData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                ABDM &bull; FHIR R4 Health Document Bundle
              </h2>
              <p className="text-xs text-slate-500">
                Encounter ID: <span className="font-mono text-slate-700">{encounterId}</span> &bull; Profile: ABDM Clinical Consultation Document
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ABDM Status Badge */}
        <div className="bg-teal-50 border-b border-teal-100 px-6 py-2.5 flex items-center justify-between text-xs text-teal-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>Standard compliant: <b>HL7 FHIR Release 4 &bull; Ayush EHR Specification</b></span>
          </div>
          <span className="bg-teal-200/60 text-teal-900 font-mono text-[11px] px-2 py-0.5 rounded">
            ResourceType: Bundle (type=document)
          </span>
        </div>

        {/* Content Viewer */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950 font-mono text-xs text-emerald-400">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Generating and validating FHIR R4 Bundle...
            </div>
          ) : bundleData ? (
            <pre className="whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(bundleData, null, 2)}
            </pre>
          ) : (
            <div className="text-slate-400 text-center py-12">
              No FHIR Bundle generated yet. Complete encounter history to export.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>ABDM Gateway Compatibility: v0.5 / Health-Information Bridge</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
