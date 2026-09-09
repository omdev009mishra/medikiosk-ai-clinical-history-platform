import { Router, Request, Response } from 'express';
import { clinicalStore } from '../db/store';
import { getNextQuestion, processAnswer, processClinicalTurn } from '../services/clinicalEngine';
import { evaluateRedFlags } from '../rules/redFlags';
import { processMedicalDocument } from '../services/documentProcessor';
import { generateEncounterSummary } from '../services/summaryGenerator';
import { abdmService, mapEncounterToFHIR } from '../services/abdmService';
import { hospitalIntegrationService } from '../services/hisService';
import { DocumentRecord } from '../types/clinical';
import { checkOllamaHealth } from '../ai/ollama';
import { checkSpeechServiceHealth, transcribeAudio, synthesizeSpeech, checkPipecatStatus } from '../services/speechService';
import { checkOCRServiceHealth } from '../services/ocrService';
import { runValidationPipeline } from '../services/clinicalValidationPipeline';
import { generateClinicalBrief } from '../services/clinicalBriefGenerator';
import { recordAuditEvent, getEncounterAuditTrail } from '../services/clinicalAuditService';
import { patientService } from '../services/patientService';
import { patientHistoryService } from '../services/patientHistoryService';
import { encounterService } from '../services/encounterService';
import { authService } from '../services/authService';
import { clinicalRecordPrintService } from '../services/clinicalRecordPrintService';
import { dashboardService } from '../services/dashboardService';
import { adaptiveInterviewService } from '../services/adaptiveInterviewService';
import { getDbStatus } from '../db/prisma';
import { StandardizedQuestion } from '../types/interview';
import { getNextMedicalQuestion, generateMedicalSummary } from '../services/medicalInterrogation';
import { hybridSyncService } from '../services/syncService';
import { dbClient } from '../db/dbClient';

export const apiRouter = Router();

// ==========================================
// 1. Health & Config
// ==========================================
apiRouter.get('/health', async (req: Request, res: Response) => {
  const aiHealth = await checkOllamaHealth();
  const speechHealth = await checkSpeechServiceHealth();
  const ocrHealth = await checkOCRServiceHealth();
  const dbHealth = await dbClient.checkHealth();
  const syncStatus = hybridSyncService.getSyncStatus();

  const overallStatus =
    dbHealth.status !== 'degraded' &&
    (speechHealth.status === 'healthy' || speechHealth.status === 'ok')
      ? 'healthy'
      : 'degraded';

  res.json({
    status: 'ok',
    overallStatus,
    version: '6.0.0-PERSISTENT-HOSPITAL-WORKFLOW',
    service: 'MediKiosk Clinical History Platform API',
    mode: syncStatus.mode,
    isOnline: syncStatus.isOnline,
    database: dbHealth,
    speechStatus: speechHealth,
    ocrStatus: ocrHealth,
    syncStatus,
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/ready', async (req: Request, res: Response) => {
  const dbHealth = await dbClient.checkHealth();
  if (dbHealth.connected) {
    res.status(200).json({ ready: true, status: 'ready', timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({ ready: false, status: 'initializing', timestamp: new Date().toISOString() });
  }
});

apiRouter.get('/sync/status', (req: Request, res: Response) => {
  const status = hybridSyncService.getSyncStatus();
  res.json({ success: true, data: status });
});

apiRouter.post('/sync/trigger', async (req: Request, res: Response) => {
  const result = await hybridSyncService.processSyncQueue();
  res.json({ success: true, data: result, syncStatus: hybridSyncService.getSyncStatus() });
});

apiRouter.post('/sync/resolve', (req: Request, res: Response) => {
  const { syncId, resolution, mergedPayload, doctorId } = req.body;
  if (!syncId || !resolution) {
    return res.status(400).json({ success: false, error: { message: 'syncId and resolution are required.' } });
  }
  const resolved = hybridSyncService.resolveConflict(syncId, resolution, mergedPayload, doctorId);
  res.json({ success: resolved });
});

apiRouter.post('/sync/ingest', async (req: Request, res: Response) => {
  const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
  if (idempotencyKey) {
    const cached = clinicalStore.getIdempotentResult(idempotencyKey);
    if (cached) {
      return res.json({ success: true, data: cached, idempotentReuse: true });
    }
  }

  const { operation, entityType, entityId, payload } = req.body;
  if (!operation || !entityType || !payload) {
    return res.status(400).json({ success: false, error: { message: 'Missing required sync fields: operation, entityType, payload.' } });
  }

  let result: any;
  if (entityType === 'Patient') {
    result = clinicalStore.createPatient(payload);
  } else if (entityType === 'Encounter') {
    const existing = clinicalStore.getEncounter(entityId);
    if (existing) {
      result = clinicalStore.updateEncounter(entityId, payload);
    } else {
      result = clinicalStore.createEncounter(payload);
    }
  } else if (entityType === 'Summary') {
    const enc = clinicalStore.getEncounter(entityId);
    if (enc) {
      enc.summary = payload;
      clinicalStore.updateEncounter(entityId, { summary: payload });
      result = payload;
    }
  } else {
    result = { ingested: true, entityType, entityId };
  }

  if (idempotencyKey) {
    clinicalStore.setIdempotentResult(idempotencyKey, result);
  }

  res.json({ success: true, data: result });
});

apiRouter.get('/health/ai', async (req: Request, res: Response) => {
  const aiHealth = await checkOllamaHealth();
  res.json({
    success: true,
    backendStatus: 'ok',
    ...aiHealth,
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/health/speech', async (req: Request, res: Response) => {
  const speechHealth = await checkSpeechServiceHealth();
  res.json({
    success: true,
    backendStatus: 'ok',
    ...speechHealth,
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/health/ocr', async (req: Request, res: Response) => {
  const ocrHealth = await checkOCRServiceHealth();
  res.json({
    success: true,
    backendStatus: 'ok',
    ...ocrHealth,
    timestamp: new Date().toISOString(),
  });
});

import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (Number(process.env.MAX_AUDIO_SIZE_MB) || 25) * 1024 * 1024,
  },
});

// ==========================================
// 1.1 Speech Recognition (Faster-Whisper Proxy)
// ==========================================
apiRouter.get('/speech/debug/status', async (_req: Request, res: Response) => {
  const speechHealth = await checkSpeechServiceHealth();
  const pipecatStatus = await checkPipecatStatus();
  res.json({
    microphonePipeline: true,
    speechServiceReachable: speechHealth.speechServiceReachable,
    fasterWhisperLoaded: speechHealth.speechServiceReachable && speechHealth.status === 'healthy',
    gpuAvailable: speechHealth.gpuEnabled ?? false,
    pipecatServiceReachable: Boolean(pipecatStatus.success || pipecatStatus.pipecatAvailable || pipecatStatus.status === 'healthy'),
  });
});

apiRouter.post('/speech/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  console.log('[SPEECH DEBUG] Transcription request received');
  let buffer: Buffer | null = null;
  let fileName = 'recording.webm';
  let mimeType = 'audio/webm';

  if (req.file) {
    buffer = req.file.buffer;
    fileName = req.file.originalname || fileName;
    mimeType = req.file.mimetype || mimeType;
  } else if (req.body?.base64Audio && typeof req.body.base64Audio === 'string') {
    const base64Audio = req.body.base64Audio;
    fileName = req.body.fileName || fileName;
    mimeType = req.body.mimeType || mimeType;

    const cleanBase64 = base64Audio.replace(/^data:[^,]*;base64,/, '').trim();
    const base64Regex = /^[A-Za-z0-9+/=\s]+$/;
    if (cleanBase64.startsWith('data:') || cleanBase64.includes(';base64,') || !base64Regex.test(cleanBase64)) {
      console.log('[SPEECH DEBUG] Transcription error: Invalid Data URI or base64 audio format');
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid Data URI or base64 audio format.' },
      });
    }
    buffer = Buffer.from(cleanBase64, 'base64');
  } else {
    console.log('[SPEECH DEBUG] Transcription error: Audio data is required');
    return res.status(400).json({
      success: false,
      error: { message: 'Audio data is required (multipart file "audio" or base64Audio format).' },
    });
  }

  if (!buffer || buffer.length === 0) {
    console.log('[SPEECH DEBUG] Transcription error: Empty audio buffer received');
    return res.status(400).json({
      success: false,
      error: { message: 'Empty audio buffer received.' },
    });
  }

  console.log(`[SPEECH DEBUG] Audio received: ${buffer.length} bytes`);
  console.log(`[SPEECH DEBUG] MIME type: ${mimeType}`);

  const language = (req.body?.language || req.query?.language || undefined) as string | undefined;
  console.log(`[VOICE DEBUG 9] Express received file: ${fileName} (${buffer.length} bytes, ${mimeType}, language: ${language || 'auto'})`);

  try {
    console.log('[SPEECH DEBUG] Forwarding audio to Pipecat Voice Orchestrator');
    const result = await transcribeAudio(buffer, fileName, mimeType, language);
    if (!result.success) {
      console.log(`[SPEECH DEBUG] Transcription error: ${result.error || 'Speech transcription failed.'}`);
      const code = result.errorCode || (result.error?.includes('unavailable') ? 'SPEECH_SERVICE_UNAVAILABLE' : 'INVALID_AUDIO');
      const statusCode = code === 'SPEECH_SERVICE_UNAVAILABLE' ? 503 : code === 'TRANSCRIPTION_TIMEOUT' ? 408 : 400;
      return res.status(statusCode).json({
        success: false,
        error: {
          code,
          message: result.error || 'Speech transcription failed.',
        },
      });
    }

    console.log('[SPEECH DEBUG] Pipecat turn response received');
    console.log(`[SPEECH DEBUG] Transcript: "${result.text}"`);

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.log(`[SPEECH DEBUG] Transcription error: ${err.message || err}`);
    console.error('[API Speech Route Error]:', err);
    res.status(500).json({
      success: false,
      error: { message: 'Speech transcription processing failed.' },
    });
  }
});

apiRouter.get('/speech/pipecat/status', async (_req: Request, res: Response) => {
  try {
    const status = await checkPipecatStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to get Pipecat status' });
  }
});

apiRouter.post('/speech/tts', async (req: Request, res: Response) => {
  try {
    const { text, language = 'hi', gender = 'female' } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Text is required for TTS synthesis.' },
      });
    }

    const result = await synthesizeSpeech(text.trim(), language, gender);
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: { message: result.error || 'TTS synthesis failed.' },
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[API TTS Route Error]:', err);
    res.status(500).json({
      success: false,
      error: { message: 'TTS processing failed.' },
    });
  }
});

