import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, RefreshCw, Clock, User, HardDrive } from 'lucide-react';
import { api } from '../services/api';
import { AuditLog } from '../types/client';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs();
      if (res.success) {
        setLogs(res.data);
      }
    } catch (e) {
      console.error('Error fetching audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                DPDP Act &bull; Clinical Audit Trail Logs
              </h2>
              <p className="text-xs text-slate-500">
                Immutable chronological event trail of consent, AI extractions, red-flag alerts, and physician verification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
              title="Refresh logs"
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-50">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading audit records...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No audit logs recorded yet.</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const isRedFlag = log.action.includes('RED_FLAG');
                const isConsent = log.action.includes('CONSENT');
                const isConfirm = log.action.includes('CONFIRMED');

                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border text-xs bg-white flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-2xs ${
                      isRedFlag
                        ? 'border-rose-300 bg-rose-50/40'
                        : isConfirm
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : isConsent
                        ? 'border-blue-300 bg-blue-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase ${
                          log.role === 'DOCTOR'
                            ? 'bg-indigo-100 text-indigo-800'
                            : log.role === 'PATIENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {log.role}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{log.action}</span>
                          <span className="text-slate-400">&bull;</span>
                          <span className="text-slate-600 font-mono">{log.resource} ({log.resourceId || 'N/A'})</span>
                        </div>
                        {log.details && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {JSON.stringify(log.details)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono shrink-0">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {log.actor}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
          <span>DPDP Act 2023 &bull; Digital Personal Data Protection &bull; Section 6 Auditable Consent</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
