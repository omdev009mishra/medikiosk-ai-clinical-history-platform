import React, { useState, useEffect } from 'react';
import { Activity, Users, FileCheck2, Clock, AlertTriangle, ShieldCheck, Database, Cpu, Mic, FileSearch } from 'lucide-react';
import { api } from '../../services/api';

export const HospitalDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboardOverview();
      if (res.success) {
        setData(res.data);
      }
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs font-bold text-slate-500">
        Loading Hospital Workflow Dashboard...
      </div>
    );
  }

  if (!data) return null;

  const { activity, reviewQueueBreakdown, doctorTriage, systemHealth } = data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-extrabold bg-indigo-50 text-indigo-700 uppercase tracking-wider mb-2">
            OPD Operations & AI Governance
          </span>
          <h1 className="text-xl font-black text-slate-900">Hospital OPD Workflow Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time patient throughput, review queue monitoring, and local AI node health.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold ${systemHealth.overallStatus === 'healthy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            <span>System Status: {systemHealth.overallStatus.toUpperCase()}</span>
          </span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Total Registered Patients</span>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{activity.totalPatients}</div>
          <div className="text-2xs text-slate-500 font-semibold mt-1">Unique Hospital IDs</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Total OPD Encounters</span>
            <Activity className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{activity.totalEncounters}</div>
          <div className="text-2xs text-slate-500 font-semibold mt-1">{activity.activeEncounters} Active &bull; {activity.completedEncounters} Verified</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Awaiting Doctor Review</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{activity.waitingForReview}</div>
          <div className="text-2xs text-slate-500 font-semibold mt-1">Ready in Doctor Workstation</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Open Review Items</span>
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600">{reviewQueueBreakdown.totalOpenItems}</div>
          <div className="text-2xs text-slate-500 font-semibold mt-1">
            {reviewQueueBreakdown.urgent} Urgent &bull; {reviewQueueBreakdown.high} High Priority
          </div>
        </div>
      </div>

      {/* Service Health Grid */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Local AI Infrastructure & Database Health</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xs font-extrabold text-slate-500 uppercase">Database</div>
              <div className="text-xs font-black text-slate-900">{systemHealth.database.engine}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xs font-extrabold text-slate-500 uppercase">Local Ollama AI</div>
              <div className="text-xs font-black text-slate-900">qwen2.5:7b & medgemma</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xs font-extrabold text-slate-500 uppercase">Faster-Whisper</div>
              <div className="text-xs font-black text-slate-900">Speech Microservice :8001</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <FileSearch className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xs font-extrabold text-slate-500 uppercase">PaddleOCR</div>
              <div className="text-xs font-black text-slate-900">OCR Microservice :8002</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