// ==========================================
// 2. Authentication & Identification
// ==========================================
const isSecureRequest = (req: Request): boolean => {
  return (
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.SESSION_COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production'
  );
};

const setAuthCookie = (res: Response, req: Request, token: string) => {
  const isSecure = isSecureRequest(req);
  const cookieFlags = [
    `auth_token=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=86400',
  ];
  if (isSecure) {
    cookieFlags.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieFlags.join('; '));
};

const clearAuthCookie = (res: Response, req: Request) => {
  const isSecure = isSecureRequest(req);
  const cookieFlags = [
    'auth_token=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (isSecure) {
    cookieFlags.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieFlags.join('; '));
};

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { role, pin, doctorId, email, password } = req.body;

  if (email) {
    const authResult = await authService.authenticateUser(email, password || pin || '1234');
    if (authResult) {
      clinicalStore.logAudit(authResult.user.name, 'DOCTOR', 'DOCTOR_LOGIN', 'AuthSession', authResult.user.id);
      setAuthCookie(res, req, authResult.token);
      return res.json({
        success: true,
        token: authResult.token,
        data: { user: authResult.user },
        doctor: authResult.user,
      });
    }
  }

  if (role === 'DOCTOR' || doctorId) {
    const docId = doctorId || 'DOC_DR_VERMA';
    const doctor = clinicalStore.getDoctor(docId);

    if (doctor) {
      if (doctor.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: { message: 'Doctor credentials are suspended by Hospital Administrator. Please contact Medical Superintendent.' },
        });
      }

      if (pin && doctor.pin && pin !== doctor.pin && pin !== '1234') {
        return res.status(401).json({
          success: false,
          error: { message: 'Invalid Clinical PIN. Please enter correct 4-digit PIN.' },
        });
      }

      clinicalStore.logAudit(doctor.name, 'DOCTOR', 'DOCTOR_LOGIN', 'AuthSession', docId);
      const token = authService.generateToken({
        userId: doctor.id,
        name: doctor.name,
        email: doctor.email || 'dr.verma@hospital.aiia.gov.in',
        role: 'DOCTOR',
      });
      setAuthCookie(res, req, token);
      return res.json({
        success: true,
        token,
        data: { user: { id: doctor.id, name: doctor.name, email: doctor.email || 'dr.verma@hospital.aiia.gov.in', role: 'DOCTOR' } },
        doctor,
      });
    }
  }

  const patToken = `PAT_SESSION_${Date.now()}`;
  setAuthCookie(res, req, patToken);
  res.json({ success: true, token: patToken });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  clearAuthCookie(res, req);
  res.json({ success: true, message: 'Logged out successfully' });
});

// Admin Authentication
apiRouter.post('/auth/admin/login', (req: Request, res: Response) => {
  const { pin } = req.body;
  // Default Admin PIN is '9999' or any 4+ digit valid key for demo
  if (pin !== '9999' && pin !== '1234' && (pin || '').length < 4) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid Admin Security Key. (Default: 9999)' },
    });
  }

  const adminUser = {
    id: 'ADMIN_MS_01',
    name: 'Dr. (Col.) S. K. Bhattacharya',
    designation: 'Medical Superintendent & HFR Nodal Officer',
    hfrFacilityId: 'IN-DL-AIIA-00912',
    facilityName: 'All India Institute of Ayurveda & Central Hospital',
    role: 'HOSPITAL_SUPERINTENDENT',
  };

  clinicalStore.logAudit(
    adminUser.name,
    'ADMIN',
    'ADMIN_LOGIN',
    'AdminPortal',
    adminUser.id,
    { facilityId: adminUser.hfrFacilityId }
  );

  res.json({
    success: true,
    token: `ADMIN_JWT_${Date.now()}`,
    admin: adminUser,
  });
});

// ==========================================
// 2.1 Healthcare Professionals (HPR) & Admin Registry
// ==========================================
apiRouter.get('/doctors', (req: Request, res: Response) => {
  const doctors = clinicalStore.getAllDoctors();
  res.json({ success: true, data: doctors });
});

apiRouter.get('/doctors/:doctorId', (req: Request, res: Response) => {
  const doctor = clinicalStore.getDoctor(req.params.doctorId);
  if (!doctor) {
    return res.status(404).json({ success: false, error: { message: 'Doctor not found in registry.' } });
  }
  res.json({ success: true, data: doctor });
});

apiRouter.post('/doctors', (req: Request, res: Response) => {
  const { name, regNo, hprId, department, chamber, role, council, qualification, phone, email, pin } = req.body;
  if (!name || !regNo || !department || !chamber) {
    return res.status(400).json({
      success: false,
      error: { message: 'Physician Name, Registration No, Department, and OPD Chamber are required.' },
    });
  }

  const newDoctor = clinicalStore.registerDoctor({
    name: name.startsWith('Dr.') ? name : `Dr. ${name}`,
    regNo,
    hprId: hprId || `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
    department,
    chamber,
    role: role || 'PHYSICIAN',
    council: council || 'National Medical Commission (NMC)',
    qualification: qualification || 'MBBS / MD',
    phone: phone || '+91 98000 00000',
    email: email || `${name.toLowerCase().replace(/[^a-z]/g, '')}@hospital.gov.in`,
    pin: pin || '1234',
    status: 'ACTIVE',
    avatarInitials: '',
  });

  res.json({ success: true, data: newDoctor });
});

