import React, { useState } from 'react';
import {
  X,
  UserPlus,
  ShieldCheck,
  Building2,
  Stethoscope,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Phone,
  Mail,
  Award,
} from 'lucide-react';
import { DoctorUser } from '../../types/client';
import { api } from '../../services/api';

interface DoctorRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDoctor: DoctorUser) => void;
}

const COUNCIL_OPTIONS = [
  'National Medical Commission (NMC)',
  'Delhi Medical Council (DMC)',
  'Maharashtra Medical Council (MMC)',
  'Karnataka Medical Council (KMC)',
  'National Commission for Indian System of Medicine (NCISM / AYUSH)',
  'Central Council of Indian Medicine (CCIM)',
  'National Commission for Homoeopathy (NCH)',
];

const DEPARTMENT_OPTIONS = [
  'General Medicine & Emergency Triage',
  'Kayachikitsa & AYUSH OPD',
  'Cardiology & Critical Care',
  'Orthopedics & Joint Care',
  'Pediatrics & Child Health',
  'Pulmonology & Respiratory Medicine',
  'Shalya Tantra / Surgery & Wound Care',
  'Panchakarma Specialty Clinic',
  'Neurology & Neuro-Medicine',
];

const CHAMBER_OPTIONS = [
  'Chamber 101 (Ground Floor)',
  'Chamber 102 (ICU Annex)',
  'Chamber 108 (Ground Floor - Emergency)',
  'Chamber 201 (First Floor)',
  'Chamber 204 (First Floor - AYUSH Wing)',
  'Chamber 301 (Second Floor)',
  'Chamber 305 (Specialty OPD)',
];

export const DoctorRegisterModal: React.FC<DoctorRegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [hprId, setHprId] = useState('');
  const [council, setCouncil] = useState(COUNCIL_OPTIONS[0]);
  const [qualification, setQualification] = useState('MBBS, MD (General Medicine)');
  const [department, setDepartment] = useState(DEPARTMENT_OPTIONS[0]);
  const [chamber, setChamber] = useState(CHAMBER_OPTIONS[0]);
  const [role, setRole] = useState<'PHYSICIAN' | 'CHIEF_CONSULTANT' | 'RESIDENT'>('PHYSICIAN');
  const [phone, setPhone] = useState('+91 98');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('1234');
  
  const [isVerifyingHPR, setIsVerifyingHPR] = useState(false);
  const [hprVerified, setHprVerified] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleVerifyHPR = async () => {
    setError('');
    setIsVerifyingHPR(true);
    try {
      const simulatedHpr = hprId.trim() || `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const simulatedReg = regNo.trim() || `MCI-2022-${Math.floor(10000 + Math.random() * 90000)}`;
      
      const res = await api.verifyHPR(simulatedHpr, simulatedReg, council);
      if (res.success && res.verified) {
        setHprId(res.data.hprId);
        if (!regNo.trim()) setRegNo(res.data.regNo);
        setHprVerified(true);
      } else {
        setError('HPR registry verification failed. Please check credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to ABDM HPR Gateway');
    } finally {
      setIsVerifyingHPR(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide Doctor Full Name');
      return;
    }
    if (!regNo.trim()) {
      setError('Please provide Medical Council Registration Number');
      return;
    }
    if (!pin || pin.length < 4) {
      setError('Please set a 4-digit Clinical PIN (e.g. 1234)');
      return;
    }

    setLoading(true);
    try {
      const generatedHpr = hprId.trim() || `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const payload: Partial<DoctorUser> = {
        name: name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`,
        regNo: regNo.trim(),
        hprId: generatedHpr,
        council,
        qualification,
        department,
        chamber,
        role,
        phone: phone.trim(),
        email: email.trim() || `${name.toLowerCase().replace(/[^a-z]/g, '')}@hospital.gov.in`,
        pin: pin.trim(),
        status: 'ON_DUTY',
      };

      const res = await api.registerDoctor(payload);
      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.error?.message || 'Failed to register doctor in hospital directory.');
      }
    } catch (err: any) {
      setError(err.message || 'Server error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center text-indigo-200 shadow-inner">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Register Healthcare Professional
                </h3>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  HPR / ABDM
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Hospital Facility Registry (HFR) &bull; National Professional Credentialing
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: HPR Registry Verification Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                ABDM Healthcare Professional Registry (HPR) Link
              </span>
              {hprVerified && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> HPR Verified
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  ABDM HPR ID (Optional / Auto-Generate)
                </label>
                <input
                  type="text"
                  value={hprId}
                  onChange={(e) => {
                    setHprId(e.target.value);
                    setHprVerified(false);
                  }}
                  placeholder="e.g. 91-8839-2041-9981"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Medical Council Reg. Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regNo}
                  onChange={(e) => {
                    setRegNo(e.target.value);
                    setHprVerified(false);
                  }}
                  placeholder="e.g. MCI-2020-94812 or AYUSH-DEL-102"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-500">
                Verifies against National Medical Commission &amp; AYUSH Council database
              </div>
              <button
                type="button"
                onClick={handleVerifyHPR}
                disabled={isVerifyingHPR}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isVerifyingHPR ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Verify HPR ID</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Physician Profile */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-indigo-600" />
              Doctor Profile &amp; Credentials
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Institutional Role / Title
                </label>
                <select
                  value={role}
                  onChange={(e: any) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="PHYSICIAN">Attending Physician</option>
                  <option value="CHIEF_CONSULTANT">Chief Consultant / HoD</option>
                  <option value="RESIDENT">Senior Resident</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Medical Qualifications / Degrees
                </label>
                <input
                  type="text"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="e.g. MBBS, MD (Medicine), DNB"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Licensing Medical Council / Board
                </label>
                <select
                  value={council}
                  onChange={(e) => setCouncil(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  {COUNCIL_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Hospital OPD Assignment */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              OPD Department &amp; Chamber Allocation
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Clinical Department <span className="text-rose-500">*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Assigned OPD Chamber Room <span className="text-rose-500">*</span>
                </label>
                <select
                  value={chamber}
                  onChange={(e) => setChamber(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  {CHAMBER_OPTIONS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Contact Phone (Official)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98111 22334"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Official Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@hospital.gov.in"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Security Clinical PIN */}
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-700" />
                Initial 4-Digit Clinical Workstation PIN <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-amber-800">Doctor will use this PIN to log in</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="1234"
                className="w-36 px-4 py-2 text-base font-mono font-bold tracking-widest text-center bg-white border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <span className="text-xs text-slate-600">
                Default demo PIN is <strong>1234</strong>. Doctor can change PIN via Admin desk.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Enroll &amp; Provision Doctor Access</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
