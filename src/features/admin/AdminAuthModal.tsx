import React, { useState } from 'react';
import {
  ShieldAlert,
  KeyRound,
  Lock,
  Building2,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { AdminUser } from '../../types/client';
import { api } from '../../services/api';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (admin: AdminUser) => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState<string>('9999');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!pin || pin.length < 4) {
      setError('Please enter 4-digit Administrator Key (Default: 9999)');
      return;
    }

    setLoading(true);
    try {
      const res = await api.loginAdmin(pin);
      if (res.success && res.admin) {
        onSuccess(res.admin);
      } else {
        setError(res.error?.message || 'Invalid Administrator Security PIN. (Default: 9999)');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Institutional Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-6 relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Hospital Admin Portal
                </h3>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  HFR / HPR
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Medical Superintendent &bull; Facility Credentialing Desk
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-5">
          {/* Institutional Context */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Building2 className="w-4 h-4 text-indigo-700" />
              <span>Facility: All India Institute of Ayurveda (AIIA)</span>
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              Health Facility Registry (HFR) ID: <strong className="text-slate-800">IN-DL-AIIA-00912</strong>
            </div>
            <div className="text-slate-600 text-[11px] pt-1 border-t border-slate-200">
              Responsible for enrolling physicians, verifying HPR &amp; State Medical Council credentials, room allocations, and DPDP compliance auditing.
            </div>
          </div>

          {/* Admin Security PIN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                Administrator Security PIN
              </label>
              <span className="text-[11px] text-slate-500">
                Demo Key: <strong>9999</strong>
              </span>
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
                placeholder="Enter 4-digit Master PIN (9999)"
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-base font-mono tracking-widest focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setPin('9999')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200"
              >
                Auto-Fill 9999
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md shadow-slate-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Unlock Admin Desk</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