apiRouter.patch('/doctors/:doctorId', (req: Request, res: Response) => {
  const updated = clinicalStore.updateDoctor(req.params.doctorId, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, error: { message: 'Doctor not found.' } });
  }
  res.json({ success: true, data: updated });
});

apiRouter.delete('/doctors/:doctorId', (req: Request, res: Response) => {
  const deleted = clinicalStore.deleteDoctor(req.params.doctorId);
  if (!deleted) {
    return res.status(404).json({ success: false, error: { message: 'Doctor not found.' } });
  }
  res.json({ success: true, message: 'Doctor access revoked successfully.' });
});

// National Healthcare Professionals Registry (HPR) verification simulator
apiRouter.post('/hpr/verify', (req: Request, res: Response) => {
  const { hprId, regNo, council } = req.body;
  
  if (!hprId && !regNo) {
    return res.status(400).json({ success: false, error: { message: 'HPR ID or State Medical Council Reg No is required.' } });
  }

  // Simulated national ABDM HPR response
  const isAyush = (council || '').toLowerCase().includes('ayush') || (regNo || '').toLowerCase().includes('ayush');
  
  setTimeout(() => {
    res.json({
      success: true,
      verified: true,
      data: {
        hprId: hprId || `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
        regNo: regNo || `MCI-2020-${Math.floor(10000 + Math.random() * 90000)}`,
        council: council || (isAyush ? 'National Commission for Indian System of Medicine (NCISM)' : 'National Medical Commission (NMC)'),
        status: 'VERIFIED_ACTIVE',
        kycStatus: 'COMPLETED_AADHAAR_OTP',
        verifiedAt: new Date().toISOString(),
      },
    });
  }, 400);
});

apiRouter.get('/patients/search', async (req: Request, res: Response) => {
  const query = (req.query.query as string) || '';
  const patients = await patientService.searchPatients(query);
  res.json({ success: true, data: patients });
});

apiRouter.get('/patients', async (req: Request, res: Response) => {
  const query = (req.query.query as string) || '';
  const patients = await patientService.searchPatients(query);
  res.json({ success: true, data: patients });
});

apiRouter.post('/patients', async (req: Request, res: Response) => {
  try {
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
    if (idempotencyKey) {
      const cached = clinicalStore.getIdempotentResult(idempotencyKey);
      if (cached) {
        return res.json({ success: true, data: cached, idempotentReuse: true });
      }
    }

    const data = req.body;
    const fullName = data.fullName || data.name;
    const phoneNumber = data.phoneNumber || data.phone;
    const dateOfBirth = data.dateOfBirth || (data.age ? `${new Date().getFullYear() - Number(data.age)}-01-01` : undefined);
    const gender = data.gender || undefined;

    const patient = clinicalStore.registerPatient({
      fullName,
      dateOfBirth,
      gender,
      phoneNumber,
      abhaId: data.abhaId,
      address: data.address,
    });

    if (idempotencyKey) {
      clinicalStore.setIdempotentResult(idempotencyKey, patient);
    }

    // Enqueue for cloud sync in hybrid deployment
    hybridSyncService.enqueue('UPSERT_PATIENT', 'Patient', patient.id, patient);

    // Save asynchronously to PostgreSQL if configured
    dbClient.savePatient(patient);

    res.json({ success: true, data: patient });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

apiRouter.get('/patients/:patientId', async (req: Request, res: Response) => {
  const patient = await patientService.getPatientById(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ success: false, error: { message: 'Patient not found.' } });
  }
  res.json({ success: true, data: patient });
});

// ==========================================
// 3. Encounters & Consent Management
// ==========================================
apiRouter.post('/encounters', (req: Request, res: Response) => {
  const { patientId, mode, language } = req.body;
  const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;
  if (!patientId) {
    return res.status(400).json({ success: false, error: { message: 'patientId is required.' } });
  }

  const encounter = clinicalStore.createEncounter({ patientId, mode, language, idempotencyKey });
  // Enqueue for cloud sync
  hybridSyncService.enqueue('UPSERT_ENCOUNTER', 'Encounter', encounter.id, encounter);
  // Persist asynchronously to PostgreSQL if configured
  dbClient.saveEncounter(encounter);

  res.json({ success: true, data: encounter });
});

apiRouter.get('/encounters', (req: Request, res: Response) => {
  const encounters = clinicalStore.getAllEncounters();
  res.json({ success: true, data: encounters });
});

apiRouter.get('/encounters/:id', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }
  // Run clinical validation pipeline on encounter fetch to ensure facts & contradictions are fresh
  const validationState = runValidationPipeline(encounter);
  encounter.validation = validationState;
  clinicalStore.updateEncounter(encounter.id, { validation: validationState });

  const patient = clinicalStore.getPatient(encounter.patientId);
  res.json({ success: true, data: { encounter, patient } });
});

apiRouter.patch('/encounters/:id', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  const updated = clinicalStore.updateEncounter(encounter.id, req.body);
  if (updated) {
    hybridSyncService.enqueue('UPSERT_ENCOUNTER', 'Encounter', updated.id, updated);
    dbClient.saveEncounter(updated);
  }

  res.json({ success: true, data: updated });
});

// ==========================================
// 3.1 Validation, Contradictions & Review Queue
// ==========================================
apiRouter.get('/encounters/:id/validation', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }
  const validationState = runValidationPipeline(encounter);
  encounter.validation = validationState;
  clinicalStore.updateEncounter(encounter.id, { validation: validationState });
  res.json({ success: true, data: validationState });
});

apiRouter.get('/encounters/:id/review-items', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }
  const validationState = runValidationPipeline(encounter);
  res.json({ success: true, data: validationState.reviewQueue });
});

apiRouter.post('/encounters/:id/facts/:factId/patient-confirm', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }
  const { factId } = req.params;
  const { confirmed } = req.body;

  if (encounter.validation) {
    const fact = encounter.validation.facts.find((f) => f.id === factId);
    if (fact) {
      fact.verificationStatus = confirmed ? 'PATIENT_CONFIRMED' : 'NEEDS_REVIEW';
      fact.reviewRequired = !confirmed;
      clinicalStore.logAudit(encounter.patientId, 'PATIENT', confirmed ? 'FACT_CONFIRMED' : 'FACT_DISPUTED', 'ClinicalFact', factId);
    }
  }

  res.json({ success: true, data: encounter.validation });
});

apiRouter.post('/encounters/:id/review-items/:reviewId/resolve', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }
  const { reviewId } = req.params;
  const { doctorId = 'DOC_DR_VERMA', resolutionNote = 'Verified by attending physician.' } = req.body;

  if (encounter.validation) {
    const reviewItem = encounter.validation.reviewQueue.find((r) => r.id === reviewId);
    if (reviewItem) {
      reviewItem.status = 'RESOLVED';
    }

    if (reviewItem?.contradictionId) {
      const contr = encounter.validation.contradictions.find((c) => c.id === reviewItem.contradictionId);
      if (contr) {
        contr.status = 'DOCTOR_RESOLVED';
        contr.resolvedBy = doctorId;
        contr.resolutionNote = resolutionNote;
        contr.resolvedAt = new Date().toISOString();
        contr.reviewRequired = false;
      }
    }

    if (reviewItem?.factId) {
      const fact = encounter.validation.facts.find((f) => f.id === reviewItem.factId);
      if (fact) {
        fact.verificationStatus = 'DOCTOR_VERIFIED';
        fact.reviewRequired = false;
      }
    }

    clinicalStore.logAudit(doctorId, 'DOCTOR', 'REVIEW_ITEM_RESOLVED', 'ReviewItem', reviewId, { resolutionNote });
  }

  res.json({ success: true, data: encounter.validation });
});

apiRouter.post('/encounters/:id/consent', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  const { status, method, language } = req.body;
  encounter.consent = {
    ...encounter.consent,
    status: status || 'GRANTED',
    method: method || 'AUDIO_GUIDED',
    language: language || encounter.language,
    grantedAt: new Date().toISOString(),
    revokedAt: status === 'REVOKED' ? new Date().toISOString() : null,
  };

  clinicalStore.updateEncounter(encounter.id, { consent: encounter.consent });
  clinicalStore.logAudit(encounter.patientId, 'PATIENT', status === 'REVOKED' ? 'CONSENT_REVOKED' : 'CONSENT_GRANTED', 'ConsentRecord', encounter.id);

  res.json({ success: true, data: encounter.consent });
});

// ==========================================
// 4. Conversational Clinical History Engine
// ==========================================
apiRouter.post('/encounters/:id/history/start', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  const { complaintText, mode } = req.body;
  if (mode) {
    encounter.mode = mode;
  }

  if (complaintText) {
    encounter.history.chiefComplaint = {
      value: complaintText,
      duration: 'Reported during intake',
      source: 'PATIENT_VOICE',
    };
  }

  const firstQuestion = getNextQuestion(encounter.history, encounter.mode, []);
  clinicalStore.updateEncounter(encounter.id, { history: encounter.history, mode: encounter.mode });
  clinicalStore.logAudit(encounter.patientId, 'PATIENT', 'HISTORY_STARTED', 'ClinicalHistoryState', encounter.id);

  res.json({
    success: true,
    data: {
      encounterId: encounter.id,
      historyState: encounter.history,
      nextQuestion: firstQuestion,
    },
  });
});

apiRouter.post('/encounters/:id/history/answer', async (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  const { questionId, answer, source = 'PATIENT_TOUCH', answeredIds = [], rawUtterance = '' } = req.body;

  try {
    const { updatedState, extractedFields } = await processAnswer(
      encounter.history,
      questionId,
      answer,
      source,
      `Language: ${encounter.language}, Mode: ${encounter.mode}`
    );

    encounter.history = updatedState;

    // Check for Red Flags continuously after each answer
    const alerts = evaluateRedFlags(encounter.history, typeof answer === 'string' ? answer : rawUtterance);
    encounter.alerts = alerts;

    if (alerts.length > 0) {
      clinicalStore.logAudit(encounter.patientId, 'SYSTEM', 'RED_FLAG_TRIGGERED', 'RedFlagAlert', encounter.id, {
        alertsCount: alerts.length,
        severities: alerts.map((a) => a.severity),
      });
    }

    const updatedAnsweredIds = Array.from(new Set([...answeredIds, questionId]));
    const nextQuestion = getNextQuestion(encounter.history, encounter.mode, updatedAnsweredIds);

    clinicalStore.updateEncounter(encounter.id, {
      history: encounter.history,
      alerts: encounter.alerts,
    });

    res.json({
      success: true,
      data: {
        updatedHistory: encounter.history,
        extractedFields,
        alerts: encounter.alerts,
        nextQuestion,
        isCompleted: nextQuestion === null,
      },
    });
  } catch (err: any) {
    console.error('Answer processing error:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Error processing response.' } });
  }
});

apiRouter.post('/encounters/:id/history/turn', async (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  const { patientInput = '', conversationHistory = [], accumulatedState = {}, language = encounter.language } = req.body;

  try {
    const result = await processClinicalTurn({
      patientInput,
      conversationHistory,
      accumulatedState,
      language,
    });

    if (result.red_flag_detected && result.red_flag_reason) {
      encounter.alerts.push({
        id: `ALERT_RED_FLAG_${Date.now()}`,
        severity: 'EMERGENCY',
        category: 'CARDIAC',
        title: 'Clinical Red Flag Identified during Intake',
        description: result.red_flag_reason,
        matchedSymptoms: [result.extracted_symptom_data.chief_complaint || 'Red Flag Symptoms'],
        recommendedAction: 'Immediate triage to Emergency Department / Senior Physician evaluation.',
        triggeredAt: new Date().toISOString(),
      });
    }

    if (result.extracted_symptom_data.chief_complaint && !encounter.history.chiefComplaint?.value) {
      encounter.history.chiefComplaint = {
        value: result.extracted_symptom_data.chief_complaint,
        duration: result.extracted_symptom_data.duration || 'Reported during intake',
        source: 'PATIENT_VOICE',
      };
    }

    clinicalStore.updateEncounter(encounter.id, {
      history: encounter.history,
      alerts: encounter.alerts,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[API Turn Processing Error]:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Error processing clinical turn.' } });
  }
});

apiRouter.post('/clinical/turn', async (req: Request, res: Response) => {
  const { patientInput = '', conversationHistory = [], accumulatedState = {}, language = 'en' } = req.body;
  try {
    const result = await processClinicalTurn({
      patientInput,
      conversationHistory,
      accumulatedState,
      language,
    });
    res.json(result);
  } catch (err: any) {
    console.error('[API Standalone Turn Error]:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Error processing standalone turn.' } });
  }
});

apiRouter.get('/encounters/:id/history', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }
  res.json({
    success: true,
    data: {
      history: encounter.history,
      alerts: encounter.alerts,
      documents: encounter.documents,
      timeline: encounter.timeline,
      summary: encounter.summary,
    },
  });
});

// ==========================================
// 5. Document Upload, OCR & Extraction
// ==========================================
apiRouter.post('/encounters/:id/documents', async (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  const { documentType = 'PRESCRIPTION', fileName, mimeType = 'image/jpeg', base64Data, rawText } = req.body;

  if (!fileName && !rawText) {
    return res.status(400).json({ success: false, error: { message: 'File name or content is required.' } });
  }

  const docId = `DOC_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const initialDoc: DocumentRecord = {
    id: docId,
    patientId: encounter.patientId,
    encounterId: encounter.id,
    documentType,
    fileName: fileName || `Document_${docId}.jpg`,
    mimeType,
    uploadDate: new Date().toISOString(),
    extractedText: rawText || '',
    processingStatus: 'PROCESSING',
    previewDataUri: base64Data ? base64Data.slice(0, 200) : undefined,
  };

  clinicalStore.logAudit(encounter.patientId, 'PATIENT', 'DOCUMENT_UPLOADED', 'DocumentRecord', docId, { fileName, documentType });

  // Process OCR and entities
  try {
    const { updatedDoc, timelineEvents } = await processMedicalDocument(initialDoc, base64Data, rawText);

    encounter.documents.push(updatedDoc);
    encounter.timeline.push(...timelineEvents);

    // Sort timeline chronologically
    encounter.timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    clinicalStore.updateEncounter(encounter.id, {
      documents: encounter.documents,
      timeline: encounter.timeline,
    });

    clinicalStore.logAudit(encounter.patientId, 'SYSTEM', 'DOCUMENT_PROCESSED', 'DocumentRecord', docId, {
      medicationsExtracted: updatedDoc.extractedEntities?.medications.length || 0,
      investigationsExtracted: updatedDoc.extractedEntities?.investigations.length || 0,
    });

    res.json({
      success: true,
      data: {
        document: updatedDoc,
        newTimelineEvents: timelineEvents,
        allTimeline: encounter.timeline,
      },
    });
  } catch (err: any) {
    initialDoc.processingStatus = 'FAILED';
    encounter.documents.push(initialDoc);
    clinicalStore.updateEncounter(encounter.id, { documents: encounter.documents });
    res.status(500).json({ success: false, error: { message: 'OCR processing failed.' } });
  }
});

// ==========================================
// 6. Summary Generation & Doctor Verification
// ==========================================
apiRouter.post('/encounters/:id/summary/generate', async (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  // Idempotency: If summary already exists and forceRegenerate is not requested, return existing summary
  if (encounter.summary && !req.body?.forceRegenerate) {
    console.log(`[SUMMARY_IDEMPOTENCY] Encounter ${encounter.id} already has summary ${encounter.summary.id}, returning existing summary (NO-OP)`);
    return res.json({ success: true, data: encounter.summary, idempotentReuse: true });
  }

  try {
    const summary = await generateEncounterSummary(encounter);
    encounter.summary = summary;
    encounter.status = 'AWAITING_DOCTOR_REVIEW';

    clinicalStore.updateEncounter(encounter.id, {
      summary: encounter.summary,
      status: encounter.status,
    });

    clinicalStore.logAudit(encounter.patientId, 'SYSTEM', 'AI_SUMMARY_GENERATED', 'AIClinicalSummary', summary.id);

    // Enqueue summary for cloud synchronization
    hybridSyncService.enqueue('UPSERT_SUMMARY', 'Summary', summary.id, summary);

    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to generate summary.' } });
  }
});

apiRouter.patch('/encounters/:id/summary/edit', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter || !encounter.summary) {
    return res.status(404).json({ success: false, error: { message: 'Encounter or summary not found.' } });
  }

  const { updatedSections, doctorNotes, doctorId = 'DOC_DR_VERMA' } = req.body;

  encounter.summary.sections = {
    ...encounter.summary.sections,
    ...updatedSections,
  };
  if (doctorNotes) {
    encounter.summary.doctorNotes = doctorNotes;
  }

  clinicalStore.updateEncounter(encounter.id, { summary: encounter.summary });
  clinicalStore.logAudit(doctorId, 'DOCTOR', 'SUMMARY_EDITED', 'AIClinicalSummary', encounter.summary.id);

  res.json({ success: true, data: encounter.summary });
});

apiRouter.post('/encounters/:id/summary/confirm', async (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter || !encounter.summary) {
    return res.status(404).json({ success: false, error: { message: 'Encounter or summary not found.' } });
  }

  const { doctorId = 'DOC_DR_VERMA', doctorNotes } = req.body;
  const patient = clinicalStore.getPatient(encounter.patientId);

  encounter.summary.status = 'VERIFIED';
  encounter.summary.verifiedBy = doctorId;
  encounter.summary.verifiedAt = new Date().toISOString();
  if (doctorNotes) {
    encounter.summary.doctorNotes = doctorNotes;
  }
  encounter.status = 'VERIFIED';

  // Automatically trigger HIS and ABDM push in integration layer
  let hisResult = null;
  let abdmResult = null;

  if (patient) {
    try {
      hisResult = await hospitalIntegrationService.syncVerifiedRecord(encounter, patient);
      encounter.hisSyncStatus = 'SYNCED';

      const fhirBundle = mapEncounterToFHIR(encounter, patient);
      abdmResult = await abdmService.pushVerifiedFHIRBundle(fhirBundle);
      encounter.abdmBundleId = abdmResult.bundleId;
    } catch (e) {
      console.error('HIS/ABDM automatic push notice:', e);
    }
  }

  clinicalStore.updateEncounter(encounter.id, {
    summary: encounter.summary,
    status: encounter.status,
    hisSyncStatus: encounter.hisSyncStatus,
    abdmBundleId: encounter.abdmBundleId,
  });

  clinicalStore.logAudit(doctorId, 'DOCTOR', 'SUMMARY_CONFIRMED', 'AIClinicalSummary', encounter.summary.id, {
    verifiedBy: doctorId,
    verifiedAt: encounter.summary.verifiedAt,
  });

  res.json({
    success: true,
    data: {
      summary: encounter.summary,
      encounterStatus: encounter.status,
      hisResult,
      abdmResult,
    },
  });
});

apiRouter.post('/encounters/:id/summary/reject', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter || !encounter.summary) {
    return res.status(404).json({ success: false, error: { message: 'Encounter or summary not found.' } });
  }

  const { doctorId = 'DOC_DR_VERMA', reason } = req.body;
  encounter.summary.status = 'REJECTED';
  encounter.summary.verifiedBy = doctorId;
  encounter.summary.verifiedAt = new Date().toISOString();
  encounter.summary.doctorNotes = reason || 'Rejected by reviewing physician.';
  encounter.status = 'REJECTED';

  clinicalStore.updateEncounter(encounter.id, {
    summary: encounter.summary,
    status: encounter.status,
  });

  clinicalStore.logAudit(doctorId, 'DOCTOR', 'SUMMARY_REJECTED', 'AIClinicalSummary', encounter.summary.id, { reason });

  res.json({ success: true, data: encounter.summary });
});

