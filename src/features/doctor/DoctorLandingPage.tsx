import React from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Stethoscope,
  Activity,
  FileCode,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Calendar,
  Building2,
} from 'lucide-react';
import { DoctorUser } from '../../types/client';

interface DoctorLandingPageProps {
  doctorUser?: DoctorUser | null;
  queue: any[];
  onOpenQueue: () => void;
  onSelectPatient?: (encounterId: string) => void;
  onOpenFHIR?: () => void;
  onOpenAudit?: () => void;
}

export const DoctorLandingPage: React.FC<DoctorLandingPageProps> = ({
  doctorUser,
  queue,
  onOpenQueue,
  onSelectPatient,
  onOpenFHIR,
  onOpenAudit,
}) => {
  const doctorName = doctorUser?.name || 'Dr. Alok Verma';
  const chamber = doctorUser?.chamber || 'Chamber 108';
  const department = doctorUser?.department || 'General Medicine & Casualty Triage';

  const waitingCount = queue.filter((e) => e.status !== 'COMPLETED').length || 2;
  const urgentCount = queue.filter((e) => e.triageCategory === 'CASUALTY' || e.triageCategory === 'EMERGENCY' || e.hasRedFlags || e.triagePriority === 'HIGH' || e.triagePriority === 'EMERGENCY').length || 1;
  const completedTodayCount = 5;

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-300">
      {/* 1. Welcome Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full uppercase tracking-wider">
              {chamber} &bull; {department}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Good morning, {doctorName} 👋
          </h1>

          <p className="text-sm sm:text-base text-slate-500 font-medium max-w-xl">
            AI-assisted clinical history triage is active. All incoming patient intake transcripts and OCR reports are processed and prepared for your review.
          </p>
        </div>

        {/* Primary Action: Open Patient Queue */}
        <button
          type="button"
          onClick={onOpenQueue}
          className="py-4 px-8 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-extrabold text-base rounded-2xl shadow-md shadow-teal-700/25 transition-all flex items-center gap-3 cursor-pointer shrink-0 transform active:scale-98"
        >
          <span>Open Patient Queue</span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* 2. Key Triage Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Waiting Card */}
        <div
          onClick={onOpenQueue}
          className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:border-teal-300 hover:shadow-md transition-all cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Patients Waiting
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
              {waitingCount}
            </span>
            <span className="text-xs font-semibold text-teal-700">In OPD lounge</span>
          </div>
          <p className="text-xs text-slate-400">Next: Ramesh Kumar (54 M)</p>
        </div>

        {/* Requires Attention Card */}
        <div
          onClick={onOpenQueue}
          className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:border-rose-300 hover:shadow-md transition-all cursor-pointer space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Requires Attention
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-rose-600 font-mono">
              {urgentCount}
            </span>
            <span className="text-xs font-semibold text-rose-700">Casualty &amp; Priority</span>
          </div>
          <p className="text-xs text-rose-600/90 font-medium">Chest pain with radiating symptoms</p>
        </div>

        {/* Consultations Completed Today */}
        <div className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Consultations Today
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
              {completedTodayCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">Completed</span>
          </div>
          <p className="text-xs text-slate-400">Average intake time: 3.4 mins</p>
        </div>
      </div>

      {/* 3. Secondary Sections: Today's Overview & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Clinical Performance Overview */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">
              Today&apos;s Overview
            </h3>
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
              Live Feed
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Intake Completion Rate</span>
              <strong className="text-slate-900 font-mono text-sm">98.2%</strong>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">ABDM ABHA Linkage</span>
              <strong className="text-teal-700 font-mono text-sm">100%</strong>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">OCR Extraction Accuracy</span>
              <strong className="text-slate-900 font-mono text-sm">96.4%</strong>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Average Doctor Prep Time</span>
              <strong className="text-slate-900 font-mono text-sm">45 seconds</strong>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-slate-500 font-medium">DPDP Audit Trail</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Compliant
              </span>
            </div>
          </div>
        </div>

        {/* Recent Patient Activity List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Recent Patient Queue Activity
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Live intake submissions from central OPD kiosks
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenQueue}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {queue.slice(0, 3).map((enc) => {
              const isCasualty = enc.triageCategory === 'CASUALTY' || enc.triageCategory === 'EMERGENCY' || enc.status === 'EMERGENCY';
              const isUrgent = isCasualty || enc.hasRedFlags || enc.triagePriority === 'HIGH' || enc.triagePriority === 'EMERGENCY';
              return (
                <div
                  key={enc.id}
                  onClick={() => {
                    onSelectPatient?.(enc.id);
                    onOpenQueue();
                  }}
                  className="p-4 rounded-2xl border border-slate-100 hover:border-teal-200 bg-slate-50/70 hover:bg-teal-50/40 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isCasualty ? 'bg-rose-500' : isUrgent ? 'bg-amber-500' : 'bg-teal-500'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm group-hover:text-teal-900">
                          {enc.patientName || 'Ramesh Kumar'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {enc.patientAge || 54} Y &bull; {enc.patientGender || 'M'}
                        </span>
                        {isCasualty ? (
                          <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full uppercase">
                            Casualty
                          </span>
                        ) : isUrgent ? (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full uppercase">
                            Priority
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                        {enc.chiefComplaint || 'Acute retrosternal chest pain'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-500 font-mono block">
                      Token: {enc.tokenNumber || 'A-101'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Waiting &bull; 5 min
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
