import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  Lock,
  UserCheck,
  AlertCircle,
  Building2,
  X,
  CheckCircle2,
  KeyRound,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { DoctorUser } from '../../types/client';
import { api } from '../../services/api';

interface DoctorAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (doctor: DoctorUser) => void;
}

export const PRESET_DOCTORS: DoctorUser[] = [
  {
    id: 'DOC_DR_VERMA',
    name: 'Dr. Alok Verma',
    regNo: 'MCI-2014-98124',
    hprId: '91-8839-2041-9981',
    department: 'General Medicine & Emergency Triage',
    chamber: 'Chamber 108',
    role: 'CHIEF_CONSULTANT',
    avatarInitials: 'AV',
    status: 'ON_DUTY',
    pin: '1234',
  },
  {
    id: 'DOC_DR_KULKARNI',
    name: 'Dr. Sneha Kulkarni',
    regNo: 'AYUSH-DEL-2016-441',
    hprId: '91-4402-9912-1104',
    department: 'Kayachikitsa & AYUSH OPD',
    chamber: 'Chamber 204',
    role: 'PHYSICIAN',
    avatarInitials: 'SK',
    status: 'ON_DUTY',
    pin: '1234',
  },
  {
    id: 'DOC_DR_NAIR',
    name: 'Dr. Priya Nair',
    regNo: 'MCI-2018-77219',
    hprId: '91-7719-3320-5592',
    department: 'Cardiology & Critical Care',
    chamber: 'Chamber 102',
    role: 'CHIEF_CONSULTANT',
    avatarInitials: 'PN',
    status: 'ON_DUTY',
    pin: '1234',
  },
];

export const DoctorAuthModal: React.FC<DoctorAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [doctorList, setDoctorList] = useState<DoctorUser[]>(PRESET_DOCTORS);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('DOC_DR_VERMA');
  const [pin, setPin] = useState<string>('1234');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [customMode, setCustomMode] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customReg, setCustomReg] = useState<string>('');
  const [customDept, setCustomDept] = useState<string>('General Medicine');
  const [customChamber, setCustomChamber] = useState<string>('Chamber 108');

  useEffect(() => {
    if (isOpen) {
      loadRegisteredDoctors();
    }
  }, [isOpen]);

  const loadRegisteredDoctors = async () => {
    try {
      const res = await api.getDoctors();
      if (res.success && res.data && res.data.length > 0) {
        setDoctorList(res.data);
        if (!res.data.some((d) => d.id === selectedDoctorId)) {
          setSelectedDoctorId(res.data[0].id);
        }
      }
    } catch (e) {
      // Keep preset list on failure
    }
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (customMode) {
      if (!customName.trim()) {
        setError('Please enter physician name');
        return;
      }
      const customDoctor: DoctorUser = {
        id: `DOC_${Date.now()}`,
        name: customName.startsWith('Dr.') ? customName : `Dr. ${customName}`,
        regNo: customReg || `MCI-${Math.floor(100000 + Math.random() * 900000)}`,
        hprId: `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
        department: customDept,
        chamber: customChamber,
        role: 'PHYSICIAN',
        avatarInitials: customName.slice(0, 2).toUpperCase(),
        status: 'ON_DUTY',
      };
      onSuccess(customDoctor);
      return;
    }

    const doc = doctorList.find((d) => d.id === selectedDoctorId) || doctorList[0];
    
    // Check PIN: matches doc.pin or '1234'
    const expectedPin = doc.pin || '1234';
    if (pin !== expectedPin && pin !== '1234') {
      setError(`Invalid Clinical PIN for ${doc.name}. (Default: ${expectedPin})`);
      return;
    }

    if (doc.status === 'SUSPENDED') {
      setError(`Physician access for ${doc.name} is currently SUSPENDED by Hospital Administration.`);
      return;
    }

    onSuccess(doc);
  };

  const handleQuickSelect = (doc: DoctorUser) => {
    setSelectedDoctorId(doc.id);
    setCustomMode(false);
    setPin(doc.pin || '1234');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Institutional Header */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-teal-600/40 border border-teal-400/30 flex items-center justify-center text-teal-200 shadow-inner">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Physician Authentication
                </h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  ABDM HPR
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Hospital Information System (HIS) &bull; Restricted Doctor Access
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-5">
          {/* Security Notice */}
          <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-teal-950">
            <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">DPDP Act &amp; Medical Privacy Protocol:</span>
              Patient case histories and confidential clinical summaries are restricted to authorized healthcare professionals only.
            </div>
          </div>

          {/* Physician Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Select Registered Physician Profile
              </label>
              <button
                type="button"
                onClick={() => {
                  setCustomMode(!customMode);
                  setError('');
                }}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
              >
                {customMode ? '← Choose from Preset List' : '+ Enter Custom Doctor ID'}
              </button>
            </div>

            {!customMode ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {doctorList.map((doc) => {
                  const isSelected = selectedDoctorId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleQuickSelect(doc)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-teal-700 bg-teal-50/60 ring-2 ring-teal-700/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isSelected
                              ? 'bg-teal-700 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {doc.avatarInitials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{doc.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>{doc.department}</span>
                            <span>&bull;</span>
                            <span className="font-medium text-teal-900">{doc.chamber}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-[11px] font-mono text-slate-400">
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-teal-700" />
                        ) : (
                          <span>{doc.regNo}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Physician Full Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Sharma"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={customDept}
                      onChange={(e) => setCustomDept(e.target.value)}
                      placeholder="e.g. General Medicine"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      OPD Chamber #
                    </label>
                    <input
                      type="text"
                      value={customChamber}
                      onChange={(e) => setCustomChamber(e.target.value)}
                      placeholder="e.g. Chamber 108"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Clinical Security PIN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-teal-700" />
                Physician Security PIN
              </label>
              <span className="text-[11px] text-slate-500">Demo PIN: <strong>1234</strong></span>
            </div>
            <div className="relative">
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                placeholder="Enter 4-digit Clinical PIN (1234)"
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-base font-mono tracking-widest focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setPin('1234')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 px-2 py-1 rounded-lg cursor-pointer"
              >
                Auto-Fill 1234
              </button>
            </div>
            {error && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 transition-colors cursor-pointer"
            >
              Cancel &bull; Return to Kiosk
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-md shadow-teal-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Authenticate &amp; Open</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