// ==========================================
// 7. Doctor Queue & Detailed Workstation View
// ==========================================
apiRouter.get('/doctor/encounters', (req: Request, res: Response) => {
  const encounters = clinicalStore.getAllEncounters();
  const queue = encounters.map((enc) => {
    const pat = clinicalStore.getPatient(enc.patientId);

    // Compute triageCategory
    let triageCategory: 'CASUALTY' | 'PRIORITY' | 'ROUTINE' = (enc.triageCategory === 'EMERGENCY' ? 'CASUALTY' : enc.triageCategory as any) || 'ROUTINE';
    const hasEmergencyAlert = (enc.alerts || []).some((a) => a.severity === 'EMERGENCY');
    const hasHighAlert = (enc.alerts || []).some((a) => a.severity === 'HIGH' || a.severity === 'MEDIUM');

    if (enc.isEmergency || enc.status === 'EMERGENCY' || hasEmergencyAlert || enc.triageCategory === 'CASUALTY') {
      triageCategory = 'CASUALTY';
    } else if (hasHighAlert || enc.triageCategory === 'PRIORITY') {
      triageCategory = 'PRIORITY';
    } else {
      triageCategory = 'ROUTINE';
    }

    return {
      id: enc.id,
      patientId: enc.patientId,
      patientName: pat?.name || 'Unknown Patient',
      age: pat?.age || 0,
      gender: pat?.gender || 'OTHER',
      phone: pat?.phone || '',
      abhaId: pat?.abhaId || '',
      tokenNumber: enc.tokenNumber,
      mode: enc.mode,
      status: enc.status,
      triageCategory,
      isEmergency: triageCategory === 'CASUALTY',
      emergencyDetails: enc.emergencyDetails || (triageCategory === 'CASUALTY' ? {
        detectedAt: enc.updatedAt,
        matchedCategory: (enc.alerts || [])[0]?.category || 'CASUALTY',
        matchedSymptoms: (enc.alerts || [])[0]?.matchedSymptoms || [enc.history.chiefComplaint?.value || 'Casualty Referral'],
        staffNotified: false,
        locationNotice: 'Casualty Department (Ground Floor, Red Line)',
      } : undefined),
      chiefComplaint: enc.history.chiefComplaint?.value || 'Intake in progress',
      alerts: enc.alerts || [],
      hasRedFlags: (enc.alerts || []).length > 0,
      documentsCount: (enc.documents || []).length,
      createdAt: enc.createdAt,
      updatedAt: enc.updatedAt,
      summaryStatus: enc.summary?.status || 'NOT_GENERATED',
    };
  });

  // Sort queue: CASUALTY at the top, then PRIORITY, then ROUTINE
  const rankMap: Record<string, number> = { CASUALTY: 0, EMERGENCY: 0, PRIORITY: 1, ROUTINE: 2 };
  queue.sort((a, b) => {
    const diff = (rankMap[a.triageCategory] ?? 2) - (rankMap[b.triageCategory] ?? 2);
    if (diff !== 0) return diff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  res.json({ success: true, data: queue });
});

// Casualty / Emergency Escalation & Staff Notification Endpoints
const handleEscalateCasualty = (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  const { reason = 'Casualty referral symptoms reported by patient', category = 'CASUALTY' } = req.body;

  encounter.status = 'EMERGENCY';
  encounter.triageCategory = 'CASUALTY';
  encounter.isEmergency = true;
  encounter.emergencyDetails = {
    detectedAt: new Date().toISOString(),
    matchedCategory: category,
    matchedSymptoms: [reason],
    staffNotified: false,
    locationNotice: 'Casualty Department (Ground Floor, Red Line)',
  };

  const emergencyAlert = {
    id: `ALERT_MANUAL_${Date.now()}`,
    severity: 'EMERGENCY' as const,
    category: 'OTHER' as const,
    title: 'Casualty Medical Escalation',
    description: reason,
    matchedSymptoms: [reason],
    recommendedAction: 'Immediate triage to Casualty / Attending Physician evaluation.',
    triggeredAt: new Date().toISOString(),
  };

  encounter.alerts.push(emergencyAlert);

  clinicalStore.updateEncounter(encounter.id, {
    status: encounter.status,
    triageCategory: encounter.triageCategory,
    isEmergency: true,
    emergencyDetails: encounter.emergencyDetails,
    alerts: encounter.alerts,
  });

  clinicalStore.logAudit(encounter.patientId, 'PATIENT', 'CASUALTY_ESCALATED', 'ClinicalEncounter', encounter.id, {
    reason,
    category,
  });

  res.json({ success: true, data: encounter });
};

apiRouter.post('/encounters/:id/emergency/escalate', handleEscalateCasualty);
apiRouter.post('/encounters/:id/casualty/escalate', handleEscalateCasualty);

const handleNotifyCasualtyStaff = (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  encounter.emergencyDetails = {
    ...(encounter.emergencyDetails || {
      detectedAt: new Date().toISOString(),
      matchedCategory: 'CASUALTY',
      matchedSymptoms: ['Staff notification requested'],
      locationNotice: 'Casualty Department (Ground Floor, Red Line)',
    }),
    staffNotified: true,
    staffNotifiedAt: new Date().toISOString(),
  };

  clinicalStore.updateEncounter(encounter.id, {
    emergencyDetails: encounter.emergencyDetails,
  });

  clinicalStore.logAudit('KIOSK_SYSTEM', 'SYSTEM', 'CASUALTY_STAFF_NOTIFIED', 'ClinicalEncounter', encounter.id, {
    notifiedAt: encounter.emergencyDetails.staffNotifiedAt,
    tokenNumber: encounter.tokenNumber,
  });

  res.json({
    success: true,
    message: 'Hospital staff and casualty triage team alerted.',
    data: encounter.emergencyDetails,
  });
};

apiRouter.post('/encounters/:id/emergency/notify-staff', handleNotifyCasualtyStaff);
apiRouter.post('/encounters/:id/casualty/notify-staff', handleNotifyCasualtyStaff);

apiRouter.get('/doctor/encounters/:id', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }
  const patient = clinicalStore.getPatient(encounter.patientId);
  res.json({ success: true, data: { encounter, patient } });
});

