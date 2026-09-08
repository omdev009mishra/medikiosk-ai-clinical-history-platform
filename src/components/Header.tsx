import React, { useState } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  FileCode,
  AlertTriangle,
  Building2,
  LogOut,
  Lock,
  ShieldAlert,
  HelpCircle,
  PhoneCall,
  Activity,
  HeartPulse,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import { DoctorUser, AdminUser } from '../types/client';

interface HeaderProps {
  currentView: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  onViewChange: (view: 'PATIENT' | 'DOCTOR' | 'ADMIN') => void;
  onOpenAudit: () => void;
  onOpenFHIR: () => void;
  activeRedFlagsCount?: number;
  mode: 'GENERAL' | 'AYUSH';
  onModeChange: (mode: 'GENERAL' | 'AYUSH') => void;
  authenticatedDoctor: DoctorUser | null;
  onDoctorLogout: () => void;
  onOpenDoctorLogin: () => void;
  authenticatedAdmin: AdminUser | null;
  onAdminLogout: () => void;
  onOpenAdminLogin: () => void;
  doctorSubView?: 'LANDING' | 'QUEUE';
  onDoctorSubViewChange?: (view: 'LANDING' | 'QUEUE') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onOpenAudit,
  onOpenFHIR,
  activeRedFlagsCount = 0,
  mode,
  onModeChange,
  authenticatedDoctor,
  onDoctorLogout,
  onOpenDoctorLogin,
  authenticatedAdmin,
  onAdminLogout,
  onOpenAdminLogin,
  doctorSubView = 'LANDING',
  onDoctorSubViewChange,
}) => {
  const [showStaffMenu, setShowStaffMenu] = useState(false);

  // =========================================================================
  // 1. PATIENT KIOSK HEADER: Pure, minimal, calm, ZERO internal buttons
  // =========================================================================
  if (currentView === 'PATIENT') {
    return (
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Brand & Hospital Affiliation */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-teal-700/15">
              <HeartPulse className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900">
                  MediKiosk
                </span>
                <span className="hidden sm:inline-flex items-center text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/70 px-2 py-0.5 rounded-full">
                  AI Clinical Intake
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                National Health Authority &bull; ABDM Enabled
              </p>
            </div>
          </div>

          {/* Center Subtle Ayush / General Mode Switcher (Quiet pills) */}
          <div className="hidden md:flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => onModeChange('GENERAL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                mode === 'GENERAL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              General OPD
            </button>
            <button
              type="button"
              onClick={() => onModeChange('AYUSH')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                mode === 'AYUSH'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              AYUSH (दशविध परीक्षा)
            </button>
          </div>

          {/* Right Header: Help, Emergency Support & Discreet Staff Access */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl font-medium">
              <PhoneCall className="w-3.5 h-3.5 text-teal-600" />
              <span>OPD Helpline: <strong>1075</strong></span>
            </div>

            {/* Subtle Staff Entry (Hidden from normal patient view, discreet lock) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStaffMenu(!showStaffMenu)}
                title="Hospital Staff Entry (PIN required)"
                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
              </button>

              {showStaffMenu && (
                <div
                  onMouseLeave={() => setShowStaffMenu(false)}
                  className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs animate-in fade-in slide-in-from-top-1"
                >
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                    Hospital Staff Access
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffMenu(false);
                      if (authenticatedDoctor) {
                        onViewChange('DOCTOR');
                      } else {
                        onOpenDoctorLogin();
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-teal-50 hover:text-teal-800 rounded-xl font-semibold transition-colors text-left"
                  >
                    <Stethoscope className="w-4 h-4 text-teal-600" />
                    <span>Doctor Workstation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffMenu(false);
                      if (authenticatedAdmin) {
                        onViewChange('ADMIN');
                      } else {
                        onOpenAdminLogin();
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl font-semibold transition-colors text-left"
                  >
                    <ShieldAlert className="w-4 h-4 text-slate-500" />
                    <span>Admin Portal</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }

  // =========================================================================
  // 2. DOCTOR WORKSTATION HEADER: Professional, clinical, uncluttered
  // =========================================================================
  if (currentView === 'DOCTOR') {
    return (
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Left: MediKiosk Clinical Logo & Chamber */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onDoctorSubViewChange?.('LANDING')}
              className="flex items-center gap-3 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-700 flex items-center justify-center text-white shadow-sm shadow-teal-700/20 group-hover:bg-teal-800 transition-colors">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold text-slate-900 tracking-tight">
                    MediKiosk
                  </span>
                  <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full">
                    Clinical Intelligence
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {authenticatedDoctor?.chamber || 'Chamber 108'} &bull; {authenticatedDoctor?.department || 'General Medicine'}
                </p>
              </div>
            </button>
          </div>

          {/* Center: Doctor Sub-navigation (Landing vs Queue) + Emergency Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => onDoctorSubViewChange?.('LANDING')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  doctorSubView === 'LANDING'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-teal-600" />
                <span>Overview</span>
              </button>
              <button
                type="button"
                onClick={() => onDoctorSubViewChange?.('QUEUE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  doctorSubView === 'QUEUE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-teal-600" />
                <span>Patient Queue</span>
              </button>
            </div>

            {activeRedFlagsCount > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>{activeRedFlagsCount} Emergency Alert</span>
              </div>
            )}
          </div>

          {/* Right: Tools & Doctor Profile */}
          <div className="flex items-center gap-2.5">
            {/* FHIR ABDM Modal Trigger */}
            <button
              type="button"
              onClick={onOpenFHIR}
              title="Inspect ABDM FHIR R4 Bundle"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-teal-700" />
              <span>FHIR R4</span>
            </button>

            {/* Audit Log Modal Trigger */}
            <button
              type="button"
              onClick={onOpenAudit}
              title="View DPDP Audit Trail"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Audit Trail</span>
            </button>

            {/* Doctor Profile Pill */}
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-xs">
                {authenticatedDoctor?.avatarInitials || 'AV'}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <span className="text-xs font-bold text-slate-900 block">
                  {authenticatedDoctor?.name || 'Dr. Alok Verma'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {authenticatedDoctor?.regNo || 'MCI-2014-98124'}
                </span>
              </div>
              <button
                type="button"
                onClick={onDoctorLogout}
                title="Log out physician"
                className="ml-1 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // =========================================================================
  // 3. ADMIN PORTAL HEADER
  // =========================================================================
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight">MediKiosk</span>
              <span className="text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Hospital Administration
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Health Facility Registry (HFR) &bull; AIIA Central OPD
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onViewChange('PATIENT')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
          >
            Return to Kiosk
          </button>

          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <span className="font-bold text-amber-300">
              {authenticatedAdmin?.name || 'Admin'}
            </span>
            <button
              type="button"
              onClick={onAdminLogout}
              title="Log out admin"
              className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
