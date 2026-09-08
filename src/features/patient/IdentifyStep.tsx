import React, { useState } from 'react';
import { UserCheck, QrCode, Sparkles, CheckCircle2, AlertCircle, ArrowRight, UserPlus, Phone, Shield, Search } from 'lucide-react';
import { Patient, LanguageCode } from '../../types/client';
import { api } from '../../services/api';

interface IdentifyStepProps {
  language: LanguageCode;
  onPatientIdentified: (patient: Patient) => void;
  onNext: () => void;
}

export const IdentifyStep: React.FC<IdentifyStepProps> = ({ language, onPatientIdentified, onNext }) => {
  const [abhaInput, setAbhaInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showRegForm, setShowRegForm] = useState(false);

  // New patient registration form state
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    phone: '',
    address: '',
    abhaId: '',
  });

  const isHindi = language === 'hi';

  // Demo Patients Pre-loader
  const handleLoadDemoPatient = (type: 'A' | 'B') => {
    if (type === 'A') {
      const p: Patient = {
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
      onPatientIdentified(p);
      setSuccessMsg(isHindi ? 'मरीज लोड हुआ: रमेश कुमार (सीने में दर्द)' : 'Loaded Patient: Ramesh Kumar (Chest Pain)');
      setTimeout(() => onNext(), 350);
    } else {
      const p: Patient = {
        id: 'PAT_002',
        abhaId: '91-1122-3344-5566',
        abhaAddress: 'sunita.devi@abdm',
        name: 'Sunita Devi',
        age: 42,
        gender: 'FEMALE',
        phone: '+91 98112 33445',
        address: 'A-21, Sarita Vihar, New Delhi',
        registeredAt: new Date().toISOString(),
      };
      onPatientIdentified(p);
      setSuccessMsg(isHindi ? 'मरीज लोड हुआ: सुनीता देवी (आयुष सिरदर्द)' : 'Loaded Patient: Sunita Devi (AYUSH Headache)');
      setTimeout(() => onNext(), 350);
    }
  };

  const handleVerifyABHA = async () => {
    if (!abhaInput.trim()) {
      setErrorMsg(isHindi ? 'कृपया आभा संख्या या पता दर्ज करें' : 'Please enter ABHA Number or Address');
      return;
    }

    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await api.verifyABHA(abhaInput.trim());
      if (res.success && res.data) {
        onPatientIdentified(res.data);
        setSuccessMsg(isHindi ? `आभा सत्यापित: ${res.data.name}` : `ABHA Verified: ${res.data.name}`);
        setTimeout(() => onNext(), 400);
      } else {
        setErrorMsg(res.error || (isHindi ? 'आभा संख्या नहीं मिली' : 'ABHA ID not found in ABDM registry'));
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Verification service error');
    } finally {
      setVerifying(false);
    }
  };

  const handleRegisterNewPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.age || !formData.phone) {
      setErrorMsg(isHindi ? 'कृपया सभी अनिवार्य जानकारी भरें' : 'Please fill all required fields');
      return;
    }

    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await api.createPatient({
        name: formData.name,
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        phone: formData.phone,
        address: formData.address || undefined,
        abhaId: formData.abhaId || undefined,
      });

      if (res.success && res.data) {
        onPatientIdentified(res.data);
        setSuccessMsg(isHindi ? 'नया मरीज पंजीकृत हुआ!' : 'Patient registered successfully!');
        setTimeout(() => onNext(), 400);
      } else {
        setErrorMsg(res.error || 'Failed to register patient');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Registration failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-4 flex flex-col items-center animate-in fade-in duration-300">
      {/* Step Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {isHindi ? 'मरीज पहचान / आभा संख्या' : 'Patient Identification'}
        </h2>
        <p className="text-sm text-slate-500 font-medium mt-1">
          {isHindi
            ? 'आयुष्मान भारत स्वास्थ्य खाता (ABHA) या मोबाइल नंबर दर्ज करें'
            : 'Enter Ayushman Bharat Health Account (ABHA) or Mobile Number'}
        </p>
      </div>

      {/* Quick Test Demo Patients Banner */}
      <div className="w-full bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 mb-6 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-teal-700" />
            <span>{isHindi ? 'त्वरित परीक्षण डेमो मरीज' : 'Quick One-Click Demo Profiles'}</span>
          </span>
          <span className="text-[11px] font-semibold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-full">
            Ready to test
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleLoadDemoPatient('A')}
            className="p-3 bg-white hover:bg-teal-50 border border-teal-200/70 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div>
              <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-teal-900">
                👤 Ramesh Kumar (54 M)
              </div>
              <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                Acute Chest Pain &bull; Triage Alert
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            type="button"
            onClick={() => handleLoadDemoPatient('B')}
            className="p-3 bg-white hover:bg-teal-50 border border-teal-200/70 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
          >
            <div>
              <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-teal-900">
                👤 Sunita Devi (42 F)
              </div>
              <div className="text-[11px] text-teal-700 font-semibold mt-0.5">
                Chronic Headache &bull; AYUSH Mode
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Main Identification Card */}
      <div className="w-full bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm">
        {!showRegForm ? (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                {isHindi ? 'आभा संख्या / पता या फोन नंबर' : 'ABHA Number, ABHA Address or Mobile'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={abhaInput}
                  onChange={(e) => setAbhaInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyABHA()}
                  placeholder={isHindi ? 'उदा. 91-8273-4412-9012 या नाम@abdm' : 'e.g. 91-8273-4412-9012 or name@abdm'}
                  className="w-full text-base sm:text-lg font-bold p-4 bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 focus:outline-hidden transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleVerifyABHA}
                  disabled={verifying}
                  className="absolute right-2 top-2 bottom-2 px-5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>{verifying ? (isHindi ? 'जांच...' : 'Verifying...') : (isHindi ? 'सत्यापित करें' : 'Verify')}</span>
                </button>
              </div>
            </div>

            {/* Status alerts */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* QR Scan or Manual Register Switch */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={() => handleLoadDemoPatient('A')}
                className="text-slate-600 hover:text-teal-700 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-teal-600" />
                <span>{isHindi ? 'ABHA QR कोड स्कैन करें' : 'Simulate ABHA QR Scan'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRegForm(true)}
                className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isHindi ? 'आभा नहीं है? नया पंजीकरण करें' : 'No ABHA? Register New Patient'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* New Patient Registration Form */
          <form onSubmit={handleRegisterNewPatient} className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-sm font-extrabold text-slate-900">
                {isHindi ? 'नया मरीज विवरण' : 'New Patient Registration'}
              </span>
              <button
                type="button"
                onClick={() => setShowRegForm(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
              >
                &larr; {isHindi ? 'वापस' : 'Back to ABHA Search'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {isHindi ? 'मरीज का नाम *' : 'Patient Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  placeholder="e.g. Anand Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {isHindi ? 'उम्र (Age) *' : 'Age (Years) *'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="120"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  placeholder="e.g. 45"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {isHindi ? 'लिंग (Gender) *' : 'Gender *'}
                </label>
                <select
                  value={formData.gender}
                  onChange={(e: any) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value="MALE">Male (पुरुष)</option>
                  <option value="FEMALE">Female (महिला)</option>
                  <option value="OTHER">Other (अन्य)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {isHindi ? 'मोबाइल नंबर *' : 'Mobile Number *'}
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-sm rounded-xl shadow-sm transition-colors mt-2"
            >
              {verifying ? (isHindi ? 'सहेज रहे हैं...' : 'Registering...') : (isHindi ? 'पंजीकरण पूरा करें और आगे बढ़ें →' : 'Register & Continue →')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