// ==========================================
// Phase 5 — Clinical Brief & Doctor Action Endpoints
// ==========================================

apiRouter.get('/encounters/:id/clinical-brief', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  const brief = generateClinicalBrief(encounter);
  encounter.brief = brief;
  clinicalStore.updateEncounter(encounter.id, { brief });

  res.json({ success: true, data: brief });
});

apiRouter.get('/encounters/:id/audit-trail', (req: Request, res: Response) => {
  const auditEvents = getEncounterAuditTrail(req.params.id);
  res.json({ success: true, data: auditEvents });
});

apiRouter.post('/encounters/:id/facts/:factId/doctor-confirm', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  if (!encounter.validation?.facts) {
    return res.status(400).json({ success: false, error: { message: 'No facts found for encounter.' } });
  }

  const fact = encounter.validation.facts.find((f) => f.id === req.params.factId);
  if (!fact) {
    return res.status(404).json({ success: false, error: { message: 'Fact not found.' } });
  }

  const prevStatus = fact.verificationStatus;
  fact.verificationStatus = 'DOCTOR_VERIFIED';
  fact.reviewRequired = false;

  recordAuditEvent({
    encounterId: encounter.id,
    factId: fact.id,
    action: 'DOCTOR_VERIFIED',
    previousValue: prevStatus,
    newValue: 'DOCTOR_VERIFIED',
    performedByRole: 'DOCTOR',
    notes: 'Fact verified by physician',
  });

  encounter.validation = runValidationPipeline(encounter);
  clinicalStore.updateEncounter(encounter.id, { validation: encounter.validation });

  res.json({ success: true, data: fact });
});

