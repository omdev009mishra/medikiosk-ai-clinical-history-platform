/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PatientKiosk } from './features/patient/PatientKiosk';
import { DoctorWorkstation } from './features/doctor/DoctorWorkstation';
import { AdminPortal } from './features/admin/AdminPortal';
import { DoctorAuthModal } from './features/doctor/DoctorAuthModal';
import { AdminAuthModal } from './features/admin/AdminAuthModal';
import { FHIRViewerModal } from './components/FHIRViewerModal';
import { AuditLogModal } from './components/AuditLogModal';
import { IntakeMode, DoctorUser, AdminUser } from './types/client';
import { api } from './services/api';

export default function App() {
  const [currentView, setCurrentView] = useState<'PATIENT' | 'DOCTOR' | 'ADMIN'>('PATIENT');
  const [intakeMode, setIntakeMode] = useState<IntakeMode>('GENERAL');
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isFHIRModalOpen, setIsFHIRModalOpen] = useState(false);
  const [isDoctorAuthModalOpen, setIsDoctorAuthModalOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [authenticatedDoctor, setAuthenticatedDoctor] = useState<DoctorUser | null>(null);
  const [authenticatedAdmin, setAuthenticatedAdmin] = useState<AdminUser | null>(null);
  const [fhirEncounterId, setFhirEncounterId] = useState<string>('ENC_001');
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(1);
  const [doctorSubView, setDoctorSubView] = useState<'LANDING' | 'QUEUE'>('LANDING');

  // Periodic poll to check for any high triage alerts across encounters
  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkAlerts = async () => {
    try {
      const res = await api.getDoctorQueue();
      if (res.success && res.data) {
        const count = res.data.filter((e: any) => e.hasRedFlags).length;
        setActiveAlertsCount(count);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleOpenFHIR = (encounterId: string = 'ENC_001') => {
    setFhirEncounterId(encounterId);
    setIsFHIRModalOpen(true);
  };

  const handleViewChange = (view: 'PATIENT' | 'DOCTOR' | 'ADMIN') => {
    if (view === 'DOCTOR') {
      if (authenticatedDoctor) {
        setCurrentView('DOCTOR');
      } else {
        setIsDoctorAuthModalOpen(true);
      }
    } else if (view === 'ADMIN') {
      if (authenticatedAdmin) {
        setCurrentView('ADMIN');
      } else {
        setIsAdminAuthModalOpen(true);
      }
    } else {
      setCurrentView('PATIENT');
    }
  };

  const handleDoctorLoginSuccess = (doctor: DoctorUser) => {
    setAuthenticatedDoctor(doctor);
    setIsDoctorAuthModalOpen(false);
    setCurrentView('DOCTOR');
    setDoctorSubView('LANDING');
  };

  const handleAdminLoginSuccess = (admin: AdminUser) => {
    setAuthenticatedAdmin(admin);
    setIsAdminAuthModalOpen(false);
    setCurrentView('ADMIN');
  };

  const handleDoctorLogout = () => {
    setAuthenticatedDoctor(null);
    setCurrentView('PATIENT');
  };

  const handleAdminLogout = () => {
    setAuthenticatedAdmin(null);
    setCurrentView('PATIENT');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-emerald-200">
      {/* Institutional Top Header */}
      <Header
        currentView={currentView}
        onViewChange={handleViewChange}
        onOpenAudit={() => setIsAuditModalOpen(true)}
        onOpenFHIR={() => handleOpenFHIR(fhirEncounterId)}
        activeRedFlagsCount={activeAlertsCount}
        mode={intakeMode}
        onModeChange={(m) => setIntakeMode(m)}
        authenticatedDoctor={authenticatedDoctor}
        onDoctorLogout={handleDoctorLogout}
        onOpenDoctorLogin={() => setIsDoctorAuthModalOpen(true)}
        authenticatedAdmin={authenticatedAdmin}
        onAdminLogout={handleAdminLogout}
        onOpenAdminLogin={() => setIsAdminAuthModalOpen(true)}
        doctorSubView={doctorSubView}
        onDoctorSubViewChange={setDoctorSubView}
      />

      {/* Main View Router */}
      <div className="flex-1">
        {currentView === 'PATIENT' && (
          <PatientKiosk
            mode={intakeMode}
            onModeChange={(m) => setIntakeMode(m)}
            onOpenDoctorAuth={() => setIsDoctorAuthModalOpen(true)}
          />
        )}
        {currentView === 'DOCTOR' && (
          <DoctorWorkstation
            doctorUser={authenticatedDoctor}
            onLogout={handleDoctorLogout}
            onOpenFHIR={(encId) => handleOpenFHIR(encId)}
            onOpenAudit={() => setIsAuditModalOpen(true)}
            doctorSubView={doctorSubView}
            onDoctorSubViewChange={setDoctorSubView}
          />
        )}
        {currentView === 'ADMIN' && (
          <AdminPortal
            adminUser={authenticatedAdmin}
            onLogout={handleAdminLogout}
            onOpenFHIR={(encId) => handleOpenFHIR(encId)}
          />
        )}
      </div>

      {/* Doctor Authentication PIN Modal */}
      <DoctorAuthModal
        isOpen={isDoctorAuthModalOpen}
        onClose={() => setIsDoctorAuthModalOpen(false)}
        onSuccess={handleDoctorLoginSuccess}
      />

      {/* Admin Authentication Master PIN Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      {/* ABDM FHIR R4 Bundle Modal */}
      <FHIRViewerModal
        isOpen={isFHIRModalOpen}
        onClose={() => setIsFHIRModalOpen(false)}
        encounterId={fhirEncounterId}
      />

      {/* DPDP Act Audit Logs Modal */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />
    </div>
  );
}


