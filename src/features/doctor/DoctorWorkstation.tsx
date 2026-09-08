import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Edit3,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Clock,
  User,
  Shield,
  FileText,
  Pill,
  Activity,
  History,
  Send,
  Building2,
  Calendar,
  Layers,
  Search,
  Eye,
  Flag,
  AlertOctagon,
  Info,
} from 'lucide-react';
import {
  ClinicalEncounter,
  Patient,
  AIClinicalSummary,
  RedFlagAlert,
  DoctorUser,
  ClinicalBrief,
  ClinicalAuditEvent,
  ClinicalFact,
} from '../../types/client';
import { api } from '../../services/api';
import { DoctorLandingPage } from './DoctorLandingPage';

interface DoctorWorkstationProps {
  onOpenFHIR: (encounterId: string) => void;
  onOpenAudit: () => void;
  doctorUser?: DoctorUser | null;
  onLogout?: () => void;
  doctorSubView?: 'LANDING' | 'QUEUE';
  onDoctorSubViewChange?: (view: 'LANDING' | 'QUEUE') => void;
}

export const DoctorWorkstation: React.FC<DoctorWorkstationProps> = ({
  onOpenFHIR,
  onOpenAudit,
  doctorUser,
  onLogout,
  doctorSubView: controlledSubView,
  onDoctorSubViewChange,
}) => {
  const [internalSubView, setInternalSubView] = useState<'LANDING' | 'QUEUE'>('LANDING');
  const doctorSubView = controlledSubView ?? internalSubView;
  const setDoctorSubView = onDoctorSubViewChange ?? setInternalSubView;
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'CASUALTY' | 'PRIORITY' | 'ROUTINE'>('ALL');
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>('ENC_001');
  const [currentEncounter, setCurrentEncounter] = useState<ClinicalEncounter | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'BRIEF' | 'SUMMARY' | 'VALIDATION' | 'HPI' | 'AYUSH' | 'DOCUMENTS' | 'TIMELINE'>('BRIEF');

  // Phase 5 State
  const [clinicalBrief, setClinicalBrief] = useState<ClinicalBrief | null>(null);
  const [auditTrail, setAuditTrail] = useState<ClinicalAuditEvent[]>([]);
  const [traceableFact, setTraceableFact] = useState<ClinicalFact | null>(null);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editFactValue, setEditFactValue] = useState<string>('');

  // Doctor editing summary state
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [doctorNotes, setDoctorNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  const handleResolveReviewItem = async (reviewId: string) => {
    if (!currentEncounter) return;
    setActionLoading(true);
    try {
      const res = await api.resolveReviewItem(currentEncounter.id, reviewId, doctor.id, 'Verified and reconciled by attending physician.');
      if (res.success) {
        setCurrentEncounter({
          ...currentEncounter,
          validation: res.data,
        });
        setSuccessToast('Clinical contradiction / review item resolved.');
        setTimeout(() => setSuccessToast(''), 3000);
      }
    } catch (e) {
      console.error('Error resolving review item:', e);
    } finally {
      setActionLoading(false);
    }
  };

  // Active Doctor profile with fallback
  const doctor = doctorUser || {
    id: 'DOC_DR_VERMA',
    name: 'Dr. Alok Verma',
    regNo: 'MCI-2014-98124',
    hprId: '91-8839-2041-9981',
    department: 'General Medicine & Casualty Triage',
    chamber: 'Chamber 108',
    role: 'CHIEF_CONSULTANT' as const,
    avatarInitials: 'AV',
  };

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (selectedEncounterId) {
      loadEncounterDetails(selectedEncounterId);
    }
  }, [selectedEncounterId]);

  const loadQueue = async () => {
    try {
      const res = await api.getDoctorQueue();
      if (res.success) {
        setQueue(res.data);
        if (res.data.length > 0 && !selectedEncounterId) {
          setSelectedEncounterId(res.data[0].id);
        }
      }
    } catch (e) {
      console.error('Error loading doctor queue:', e);
    }
  };

  const loadEncounterDetails = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.getEncounter(id);
      if (res.success) {
        setCurrentEncounter(res.data.encounter);
        setCurrentPatient(res.data.patient);
        if (res.data.encounter.summary) {
          setEditedSections({ ...res.data.encounter.summary.sections });
          setDoctorNotes(res.data.encounter.summary.doctorNotes || '');
        }
      }
      await refreshClinicalBrief(id);
    } catch (e) {
      console.error('Error loading encounter:', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshClinicalBrief = async (encounterId: string) => {
    try {
      const [briefRes, auditRes] = await Promise.all([
        api.getClinicalBrief(encounterId),
        api.getAuditTrail(encounterId),
      ]);

      if (briefRes.success) setClinicalBrief(briefRes.data);
      if (auditRes.success) setAuditTrail(auditRes.data);
    } catch (e) {
      console.error('Error fetching clinical brief or audit trail:', e);
    }
  };

  const handleDoctorConfirmFact = async (factId: string) => {
    if (!currentEncounter) return;
    setActionLoading(true);
    try {
      const res = await api.doctorConfirmFact(currentEncounter.id, factId);
      if (res.success) {
        setSuccessToast('Fact verified by attending physician.');
        await loadEncounterDetails(currentEncounter.id);
        setTimeout(() => setSuccessToast(''), 3000);
      }
    } catch (e) {
      console.error('Error confirming fact:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDoctorEditFact = async (factId: string) => {
    if (!currentEncounter || !editFactValue.trim()) return;
    setActionLoading(true);
    try {
      const res = await api.doctorEditFact(currentEncounter.id, factId, editFactValue.trim());
      if (res.success) {
        setSuccessToast('Fact corrected and verified by physician.');
        setEditingFactId(null);
        setEditFactValue('');
        await loadEncounterDetails(currentEncounter.id);
        setTimeout(() => setSuccessToast(''), 3000);
      }
    } catch (e) {
      console.error('Error editing fact:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDoctorRejectFact = async (factId: string) => {
    if (!currentEncounter) return;
    setActionLoading(true);
    try {
      const res = await api.doctorRejectFact(currentEncounter.id, factId, 'Rejected by physician');
      if (res.success) {
        setSuccessToast('Fact rejected by physician.');
        await loadEncounterDetails(currentEncounter.id);
        setTimeout(() => setSuccessToast(''), 3000);
      }
    } catch (e) {
      console.error('Error rejecting fact:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDoctorFlagFact = async (factId: string) => {
    if (!currentEncounter) return;
    setActionLoading(true);
    try {
      const res = await api.doctorFlagFact(currentEncounter.id, factId);
      if (res.success) {
        setSuccessToast('Fact flagged for senior consultant review.');
        await loadEncounterDetails(currentEncounter.id);
        setTimeout(() => setSuccessToast(''), 3000);
      }
    } catch (e) {
      console.error('Error flagging fact:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!currentEncounter) return;
    setActionLoading(true);
    try {
      const res = await api.generateSummary(currentEncounter.id);
      if (res.success) {
        setCurrentEncounter({
          ...currentEncounter,
          summary: res.data,
          status: 'AWAITING_DOCTOR_REVIEW',
        });
        setEditedSections({ ...res.data.sections });
        setSuccessToast('AI Clinical Summary generated successfully!');
        setTimeout(() => setSuccessToast(''), 3000);
        loadQueue();
      }
    } catch (e) {
      console.error('Error generating summary:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!currentEncounter) return;
    setActionLoading(true);
    try {
      const res = await api.editSummary(currentEncounter.id, editedSections, doctorNotes);
      if (res.success) {
        setCurrentEncounter({
          ...currentEncounter,
          summary: res.data,
        });
        setIsEditingSummary(false);
        setSuccessToast('Clinical Summary edits saved.');
        setTimeout(() => setSuccessToast(''), 3000);
      }
    } catch (e) {
      console.error('Error saving edits:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmVerification = async () => {
    if (!currentEncounter) return;
    setActionLoading(true);
    try {
      const res = await api.confirmSummary(currentEncounter.id, doctor.id, doctorNotes);
      if (res.success) {
        setCurrentEncounter({
          ...currentEncounter,
          summary: res.data.summary,
          status: 'VERIFIED',
          hisSyncStatus: 'SYNCED',
        });
        setSuccessToast('Summary VERIFIED, Digitally Signed & Pushed to ABDM and e-Hospital!');
        setTimeout(() => setSuccessToast(''), 4000);
        loadQueue();
      }
    } catch (e) {
      console.error('Error confirming summary:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSummary = async () => {
    const reason = window.prompt('Enter reason for rejecting this AI summary:', 'Incomplete clinical history provided by patient.');
    if (!reason || !currentEncounter) return;

    setActionLoading(true);
    try {
      const res = await api.rejectSummary(currentEncounter.id, doctor.id, reason);
      if (res.success) {
        setCurrentEncounter({
          ...currentEncounter,
          summary: res.data,
          status: 'REJECTED',
        });
        setSuccessToast('Summary marked as REJECTED.');
        setTimeout(() => setSuccessToast(''), 3000);
        loadQueue();
      }
    } catch (e) {
      console.error('Error rejecting summary:', e);
    } finally {
      setActionLoading(false);
    }
  };

  // 1. DEDICATED DOCTOR LANDING PAGE ENTRY
  if (doctorSubView === 'LANDING') {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-slate-50/70 pb-12">
        {/* Toast Notification */}
        {successToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-teal-800 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-bold animate-fade-in border border-teal-600">
            <CheckCircle2 className="w-5 h-5 text-teal-300" />
            <span>{successToast}</span>
          </div>
        )}
        <DoctorLandingPage
          doctorUser={doctor}
          queue={queue}
          onOpenQueue={() => setDoctorSubView('QUEUE')}
          onSelectPatient={(id) => {
            setSelectedEncounterId(id);
            setDoctorSubView('QUEUE');
          }}
          onOpenFHIR={() => onOpenFHIR(selectedEncounterId)}
          onOpenAudit={onOpenAudit}
        />
      </div>
    );
  }

  // Triage category counts
  const casualtyCount = queue.filter(
    (item) => item.triageCategory === 'CASUALTY' || item.triageCategory === 'EMERGENCY' || item.status === 'EMERGENCY' || item.triagePriority === 'EMERGENCY' || item.isEmergency
  ).length;

  const priorityCount = queue.filter(
    (item) =>
      (item.triageCategory === 'PRIORITY' || item.triagePriority === 'HIGH' || item.hasRedFlags) &&
      item.triageCategory !== 'CASUALTY' &&
      item.triageCategory !== 'EMERGENCY' &&
      item.status !== 'EMERGENCY'
  ).length;

  const routineCount = queue.filter(
    (item) =>
      item.triageCategory === 'ROUTINE' ||
      (!item.hasRedFlags && item.triagePriority !== 'HIGH' && item.triagePriority !== 'EMERGENCY' && item.status !== 'EMERGENCY' && item.triageCategory !== 'CASUALTY')
  ).length;

  // Filtered queue for fast searching & triage category segmentation
  const filteredQueue = queue.filter((item) => {
    const isCas = item.triageCategory === 'CASUALTY' || item.triageCategory === 'EMERGENCY' || item.status === 'EMERGENCY' || item.triagePriority === 'EMERGENCY' || item.isEmergency;
    const isPr = (item.triageCategory === 'PRIORITY' || item.triagePriority === 'HIGH' || item.hasRedFlags) && !isCas;

    if (queueFilter === 'CASUALTY' && !isCas) return false;
    if (queueFilter === 'PRIORITY' && !isPr) return false;
    if (queueFilter === 'ROUTINE' && (isCas || isPr)) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.patientName?.toLowerCase().includes(query) ||
      item.tokenNumber?.toLowerCase().includes(query) ||
      item.chiefComplaint?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-teal-800 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-bold animate-fade-in border border-teal-600">
          <CheckCircle2 className="w-5 h-5 text-teal-300" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Clinical Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDoctorSubView('LANDING')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>&larr; Overview</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                OPD Clinical Workstation
              </h2>
              <span className="text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/80 px-2 py-0.5 rounded-full">
                {doctor.chamber}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Attending: <strong className="text-slate-700">{doctor.name}</strong> &bull; HPR ID: <span className="font-mono text-slate-600">{doctor.hprId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs">
          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-teal-600 focus:outline-hidden w-44 sm:w-56"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <button
            type="button"
            onClick={() => onOpenFHIR(selectedEncounterId)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 rounded-xl font-bold transition-colors cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-teal-700" />
            <span>FHIR Bundle</span>
          </button>

          <button
            type="button"
            onClick={loadQueue}
            title="Refresh patient queue"
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Two-Panel Clinical Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Patient Queue (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Patient Queue
              </h3>
              {casualtyCount > 0 && (
                <p className="text-[11px] text-slate-500 font-medium">
                  Casualty patients are pinned to the top.
                </p>
              )}
            </div>
            <span className="text-xs font-mono font-bold bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
              {filteredQueue.length} shown
            </span>
          </div>

          {/* Queue Segmentation Filter Tabs */}
          <div className="p-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-1 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setQueueFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                queueFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({queue.length})
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('CASUALTY')}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                queueFilter === 'CASUALTY'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-50/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Casualty ({casualtyCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('PRIORITY')}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                queueFilter === 'PRIORITY'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs'
                  : 'text-amber-700 hover:bg-amber-50/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Priority ({priorityCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter('ROUTINE')}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                queueFilter === 'ROUTINE'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs'
                  : 'text-teal-700 hover:bg-teal-50/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <span>Normal ({routineCount})</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
            {filteredQueue.map((item) => {
              const isSelected = item.id === selectedEncounterId;
              const isCasualty = item.triageCategory === 'CASUALTY' || item.triageCategory === 'EMERGENCY' || item.status === 'EMERGENCY' || item.triagePriority === 'EMERGENCY' || item.isEmergency;
              const isPriority = (item.triageCategory === 'PRIORITY' || item.triagePriority === 'HIGH' || item.hasRedFlags) && !isCasualty;
              const isVerified = item.status === 'VERIFIED';

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedEncounterId(item.id)}
                  className={`p-4 cursor-pointer transition-all relative flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-100/90 border-l-4 border-teal-700 shadow-2xs'
                      : 'hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Subtle Triage Indicator Dot */}
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                        isCasualty
                          ? 'bg-rose-500'
                          : isPriority
                          ? 'bg-amber-500'
                          : isVerified
                          ? 'bg-emerald-500'
                          : 'bg-slate-300'
                      }`}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-slate-900 truncate">
                          {item.patientName}
                        </strong>
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {item.tokenNumber}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-slate-600 truncate mt-0.5">
                        {item.chiefComplaint || 'Clinical intake in progress'}
                      </p>

                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                        <span>{item.age}Y / {item.gender}</span>
                        <span>&bull;</span>
                        <span>Waiting &bull; 5 min</span>
                      </div>
                    </div>
                  </div>

                  {/* Subtle category badge */}
                  {isCasualty ? (
                    <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full uppercase shrink-0">
                      Casualty
                    </span>
                  ) : isPriority ? (
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full uppercase shrink-0">
                      Priority
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full uppercase shrink-0">
                      Normal
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Detailed Clinical Intake & Physician Summary Review (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mb-2" />
              <span>Loading structured patient encounter...</span>
            </div>
          ) : currentEncounter && currentPatient ? (
            <>
              {/* Patient Banner with Demographics & ABHA */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 mb-3.5">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-xl font-extrabold text-slate-900">{currentPatient.name}</h3>
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Token: {currentEncounter.tokenNumber}
                      </span>
                      <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <Shield className="w-3 h-3 text-teal-600" />
                        ABDM-VERIFIED
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Age: <b className="text-slate-800">{currentPatient.age} Y</b> &bull; Gender: <b className="text-slate-800">{currentPatient.gender}</b> &bull; ABHA: <span className="font-mono text-teal-800 font-bold">{currentPatient.abhaId || '91-8273-4412-9012'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-xl ${
                        currentEncounter.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      Status: {currentEncounter.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Clinical Red Flag Assessment if Triggered */}
                {currentEncounter.alerts && currentEncounter.alerts.length > 0 && (
                  <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 text-rose-900 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                            CASUALTY CLINICAL RED-FLAG
                          </span>
                          <span className="font-bold text-sm text-rose-950">
                            {currentEncounter.alerts[0].title}
                          </span>
                        </div>
                        <p className="text-xs text-rose-900 mt-1 font-medium">
                          <b>Rationale:</b> {currentEncounter.alerts[0].description}
                        </p>
                        <p className="text-xs text-rose-950 font-bold mt-1">
                          👉 Recommended Clinical Action: {currentEncounter.alerts[0].recommendedAction}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section Navigation Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-2 text-xs font-bold scrollbar-none">
                  <button
                    onClick={() => setActiveTab('BRIEF')}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'BRIEF'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Clinical Brief</span>
                    {clinicalBrief?.reviewSummary?.urgentAlertsCount ? (
                      <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                        {clinicalBrief.reviewSummary.urgentAlertsCount}
                      </span>
                    ) : null}
                  </button>

                  <button
                    onClick={() => setActiveTab('SUMMARY')}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'SUMMARY'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI Clinical Summary</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('VALIDATION')}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 relative cursor-pointer ${
                      activeTab === 'VALIDATION'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Validation &amp; Reconciliation</span>
                    {currentEncounter.validation?.reviewQueue?.filter((r) => r.status === 'OPEN').length ? (
                      <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                        {currentEncounter.validation.reviewQueue.filter((r) => r.status === 'OPEN').length}
                      </span>
                    ) : null}
                  </button>

                  <button
                    onClick={() => setActiveTab('HPI')}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'HPI'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Structured HPI (SOCRATES)</span>
                  </button>

                  {currentEncounter.mode === 'AYUSH' && (
                    <button
                      onClick={() => setActiveTab('AYUSH')}
                      className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        activeTab === 'AYUSH'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      <span>🌿 Dashavidha Pariksha</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('DOCUMENTS')}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'DOCUMENTS'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Documents &amp; OCR ({currentEncounter.documents.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('TIMELINE')}
                    className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'TIMELINE'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Timeline ({currentEncounter.timeline.length})</span>
                  </button>
                </div>
              </div>

              {/* TAB 0: DOCTOR CLINICAL BRIEFING (PHASE 5) */}
              {activeTab === 'BRIEF' && clinicalBrief && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                  {/* Briefing Header Control Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                          <Stethoscope className="w-5 h-5 text-teal-700" />
                          Patient Clinical Brief &amp; Triage Intelligence
                        </h4>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          100% LOCAL AI &bull; DETERMINISTIC SYNTHESIS
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Generated {new Date(clinicalBrief.generatedAt).toLocaleTimeString()} &bull; Synthesized from {clinicalBrief.provenance.factsCount} canonical clinical facts &bull; Attending Doctor Final Clinical Authority
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => refreshClinicalBrief(currentEncounter.id)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh Brief</span>
                    </button>
                  </div>

                  {/* 🔴 IMPORTANT REVIEW ALERTS */}
                  {clinicalBrief.reviewAlerts.items.length > 0 && (
                    <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                        <h5 className="font-extrabold text-rose-900 text-xs uppercase tracking-wider flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          🔴 Important Review Alerts ({clinicalBrief.reviewAlerts.items.length})
                        </h5>
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                          Physician Action Required
                        </span>
                      </div>

                      <div className="space-y-2">
                        {clinicalBrief.reviewAlerts.items.map((alert) => (
                          <div key={alert.id} className="p-3 rounded-lg bg-white border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-600 text-white">
                                  {alert.criticality || 'HIGH'}
                                </span>
                                <strong className="text-xs text-slate-900">{alert.label}</strong>
                              </div>
                              <p className="text-xs text-slate-700 mt-1">{alert.value}</p>
                            </div>

                            {alert.factId && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleDoctorConfirmFact(alert.factId!)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg"
                                >
                                  ✓ Resolve &amp; Confirm
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 1. CHIEF COMPLAINT */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                        <span>1. Chief Complaint</span>
                      </h5>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        Source: {clinicalBrief.chiefComplaint?.source || 'PATIENT_CONVERSATION'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 bg-white p-3 rounded-lg border border-slate-200">
                      {clinicalBrief.chiefComplaint?.value || 'No chief complaint recorded.'}
                    </p>
                  </div>

                  {/* 2. HISTORY OF PRESENT ILLNESS (HPI) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-3">
                      2. History of Present Illness (Structured SOCRATES)
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {clinicalBrief.historyOfPresentIllness.items.map((item) => (
                        <div key={item.id} className="p-2.5 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase block">{item.label}</span>
                          <span className="text-xs font-bold text-slate-900">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. ALLERGIES */}
                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-extrabold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <AlertOctagon className="w-4 h-4 text-amber-600" />
                        3. Allergies
                      </h5>
                    </div>

                    <div className="space-y-2">
                      {clinicalBrief.allergies.items.map((item) => (
                        <div key={item.id} className="p-3 rounded-lg bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-xs text-slate-900">{item.value}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                Source: {item.source}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.verificationStatus === 'DOCTOR_VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                {item.verificationStatus}
                              </span>
                            </div>
                          </div>

                          {item.factId && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDoctorConfirmFact(item.factId!)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded"
                              >
                                ✓ Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFactId(item.factId!);
                                  setEditFactValue(item.value);
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-300"
                              >
                                ✏️ Edit
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. CURRENT MEDICATIONS */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Pill className="w-4 h-4 text-emerald-600" />
                        4. Current Medications &amp; Documented Prescriptions ({clinicalBrief.medications.items.length})
                      </h5>
                    </div>

                    <div className="space-y-3">
                      {clinicalBrief.medications.items.map((item) => (
                        <div key={item.id} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <div>
                              <strong className="text-xs font-black text-slate-900 tracking-wide">{item.label}</strong>
                              <p className="text-xs text-slate-700 mt-0.5">{item.value}</p>
                            </div>

                            {item.factId && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleDoctorConfirmFact(item.factId!)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg shadow-2xs"
                                >
                                  ✓ Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingFactId(item.factId!);
                                    setEditFactValue(item.value);
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-300"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDoctorFlagFact(item.factId!)}
                                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold rounded-lg"
                                >
                                  ⚠️ Flag
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDoctorRejectFact(item.factId!)}
                                  className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold rounded-lg"
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Source Evidence Metadata Card */}
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 font-mono">
                              Source: {item.source} ({item.sourceReference || 'Self-Report'})
                            </span>
                            <span className="font-bold text-slate-600">
                              Verification: {item.verificationStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5. PAST MEDICAL HISTORY */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-2">
                      5. Past Medical History &amp; Documented Conditions
                    </h5>
                    <div className="space-y-1.5">
                      {clinicalBrief.pastMedicalHistory.items.map((item) => (
                        <div key={item.id} className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-900 flex items-center justify-between">
                          <span>{item.value}</span>
                          <span className="text-[10px] font-mono text-slate-500">Source: {item.source}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 6. LABORATORY RESULTS */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-2">
                      6. Important Laboratory Results
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {clinicalBrief.labResults.items.map((item) => (
                        <div key={item.id} className="p-3 rounded-lg bg-white border border-slate-200">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase block">{item.label}</span>
                          <span className="text-xs font-bold text-slate-900">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 7. PREVIOUS DOCUMENTS */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-2">
                      7. Attached Documents ({clinicalBrief.documents.length})
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {clinicalBrief.documents.map((doc) => (
                        <div key={doc.id} className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                          <div>
                            <strong className="text-xs font-bold text-slate-900 block">{doc.fileName}</strong>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Type: {doc.documentType} &bull; Facts: {doc.extractedFactsCount}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                            OCR: {Math.round((doc.ocrQuality || 0.88) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 8. CLINICAL TIMELINE */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-2">
                      8. Chronological Health Timeline ({clinicalBrief.timeline.length} Events)
                    </h5>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {clinicalBrief.timeline.map((event) => (
                        <div key={event.id} className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-start gap-2.5">
                          <Clock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-xs text-slate-900">{event.title}</strong>
                              <span className="text-[10px] font-mono text-slate-500">
                                {new Date(event.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">{event.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1: AI Clinical Summary & Verification Center */}
              {activeTab === 'SUMMARY' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                  {/* Summary Control Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-base">
                          Comprehensive Clinical Summary
                        </h4>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                            currentEncounter.summary?.status === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {currentEncounter.summary?.status || 'DRAFT'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Synthesized from multilingual intake, patient voice, and OCR documents &bull; Requires Physician Sign-off
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!currentEncounter.summary ? (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleGenerateSummary}
                          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Generate AI Summary</span>
                        </button>
                      ) : !isEditingSummary ? (
                        <button
                          type="button"
                          onClick={() => setIsEditingSummary(true)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Edit Sections</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsEditingSummary(false)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleSaveEdit}
                            className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Edits</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Sections Grid */}
                  {currentEncounter.summary ? (
                    <div className="space-y-4">
                      {/* Chief Complaint */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                          1. Chief Complaint &amp; Duration
                        </label>
                        {isEditingSummary ? (
                          <textarea
                            value={editedSections.chiefComplaint || ''}
                            onChange={(e) => setEditedSections({ ...editedSections, chiefComplaint: e.target.value })}
                            rows={2}
                            className="w-full p-2.5 rounded-lg border border-slate-300 text-xs bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                          />
                        ) : (
                          <p className="text-xs text-slate-900 font-semibold leading-relaxed">
                            {currentEncounter.summary.sections.chiefComplaint}
                          </p>
                        )}
                      </div>

                      {/* History of Present Illness (HPI) */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                          2. History of Present Illness (SOCRATES Framework)
                        </label>
                        {isEditingSummary ? (
                          <textarea
                            value={editedSections.historyOfPresentIllness || ''}
                            onChange={(e) => setEditedSections({ ...editedSections, historyOfPresentIllness: e.target.value })}
                            rows={4}
                            className="w-full p-2.5 rounded-lg border border-slate-300 text-xs bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                          />
                        ) : (
                          <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                            {currentEncounter.summary.sections.historyOfPresentIllness}
                          </p>
                        )}
                      </div>

                      {/* Two Columns: Medical/Surgical + Drug/Allergy */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                            3. Past Medical &amp; Surgical History
                          </label>
                          {isEditingSummary ? (
                            <textarea
                              value={editedSections.pastMedicalHistory || ''}
                              onChange={(e) => setEditedSections({ ...editedSections, pastMedicalHistory: e.target.value })}
                              rows={3}
                              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                            />
                          ) : (
                            <p className="text-xs text-slate-800 leading-relaxed">
                              {currentEncounter.summary.sections.pastMedicalHistory}
                            </p>
                          )}
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                            4. Current Medications &amp; Allergies
                          </label>
                          {isEditingSummary ? (
                            <textarea
                              value={editedSections.currentMedications || ''}
                              onChange={(e) => setEditedSections({ ...editedSections, currentMedications: e.target.value })}
                              rows={3}
                              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                            />
                          ) : (
                            <p className="text-xs text-slate-800 leading-relaxed">
                              {currentEncounter.summary.sections.currentMedications}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* AYUSH Dashavidha Summary if present */}
                      {currentEncounter.summary.sections.ayushHistory && (
                        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                          <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1">
                            🌿 AYUSH &bull; Dashavidha Pariksha &amp; Ahara-Vihara Synthesis
                          </label>
                          {isEditingSummary ? (
                            <textarea
                              value={editedSections.ayushHistory || ''}
                              onChange={(e) => setEditedSections({ ...editedSections, ayushHistory: e.target.value })}
                              rows={3}
                              className="w-full p-2.5 rounded-lg border border-amber-300 text-xs bg-white focus:border-amber-600 focus:outline-hidden"
                            />
                          ) : (
                            <p className="text-xs text-amber-950 leading-relaxed font-medium">
                              {currentEncounter.summary.sections.ayushHistory}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Prior Investigations & OCR Lab Findings */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                          5. Prior Investigations &amp; Abnormal Lab Values
                        </label>
                        {isEditingSummary ? (
                          <textarea
                            value={editedSections.priorInvestigations || ''}
                            onChange={(e) => setEditedSections({ ...editedSections, priorInvestigations: e.target.value })}
                            rows={3}
                            className="w-full p-2.5 rounded-lg border border-slate-300 text-xs bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                          />
                        ) : (
                          <p className="text-xs text-slate-800 leading-relaxed">
                            {currentEncounter.summary.sections.priorInvestigations}
                          </p>
                        )}
                      </div>

                      {/* Physician Notes & Verification Action Bar */}
                      <div className="pt-4 border-t border-slate-200 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            Physician Clinical Impressions / OPD Prescriptions / Advice:
                          </label>
                          <textarea
                            value={doctorNotes}
                            onChange={(e) => setDoctorNotes(e.target.value)}
                            placeholder="Add physician final remarks, differential diagnosis, or OPD advice..."
                            rows={3}
                            className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:border-teal-600 focus:ring-1 focus:ring-teal-500 focus:outline-hidden bg-white"
                          />
                        </div>

                        {/* Confirmation or Digital Signature Stamp */}
                        {currentEncounter.status === 'VERIFIED' ? (
                          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 text-emerald-900">
                              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                              <div>
                                <div className="text-xs font-extrabold">
                                  Digitally Signed &amp; Verified by {doctor.name}
                                </div>
                                <div className="text-[11px] text-emerald-700 font-mono">
                                  Timestamp: {currentEncounter.summary.verifiedAt || new Date().toISOString()} &bull; ABDM Bundle ID: {currentEncounter.abdmBundleId || 'FHIR_DOC_9812'}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => onOpenFHIR(currentEncounter.id)}
                              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                            >
                              <FileCode className="w-4 h-4" />
                              <span>View ABDM Bundle</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={handleRejectSummary}
                              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                            >
                              <X className="w-4 h-4" />
                              <span>Reject / Re-intake</span>
                            </button>

                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={handleConfirmVerification}
                              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-extrabold shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2"
                            >
                              {actionLoading ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span>Signing &amp; Transmitting...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-5 h-5 stroke-[3]" />
                                  <span>Accept &amp; Confirm Summary (Sign &amp; Sync)</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 text-teal-600" />
                      <p className="text-sm font-semibold text-slate-700">
                        No AI Summary generated yet for this encounter.
                      </p>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleGenerateSummary}
                        className="mt-3 px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                      >
                        Generate Clinical Summary Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Clinical Data Validation & Cross-Source Reconciliation Engine */}
              {activeTab === 'VALIDATION' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-600" />
                        Clinical Data Validation &amp; Cross-Source Reconciliation Engine
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Detects cross-source discrepancies across speech, conversation, document OCR, and AI extractions without silently discarding data.
                      </p>
                    </div>

                    {/* Validation Status Badge */}
                    <div>
                      {currentEncounter.validation?.overallValidationStatus === 'CRITICAL_CONFLICTS' ? (
                        <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          CRITICAL CONFLICTS
                        </span>
                      ) : currentEncounter.validation?.overallValidationStatus === 'NEEDS_REVIEW' ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          NEEDS DOCTOR REVIEW
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ALL FACTS RECONCILED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ACTIVE CONTRADICTIONS SECTION */}
                  <div className="space-y-4">
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
                      <span>Cross-Source Data Contradictions ({currentEncounter.validation?.contradictions?.length || 0})</span>
                      <span className="text-[11px] font-normal text-slate-500">Preserved side-by-side</span>
                    </h5>

                    {currentEncounter.validation?.contradictions && currentEncounter.validation.contradictions.length > 0 ? (
                      <div className="space-y-3">
                        {currentEncounter.validation.contradictions.map((contr) => (
                          <div
                            key={contr.id}
                            className={`p-4 rounded-xl border ${
                              contr.severity === 'CRITICAL'
                                ? 'bg-rose-50/70 border-rose-300'
                                : contr.severity === 'HIGH'
                                ? 'bg-amber-50/70 border-amber-300'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                                    contr.severity === 'CRITICAL'
                                      ? 'bg-rose-600 text-white'
                                      : contr.severity === 'HIGH'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-slate-700 text-white'
                                  }`}
                                >
                                  {contr.severity} SEVERITY
                                </span>
                                <span className="font-bold text-xs text-slate-900">
                                  Category: {contr.category}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">
                                {contr.status === 'DOCTOR_RESOLVED' ? '✅ Doctor Resolved' : '⚠️ Unresolved'}
                              </span>
                            </div>

                            <p className="text-xs font-medium text-slate-800 mb-3">
                              {contr.description}
                            </p>

                            <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5 mt-2">
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                <span>Sources Involved:</span>
                                {contr.sources.map((s) => (
                                  <span key={s} className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    {s}
                                  </span>
                                ))}
                              </div>

                              {contr.status === 'OPEN' && (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => handleResolveReviewItem(`REV_CONTR_${contr.id}`)}
                                  className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Resolve &amp; Confirm</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs text-center">
                        No active cross-source contradictions detected.
                      </div>
                    )}
                  </div>

                  {/* CANONICAL CLINICAL FACTS TABLE */}
                  <div className="space-y-3 border-t border-slate-100 pt-5">
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
                      <span>Canonical Clinical Facts &amp; Provenance ({currentEncounter.validation?.facts?.length || 0})</span>
                      <span className="text-[11px] font-normal text-slate-500">Deterministic Data Quality &amp; Source Provenance Tracking</span>
                    </h5>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">Fact Type</th>
                            <th className="p-3">Value</th>
                            <th className="p-3">Source Provenance</th>
                            <th className="p-3">Data Quality &amp; Completeness</th>
                            <th className="p-3">Review Priority</th>
                            <th className="p-3">Verification Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {currentEncounter.validation?.facts?.map((fact) => (
                            <tr key={fact.id} className="hover:bg-slate-50/80 transition-all">
                              <td className="p-3 font-mono font-bold text-slate-700">{fact.type}</td>
                              <td className="p-3 font-medium">
                                {typeof fact.value === 'string'
                                  ? fact.value
                                  : fact.value?.name || fact.value?.testName || fact.value?.value || JSON.stringify(fact.value)}
                              </td>
                              <td className="p-3">
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 font-mono text-[10px] px-2 py-0.5 rounded">
                                  {fact.source}
                                  {fact.sourceReference ? ` (${fact.sourceReference})` : ''}
                                </span>
                              </td>
                              <td className="p-3">
                                {fact.dataQuality?.ocrQuality !== undefined ? (
                                  <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                                    OCR Quality: {Math.round(fact.dataQuality.ocrQuality * 100)}%
                                  </span>
                                ) : fact.dataQuality?.completenessScore !== undefined ? (
                                  <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                                    Record Completeness: {Math.round(fact.dataQuality.completenessScore * 100)}%
                                  </span>
                                ) : (
                                  <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">
                                    Valid Record
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-bold text-[10px]">
                                <span
                                  className={
                                    fact.criticality === 'CRITICAL'
                                      ? 'text-rose-600 font-black'
                                      : fact.criticality === 'HIGH'
                                      ? 'text-amber-600'
                                      : 'text-slate-600'
                                  }
                                >
                                  {fact.criticality}
                                </span>
                              </td>
                              <td className="p-3">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    fact.verificationStatus === 'DOCTOR_VERIFIED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : fact.verificationStatus === 'PATIENT_CONFIRMED'
                                      ? 'bg-sky-100 text-sky-800'
                                      : fact.verificationStatus === 'CONFLICTED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {fact.verificationStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Structured HPI SOCRATES Breakdown */}
              {activeTab === 'HPI' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
                    Structured History of Present Illness (SOCRATES Framework)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Site</span>
                      <span className="font-semibold text-slate-900">{currentEncounter.history.hpi.site || 'Not specified'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Onset</span>
                      <span className="font-semibold text-slate-900">{currentEncounter.history.hpi.onset || 'Sudden onset'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Character</span>
                      <span className="font-semibold text-slate-900">{currentEncounter.history.hpi.character || 'Heavy pressure / crushing'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Radiation</span>
                      <span className="font-semibold text-slate-900">{currentEncounter.history.hpi.radiation || 'Left arm & jaw'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Severity (0-10)</span>
                      <span className="font-bold text-rose-700 text-sm">
                        {currentEncounter.history.hpi.severity !== undefined ? `${currentEncounter.history.hpi.severity} / 10` : '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-400 block uppercase text-[10px]">Timing / Duration</span>
                      <span className="font-semibold text-slate-900">{currentEncounter.history.hpi.timing || 'Last 2 hours'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-400 block uppercase text-[10px] mb-1">Associated Symptoms</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(currentEncounter.history.hpi.associatedSymptoms || ['Diaphoresis (profuse sweating)', 'Shortness of breath', 'Nausea']).map((sym, idx) => (
                        <span key={idx} className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-medium">
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: AYUSH Dashavidha Pariksha */}
              {activeTab === 'AYUSH' && currentEncounter.history.ayushHistory && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <h4 className="font-bold text-amber-900 text-sm border-b border-amber-100 pb-3 flex items-center gap-2">
                    <span>🌿 Dashavidha Pariksha &bull; Ayurvedic Clinical Assessment</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                      <span className="font-bold text-amber-800 block uppercase text-[10px]">1. Prakriti (Constitution)</span>
                      <span className="font-bold text-slate-900 text-sm">{currentEncounter.history.ayushHistory.prakriti || 'Vata-Pitta'}</span>
                    </div>

                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                      <span className="font-bold text-amber-800 block uppercase text-[10px]">2. Vikriti (Pathology)</span>
                      <span className="font-bold text-slate-900 text-sm">{currentEncounter.history.ayushHistory.vikriti || 'Pitta-Vata Vriddhi'}</span>
                    </div>

                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                      <span className="font-bold text-amber-800 block uppercase text-[10px]">3. Agni (Digestive Fire)</span>
                      <span className="font-bold text-slate-900 text-sm">{currentEncounter.history.ayushHistory.agni || 'Vishamagni (Irregular)'}</span>
                    </div>

                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                      <span className="font-bold text-amber-800 block uppercase text-[10px]">4. Koshtha (Bowel Habit)</span>
                      <span className="font-bold text-slate-900 text-sm">{currentEncounter.history.ayushHistory.koshtha || 'Krura Koshtha (Constipated)'}</span>
                    </div>

                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                      <span className="font-bold text-amber-800 block uppercase text-[10px]">5. Sara &bull; Tissue Essence</span>
                      <span className="font-bold text-slate-900 text-sm">{currentEncounter.history.ayushHistory.sara || 'Madhyama Sara'}</span>
                    </div>

                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                      <span className="font-bold text-amber-800 block uppercase text-[10px]">6. Sattva (Mental Temperament)</span>
                      <span className="font-bold text-slate-900 text-sm">{currentEncounter.history.ayushHistory.sattva || 'Pravara (Strong)'}</span>
                    </div>
                  </div>

                  {currentEncounter.history.ayushHistory.aharaVihara && (
                    <div className="p-3.5 bg-amber-50/30 rounded-xl border border-amber-200 text-xs space-y-1">
                      <span className="font-bold text-amber-900 block uppercase text-[10px] mb-1">Ahara-Vihara (Lifestyle &amp; Diet)</span>
                      <p className="text-slate-700"><b>Diet Preference:</b> {currentEncounter.history.ayushHistory.aharaVihara.dietPreference}</p>
                      <p className="text-slate-700"><b>Sleep Pattern:</b> {currentEncounter.history.ayushHistory.aharaVihara.sleepPattern}</p>
                      <p className="text-slate-700"><b>Stress / Lifestyle:</b> {currentEncounter.history.ayushHistory.aharaVihara.stressLevel}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Uploaded Documents & OCR Viewer */}
              {activeTab === 'DOCUMENTS' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
                    Uploaded Medical Documents &amp; Extracted Entities
                  </h4>

                  {currentEncounter.documents.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">No documents uploaded for this encounter.</div>
                  ) : (
                    <div className="space-y-4">
                      {currentEncounter.documents.map((doc) => (
                        <div key={doc.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-900 text-sm">{doc.fileName}</span>
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                              {doc.documentType}
                            </span>
                          </div>

                          {doc.extractedText && (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 mb-2 whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {doc.extractedText}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Medical Timeline */}
              {activeTab === 'TIMELINE' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
                    Chronological Patient Health Timeline
                  </h4>

                  <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
                    {currentEncounter.timeline.map((evt) => (
                      <div key={evt.id} className="relative">
                        <div
                          className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 bg-white ${
                            evt.isAbnormal ? 'border-rose-600 bg-rose-50' : 'border-teal-600'
                          }`}
                        />
                        <div className="text-xs">
                          <span className="font-mono text-slate-400 block">{evt.date}</span>
                          <span className="font-bold text-slate-900 text-sm">{evt.title}</span>
                          <p className="text-slate-600 mt-0.5">{evt.description}</p>
                          {evt.sourceDocumentName && (
                            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                              Source: {evt.sourceDocumentName}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              Select a patient encounter from the left queue to review.
            </div>
          )}
        </div>
      </div>

      {/* DOCTOR EDIT INLINE MODAL */}
      {editingFactId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200">
            <h4 className="text-sm font-black text-slate-900 mb-2">Edit &amp; Correct Clinical Fact</h4>
            <p className="text-xs text-slate-500 mb-4">
              Correcting structured value. Original extracted evidence remains preserved in audit trail.
            </p>
            <textarea
              value={editFactValue}
              onChange={(e) => setEditFactValue(e.target.value)}
              rows={3}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-500 focus:outline-hidden mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingFactId(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleDoctorEditFact(editingFactId)}
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                Save Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