apiRouter.post('/encounters/:id/facts/:factId/doctor-edit', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  if (!encounter.validation?.facts) {
    return res.status(400).json({ success: false, error: { message: 'No facts found for encounter.' } });
  }

  const fact = encounter.validation.facts.find((f) => f.id === req.params.factId);
  if (!fact) {
    return res.status(404).json({ success: false, error: { message: 'Fact not found.' } });
  }

  const { editedValue } = req.body;
  if (!editedValue) {
    return res.status(400).json({ success: false, error: { message: 'editedValue is required.' } });
  }

  const prevVal = fact.doctorEditedValue || fact.value;
  fact.doctorEditedValue = editedValue;
  fact.verificationStatus = 'DOCTOR_VERIFIED';
  fact.reviewRequired = false;

  recordAuditEvent({
    encounterId: encounter.id,
    factId: fact.id,
    action: 'DOCTOR_EDITED',
    previousValue: prevVal,
    newValue: editedValue,
    performedByRole: 'DOCTOR',
    notes: 'Fact corrected by physician',
  });

  encounter.validation = runValidationPipeline(encounter);
  clinicalStore.updateEncounter(encounter.id, { validation: encounter.validation });

  res.json({ success: true, data: fact });
});

apiRouter.post('/encounters/:id/facts/:factId/doctor-reject', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  if (!encounter.validation?.facts) {
    return res.status(400).json({ success: false, error: { message: 'No facts found for encounter.' } });
  }

  const fact = encounter.validation.facts.find((f) => f.id === req.params.factId);
  if (!fact) {
    return res.status(404).json({ success: false, error: { message: 'Fact not found.' } });
  }

  const { reason = 'Rejected by physician' } = req.body;
  fact.verificationStatus = 'REJECTED';
  fact.rejectedReason = reason;
  fact.reviewRequired = false;

  recordAuditEvent({
    encounterId: encounter.id,
    factId: fact.id,
    action: 'DOCTOR_REJECTED',
    previousValue: fact.value,
    newValue: 'REJECTED',
    performedByRole: 'DOCTOR',
    notes: reason,
  });

  encounter.validation = runValidationPipeline(encounter);
  clinicalStore.updateEncounter(encounter.id, { validation: encounter.validation });

  res.json({ success: true, data: fact });
});

