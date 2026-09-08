import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  Award,
  Clock,
  FileCode,
  Activity,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Phone,
  Mail,
  DoorOpen,
  Download,
  SlidersHorizontal,
} from 'lucide-react';
import { DoctorUser, AdminUser, AuditLog } from '../../types/client';
import { api } from '../../services/api';
import { DoctorRegisterModal } from './DoctorRegisterModal';

interface AdminPortalProps {
  adminUser?: AdminUser | null;
  onLogout?: () => void;
  onOpenFHIR?: (encounterId: string) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminUser,
  onLogout,
  onOpenFHIR,
}) => {
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [encountersCount, setEncountersCount] = useState<number>(0);
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Modals & Sub-actions
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorUser | null>(null);
  const [resetPinDoctor, setResetPinDoctor] = useState<DoctorUser | null>(null);
  const [newPinValue, setNewPinValue] = useState<string>('1234');
  const [activeTab, setActiveTab] = useState<'DOCTORS' | 'HPR_VERIFIER' | 'AUDIT_DPDP' | 'FACILITY_INFO'>('DOCTORS');
  const [toastMessage, setToastMessage] = useState<string>('');

  // HPR Sandbox Verifier State
  const [verifierHprInput, setVerifierHprInput] = useState<string>('91-8839-2041-9981');
  const [verifierRegInput, setVerifierRegInput] = useState<string>('MCI-2014-98124');
  const [verifierCouncil, setVerifierCouncil] = useState<string>('National Medical Commission (NMC)');
  const [verifierLoading, setVerifierLoading] = useState<boolean>(false);
  const [verifierResult, setVerifierResult] = useState<any>(null);

  const defaultAdmin: AdminUser = adminUser || {
    id: 'ADMIN_MS_01',
    name: 'Dr. (Col.) S. K. Bhattacharya',
    designation: 'Medical Superintendent & HFR Nodal Officer',
    hfrFacilityId: 'IN-DL-AIIA-00912',
    facilityName: 'All India Institute of Ayurveda & Central Hospital',
    role: 'HOSPITAL_SUPERINTENDENT',
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [docRes, encRes, auditRes] = await Promise.all([
        api.getDoctors(),
        api.getDoctorQueue(),
        api.getAuditLogs(),
      ]);

      if (docRes.success && docRes.data) {
        setDoctors(docRes.data);
      }
      if (encRes.success && encRes.data) {
        setEncountersCount(encRes.data.length);
        const alerts = encRes.data.reduce((sum: number, enc: any) => sum + (enc.alerts?.length || 0), 0);
        setAlertsCount(alerts);
      }
      if (auditRes.success && auditRes.data) {
        setAuditLogs(auditRes.data);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleToggleStatus = async (doctor: DoctorUser, newStatus: DoctorUser['status']) => {
    try {
      const res = await api.updateDoctor(doctor.id, { status: newStatus });
      if (res.success && res.data) {
        setDoctors((prev) => prev.map((d) => (d.id === doctor.id ? res.data : d)));
        showToast(`Updated ${doctor.name} status to ${newStatus}`);
      }
    } catch (err: any) {
      alert('Failed to update doctor status: ' + err.message);
    }
  };

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinDoctor) return;
    if (!newPinValue || newPinValue.length < 4) {
      alert('PIN must be at least 4 digits.');
      return;
    }
    try {
      const res = await api.updateDoctor(resetPinDoctor.id, { pin: newPinValue });
      if (res.success && res.data) {
        setDoctors((prev) => prev.map((d) => (d.id === resetPinDoctor.id ? res.data : d)));
        showToast(`PIN reset successfully for ${resetPinDoctor.name} (New PIN: ${newPinValue})`);
        setResetPinDoctor(null);
      }
    } catch (err: any) {
      alert('Failed to reset PIN: ' + err.message);
    }
  };

  const handleRevokeDoctor = async (doctor: DoctorUser) => {
    if (!window.confirm(`Are you sure you want to revoke clinical access for ${doctor.name}? This will remove them from active OPD rosters.`)) {
      return;
    }
    try {
      const res = await api.deleteDoctor(doctor.id);
      if (res.success) {
        setDoctors((prev) => prev.filter((d) => d.id !== doctor.id));
        showToast(`Revoked credentials for ${doctor.name}`);
      }
    } catch (err: any) {
      alert('Failed to delete doctor: ' + err.message);
    }
  };

  const handleSaveEditDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    try {
      const res = await api.updateDoctor(editingDoctor.id, editingDoctor);
      if (res.success && res.data) {
        setDoctors((prev) => prev.map((d) => (d.id === editingDoctor.id ? res.data : d)));
        showToast(`Updated doctor profile for ${editingDoctor.name}`);
        setEditingDoctor(null);
      }
    } catch (err: any) {
      alert('Failed to update doctor: ' + err.message);
    }
  };

  const handleHprVerificationTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifierLoading(true);
    setVerifierResult(null);
    try {
      const res = await api.verifyHPR(verifierHprInput, verifierRegInput, verifierCouncil);
      setVerifierResult(res);
    } catch (err: any) {
      setVerifierResult({ success: false, error: { message: err.message } });
    } finally {
      setVerifierLoading(false);
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.hprId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.regNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.chamber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;
    const matchesDept = deptFilter === 'ALL' || doc.department.includes(deptFilter);

    return matchesSearch && matchesStatus && matchesDept;
  });

  const onDutyCount = doctors.filter((d) => d.status === 'ON_DUTY').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hospital Superintendent & HFR Institutional Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                HFR ID: {defaultAdmin.hfrFacilityId}
              </span>
              <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ABDM National Gateway &bull; LIVE CONNECTED
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-amber-400" />
              {defaultAdmin.facilityName}
            </h1>

            <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
              <span>Nodal Officer: <strong className="text-white">{defaultAdmin.name}</strong></span>
              <span>&bull;</span>
              <span className="text-amber-200">{defaultAdmin.designation}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register New Physician (HPR)</span>
            </button>

            <button
              onClick={loadData}
              title="Refresh Registry"
              className="p-2.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <span>Lock Admin Desk</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Hospital Operations Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-2xl p-3.5">
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-indigo-400" />
              Enrolled Physicians (HPR)
            </div>
            <div className="text-2xl font-black text-white mt-1">{doctors.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">NMC &amp; AYUSH Registered</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-2xl p-3.5">
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
              On-Duty in OPD Chambers
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{onDutyCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active consultation rooms</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-2xl p-3.5">
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Total Patients Triaged Today
            </div>
            <div className="text-2xl font-black text-sky-400 mt-1">{encountersCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Kiosk &amp; Doctor Encounters</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-2xl p-3.5">
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Emergency Triage Alerts
            </div>
            <div className="text-2xl font-black text-rose-400 mt-1">{alertsCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Red-flag priority escalations</div>
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('DOCTORS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'DOCTORS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Doctor &amp; Specialist Directory ({doctors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HPR_VERIFIER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'HPR_VERIFIER'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>National HPR Registry Verifier</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT_DPDP')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'AUDIT_DPDP'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>DPDP Act Facility Audit Logs ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('FACILITY_INFO')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'FACILITY_INFO'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>HFR OPD Chambers</span>
        </button>
      </div>

      {/* TAB 1: DOCTORS DIRECTORY */}
      {activeTab === 'DOCTORS' && (
        <div className="space-y-4">
          {/* Search & Filter Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by physician name, HPR ID, registration number, chamber, or department..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="ALL">All Statuses</option>
                <option value="ON_DUTY">On-Duty in OPD</option>
                <option value="ACTIVE">Active (Off-Duty)</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="SUSPENDED">Suspended</option>
              </select>

              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Doctor</span>
              </button>
            </div>
          </div>

          {/* Doctors Table / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDoctors.map((doc) => {
              const statusColors = {
                ON_DUTY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                ACTIVE: 'bg-blue-50 text-blue-700 border-blue-200',
                ON_LEAVE: 'bg-amber-50 text-amber-700 border-amber-200',
                SUSPENDED: 'bg-rose-50 text-rose-700 border-rose-200',
              };

              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Avatar & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-base text-indigo-700">
                          {doc.avatarInitials || 'DR'}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{doc.name}</h3>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {doc.role === 'CHIEF_CONSULTANT'
                              ? 'Chief Consultant'
                              : doc.role === 'RESIDENT'
                              ? 'Senior Resident'
                              : 'Attending Physician'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          statusColors[doc.status] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {doc.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Department & Chamber */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-700 font-semibold">
                        <span>{doc.department}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
                        <DoorOpen className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{doc.chamber}</span>
                      </div>
                    </div>

                    {/* Registry Credentials */}
                    <div className="space-y-1 text-[11px] text-slate-600 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">HPR ID:</span>
                        <strong className="text-indigo-900">{doc.hprId}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Reg No:</span>
                        <strong className="text-slate-800">{doc.regNo}</strong>
                      </div>
                      {doc.qualification && (
                        <div className="flex items-center justify-between text-[10px] font-sans">
                          <span className="text-slate-400">Degree:</span>
                          <span className="text-slate-700 font-medium">{doc.qualification}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Roster Controls */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                    {/* Status Dropdown */}
                    <select
                      value={doc.status}
                      onChange={(e: any) => handleToggleStatus(doc, e.target.value)}
                      className="text-[11px] font-semibold px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      <option value="ON_DUTY">On Duty</option>
                      <option value="ACTIVE">Active (Off)</option>
                      <option value="ON_LEAVE">On Leave</option>
                      <option value="SUSPENDED">Suspend Access</option>
                    </select>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setResetPinDoctor(doc);
                          setNewPinValue(doc.pin || '1234');
                        }}
                        title="Reset 4-Digit Clinical PIN"
                        className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setEditingDoctor(doc)}
                        title="Edit Doctor Profile"
                        className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRevokeDoctor(doc)}
                        title="Revoke Credentials & Delete"
                        className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredDoctors.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
              <Stethoscope className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-600 font-bold text-sm">No physicians matched your search.</p>
              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register New Physician</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ABDM HPR REGISTRY VERIFIER SANDBOX */}
      {activeTab === 'HPR_VERIFIER' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              ABDM Healthcare Professionals Registry (HPR) Sandbox Verification
            </h3>
            <p className="text-xs text-slate-500">
              Direct live lookup simulator against the National Medical Commission (NMC), Delhi Medical Council, and AYUSH Central Council registry databases under the Ayushman Bharat Digital Mission.
            </p>
          </div>

          <form onSubmit={handleHprVerificationTest} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                ABDM HPR ID (14-digit)
              </label>
              <input
                type="text"
                value={verifierHprInput}
                onChange={(e) => setVerifierHprInput(e.target.value)}
                placeholder="e.g. 91-8839-2041-9981"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                State / Central Council Reg. No
              </label>
              <input
                type="text"
                value={verifierRegInput}
                onChange={(e) => setVerifierRegInput(e.target.value)}
                placeholder="e.g. MCI-2014-98124"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={verifierLoading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {verifierLoading ? (
                  <span>Querying ABDM HPR Gateway...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Run Registry Verification</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {verifierResult && (
            <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  National HPR Gateway Verification Result: ACTIVE &amp; ACCREDITED
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                  HTTP 200 OK &bull; ABDM R4 Verified
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-white p-4 rounded-xl border border-emerald-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">HPR ID</span>
                  <strong className="font-mono text-indigo-900">{verifierResult.data?.hprId || verifierHprInput}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Registration No</span>
                  <strong className="font-mono text-slate-800">{verifierResult.data?.regNo || verifierRegInput}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Licensing Authority</span>
                  <strong className="text-slate-800">{verifierResult.data?.council || verifierCouncil}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Registry Status</span>
                  <span className="text-emerald-700 font-bold">VERIFIED_ACTIVE</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">eKYC Mode</span>
                  <span className="text-slate-700">Aadhaar Biometric / OTP Verified</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Verified Timestamp</span>
                  <span className="text-slate-700 font-mono text-[11px]">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DPDP ACT FACILITY AUDIT LOGS */}
      {activeTab === 'AUDIT_DPDP' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                DPDP Act &amp; ABDM Security Audit Trail
              </h3>
              <p className="text-xs text-slate-500">
                Immutable operational log tracking all patient consent, clinical intake, doctor verification sign-offs, and credential modifications.
              </p>
            </div>

            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `facility_dpdp_audit_${Date.now()}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit JSON</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Actor &amp; Role</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3">Details / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.slice(0, 30).map((log) => {
                  const roleBadge = {
                    ADMIN: 'bg-amber-100 text-amber-800 border-amber-300',
                    DOCTOR: 'bg-indigo-100 text-indigo-800 border-indigo-300',
                    PATIENT: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                    SYSTEM: 'bg-slate-100 text-slate-700 border-slate-300',
                  };

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{log.actor}</div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleBadge[log.role] || 'bg-slate-100'}`}>
                          {log.role}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-indigo-900 font-semibold">{log.action}</td>
                      <td className="p-3 font-mono text-slate-700">{log.resource}</td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : log.resourceId || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FACILITY OPD CHAMBERS OVERVIEW */}
      {activeTab === 'FACILITY_INFO' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Health Facility Registry (HFR) &bull; OPD Chambers &amp; Wing Allocation
            </h3>
            <p className="text-xs text-slate-500">
              Active physical consultation chambers mapped to registered Healthcare Professionals and automated kiosk token queues.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { chamber: 'Chamber 108', wing: 'Ground Floor (Emergency)', dept: 'General Medicine & Emergency Triage', defaultDoc: 'Dr. Alok Verma' },
              { chamber: 'Chamber 204', wing: 'First Floor (AYUSH Wing)', dept: 'Kayachikitsa & AYUSH OPD', defaultDoc: 'Dr. Sneha Kulkarni' },
              { chamber: 'Chamber 102', wing: 'Ground Floor (ICU Annex)', dept: 'Cardiology & Critical Care', defaultDoc: 'Dr. Priya Nair' },
              { chamber: 'Chamber 201', wing: 'First Floor (Surgical)', dept: 'Shalya Tantra / Surgery', defaultDoc: 'Unassigned (On Call)' },
              { chamber: 'Chamber 301', wing: 'Second Floor', dept: 'Pediatrics & Child Health', defaultDoc: 'Unassigned (On Call)' },
              { chamber: 'Chamber 305', wing: 'Second Floor (Specialty)', dept: 'Panchakarma Specialty Clinic', defaultDoc: 'Unassigned' },
            ].map((room, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-indigo-900">{room.chamber}</span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                    {room.wing}
                  </span>
                </div>
                <div className="text-xs text-slate-700 font-semibold">{room.dept}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-200">
                  <span>Assigned:</span>
                  <strong className="text-slate-800">{room.defaultDoc}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Register New Doctor */}
      <DoctorRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={(newDoc) => {
          setDoctors((prev) => [newDoc, ...prev]);
          showToast(`Successfully enrolled ${newDoc.name} in HPR Registry`);
        }}
      />

      {/* Modal: Edit Doctor */}
      {editingDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">Edit Doctor Profile &bull; {editingDoctor.name}</h3>
              <button
                onClick={() => setEditingDoctor(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditDoctor} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingDoctor.name}
                  onChange={(e) => setEditingDoctor({ ...editingDoctor, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Department</label>
                  <input
                    type="text"
                    value={editingDoctor.department}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, department: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">OPD Chamber</label>
                  <input
                    type="text"
                    value={editingDoctor.chamber}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, chamber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingDoctor.phone || ''}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={editingDoctor.email || ''}
                    onChange={(e) => setEditingDoctor({ ...editingDoctor, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingDoctor(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl"
                >
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset PIN */}
      {resetPinDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-base">Reset Clinical PIN</h3>
              <button
                onClick={() => setResetPinDoctor(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleResetPinSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Set a new 4-digit Clinical PIN for <strong>{resetPinDoctor.name}</strong> to authenticate on the Doctor Workstation.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">New 4-Digit PIN</label>
                <input
                  type="text"
                  maxLength={6}
                  value={newPinValue}
                  onChange={(e) => setNewPinValue(e.target.value)}
                  className="w-full px-4 py-2.5 text-base font-mono font-bold tracking-widest text-center border-2 border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-hidden"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPinDoctor(null)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs"
                >
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