apiRouter.post('/encounters/:id/facts/:factId/flag', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }

  if (!encounter.validation?.facts) {
    return res.status(400).json({ success: false, error: { message: 'No facts found for encounter.' } });
  }

  const fact = encounter.validation.facts.find((f) => f.id === req.params.factId);
  if (!fact) {
    return res.status(404).json({ success: false, error: { message: 'Fact not found.' } });
  }

  fact.flaggedForReview = true;
  fact.reviewRequired = true;

  recordAuditEvent({
    encounterId: encounter.id,
    factId: fact.id,
    action: 'FLAGGED_FOR_REVIEW',
    previousValue: fact.reviewRequired,
    newValue: true,
    performedByRole: 'DOCTOR',
    notes: 'Flagged for senior consultant review',
  });

  res.json({ success: true, data: fact });
});

// ==========================================
// 8. ABDM & HIS Integration Endpoints
// ==========================================
apiRouter.post('/abdm/verify-abha', async (req: Request, res: Response) => {
  const { abhaNumberOrAddress } = req.body;
  if (!abhaNumberOrAddress) {
    return res.status(400).json({ success: false, error: { message: 'abhaNumberOrAddress is required.' } });
  }

  const result = await abdmService.verifyABHA(abhaNumberOrAddress);
  clinicalStore.logAudit('PATIENT_KIOSK', 'SYSTEM', 'ABDM_ABHA_VERIFIED', 'ABDMGateway', abhaNumberOrAddress, { valid: result.valid });
  res.json({ success: true, data: result });
});

apiRouter.get('/abdm/export-fhir/:encounterId', (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.encounterId);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }
  const patient = clinicalStore.getPatient(encounter.patientId);
  if (!patient) {
    return res.status(404).json({ success: false, error: { message: 'Patient not found.' } });
  }

  const fhirBundle = mapEncounterToFHIR(encounter, patient);
  clinicalStore.logAudit('DOC_DR_VERMA', 'SYSTEM', 'FHIR_BUNDLE_EXPORTED', 'FHIRBundle', fhirBundle.id);
  res.json({ success: true, data: fhirBundle });
});

apiRouter.post('/his/sync/:encounterId', async (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.encounterId);
  if (!encounter) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found.' } });
  }
  const patient = clinicalStore.getPatient(encounter.patientId);
  if (!patient) {
    return res.status(404).json({ success: false, error: { message: 'Patient not found.' } });
  }

  const result = await hospitalIntegrationService.syncVerifiedRecord(encounter, patient);
  encounter.hisSyncStatus = 'SYNCED';
  clinicalStore.updateEncounter(encounter.id, { hisSyncStatus: 'SYNCED' });
  clinicalStore.logAudit('SYSTEM', 'SYSTEM', 'HIS_RECORD_SYNCED', 'HISEndpoint', encounter.id, result);

  res.json({ success: true, data: result });
});

// ==========================================
// 9. Audit Logs (DPDP Compliance & Tracing)
// ==========================================
apiRouter.get('/audit/logs', (req: Request, res: Response) => {
  const logs = clinicalStore.getAuditLogs(100);
  res.json({ success: true, data: logs });
});

// ==========================================
// 10. Phase 6 Endpoints (Patient, Encounter, Auth, Print, Dashboard)
// ==========================================



apiRouter.get('/patients/:id', async (req: Request, res: Response) => {
  const patient = await patientService.getPatientById(req.params.id);
  if (!patient) {
    return res.status(404).json({ success: false, error: { message: 'Patient not found' } });
  }
  res.json({ success: true, data: patient });
});

apiRouter.get('/patients/:id/history', async (req: Request, res: Response) => {
  const history = await patientHistoryService.getPatientHistoryOverview(req.params.id);
  if (!history) {
    return res.status(404).json({ success: false, error: { message: 'Patient history not found' } });
  }
  res.json({ success: true, data: history });
});

// Encounter Lifecycle
apiRouter.post('/patients/:patientId/encounters', async (req: Request, res: Response) => {
  try {
    const encounter = await encounterService.createEncounter({
      patientId: req.params.patientId,
      mode: req.body.mode,
      language: req.body.language,
    });
    res.json({ success: true, data: encounter });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

apiRouter.post('/encounters/:id/complete', async (req: Request, res: Response) => {
  const completed = await encounterService.completeEncounter(req.params.id);
  if (!completed) {
    return res.status(404).json({ success: false, error: { message: 'Encounter not found' } });
  }
  res.json({ success: true, data: completed });
});

apiRouter.get('/encounters/:id/print', async (req: Request, res: Response) => {
  const encounter = clinicalStore.getEncounter(req.params.id);
  if (!encounter) {
    return res.status(404).send('Encounter not found');
  }
  const patient = clinicalStore.getPatient(encounter.patientId);
  if (!patient) {
    return res.status(404).send('Patient not found');
  }

  const html = await clinicalRecordPrintService.generatePrintableHtml(encounter, patient);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Authentication & RBAC
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.authenticateUser(email, password);
  if (!result) {
    return res.status(401).json({ success: false, error: { message: 'Invalid credentials or PIN' } });
  }
  res.json({ success: true, data: result });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.headers['x-access-token'] as string;
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)(?:auth_token|session_token|token)=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }
  if (!token) {
    return res.json({
      success: true,
      data: {
        user: { id: 'DOC_DR_VERMA', email: 'dr.verma@hospital.aiia.gov.in', name: 'Dr. Alok Verma', role: 'DOCTOR' },
      },
    });
  }
  const payload = authService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: { message: 'Invalid or expired token' } });
  }
  res.json({ success: true, data: { user: payload } });
});

// Hospital Dashboard Overview
apiRouter.get('/dashboard/overview', async (req: Request, res: Response) => {
  const overview = await dashboardService.getOverview();
  res.json({ success: true, data: overview });
});

// ==========================================
// 11. Phase 7 Adaptive AI Clinical Interview Endpoints
// ==========================================
apiRouter.post('/encounters/:id/interview/start', async (req: Request, res: Response) => {
  const language = (req.body?.language as string) || 'en';
  const result = await adaptiveInterviewService.startInterview(req.params.id, language);
  res.json({ success: true, data: result });
});

apiRouter.post('/encounters/:id/interview/respond', async (req: Request, res: Response) => {
  const { answer, language = 'en', askedQuestionIds = [] } = req.body;
  if (!answer || typeof answer !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'Patient answer is required.' } });
  }

  const result = await adaptiveInterviewService.processResponse(
    req.params.id,
    answer,
    language,
    Array.isArray(askedQuestionIds) ? askedQuestionIds : []
  );
  res.json({ success: true, data: result });
});

apiRouter.get('/encounters/:id/interview', async (req: Request, res: Response) => {
  const state = await adaptiveInterviewService.getOrCreateState(req.params.id);
  const lastAssistantMsg = [...state.conversationHistory].reverse().find((m) => m.role === 'ASSISTANT');
  const questionStr = lastAssistantMsg?.content || '';
  const qId = `turn_${state.questionCount || 1}`;

  const questionObj: StandardizedQuestion = {
    id: qId,
    questionId: qId,
    question: questionStr,
    domain: 'CONVERSATIONAL',
    field: 'dialogue',
    text: questionStr,
    answerType: 'TEXT',
    options: [],
  };

  res.json({
    success: true,
    data: {
      interviewStatus: state.status,
      status: state.status,
      question: questionObj,
      completion: {
        detected: state.status === 'COMPLETED' || state.status === 'PATIENT_FINISHING',
        reason: state.status === 'COMPLETED' ? 'Completed' : undefined,
      },
      completionDetected: state.status === 'COMPLETED' || state.status === 'PATIENT_FINISHING',
      aiResponse: {
        message: questionStr,
        question: questionStr,
        expectsFreeText: true,
        suggestedAnswerType: 'TEXT',
        options: [],
      },
      nextQuestion: questionStr,
      knownFacts: Object.values(state.knownInformation),
      conversationHistory: state.conversationHistory,
      safetyFlags: state.safetyFlags,
      state,
    },
  });
});

apiRouter.post('/encounters/:id/interview/complete', async (req: Request, res: Response) => {
  const completedState = await adaptiveInterviewService.completeInterview(req.params.id);
  const finishMsg = 'Clinical interview completed and structured.';
  const questionObj: StandardizedQuestion = {
    id: 'Q_COMPLETED',
    questionId: 'Q_COMPLETED',
    question: finishMsg,
    domain: 'COMPLETION',
    field: 'completion',
    text: finishMsg,
    answerType: 'TEXT',
    options: [],
  };

  res.json({
    success: true,
    data: {
      interviewStatus: 'COMPLETED',
      status: 'COMPLETED',
      question: questionObj,
      completion: { detected: true, reason: 'Interview completed by patient confirmation' },
      completionDetected: true,
      aiResponse: {
        message: finishMsg,
        question: finishMsg,
        expectsFreeText: false,
        suggestedAnswerType: 'TEXT',
        options: [],
      },
      nextQuestion: finishMsg,
      knownFacts: Object.values(completedState.knownInformation),
      state: completedState,
    },
  });
});

// ==========================================
// 12. Medical Interrogation Engine Endpoints (Ported from ZIP)
// ==========================================
apiRouter.post('/medical/next-question', async (req: Request, res: Response) => {
  try {
    const {
      history = [],
      latestAnswer = '',
      questionNumber = 1,
      structuredHistory = {},
      language = 'en',
      isInitial = false,
      isLanguageSwitch = false,
      priorOcrContext = '',
    } = req.body;

    const result = await getNextMedicalQuestion({
      history,
      latestAnswer,
      questionNumber,
      structuredHistory,
      language,
      isInitial,
      isLanguageSwitch,
      priorOcrContext,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Error in /api/medical/next-question:', error);
    res.status(500).json({ error: error.message || 'Failed to process medical response' });
  }
});

apiRouter.post('/medical/summary', async (req: Request, res: Response) => {
  try {
    const { history = [], structuredHistory = {}, language = 'en', priorOcrContext = '' } = req.body;
    const summary = await generateMedicalSummary({ history, structuredHistory, language, priorOcrContext });
    res.json(summary);
  } catch (error: any) {
    console.error('Error in /api/medical/summary:', error);
    res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
});

