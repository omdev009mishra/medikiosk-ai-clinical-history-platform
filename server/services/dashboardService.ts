import { encounterRepository } from '../db/repositories/encounterRepository';
import { patientRepository } from '../db/repositories/patientRepository';
import { checkOllamaHealth } from '../ai/ollama';
import { checkSpeechServiceHealth } from './speechService';
import { checkOCRServiceHealth } from './ocrService';
import { getDbStatus } from '../db/prisma';

export interface DashboardOverview {
  activity: {
    totalPatients: number;
    totalEncounters: number;
    activeEncounters: number;
    completedEncounters: number;
    waitingForReview: number;
  };
  reviewQueueBreakdown: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
    totalOpenItems: number;
  };
  doctorTriage: {
    readyForReview: Array<{ id: string; patientName: string; tokenNumber: string; chiefComplaint?: string }>;
    underReview: Array<{ id: string; patientName: string; tokenNumber: string }>;
    completed: Array<{ id: string; patientName: string; tokenNumber: string }>;
  };
  systemHealth: {
    overallStatus: 'healthy' | 'degraded';
    database: { status: string; engine: string };
    ollama: { status: string };
    speech: { status: string };
    ocr: { status: string };
  };
}

/**
 * Hospital Dashboard Service (Phase 6.8)
 */
export const dashboardService = {
  async getOverview(): Promise<DashboardOverview> {
    const patients = await patientRepository.search('');
    const encounters = await encounterRepository.findAll();

    const activeEncounters = encounters.filter((e) => e.status !== 'VERIFIED');
    const completedEncounters = encounters.filter((e) => e.status === 'VERIFIED');
    const waitingForReview = encounters.filter((e) => (e.status as string) === 'AWAITING_DOCTOR_REVIEW' || e.status === 'INTAKE_IN_PROGRESS');

    // Review Queue aggregation
    let urgent = 0, high = 0, medium = 0, low = 0;
    encounters.forEach((enc) => {
      if (enc.validation?.reviewQueue) {
        enc.validation.reviewQueue.forEach((item) => {
          if (item.reviewPriority === 'URGENT') urgent++;
          else if (item.reviewPriority === 'HIGH') high++;
          else if (item.reviewPriority === 'MEDIUM') medium++;
          else low++;
        });
      }
    });

    const readyList: Array<{ id: string; patientName: string; tokenNumber: string; chiefComplaint?: string }> = [];
    const underReviewList: Array<{ id: string; patientName: string; tokenNumber: string }> = [];
    const completedList: Array<{ id: string; patientName: string; tokenNumber: string }> = [];

    for (const enc of encounters) {
      const pat = await patientRepository.findById(enc.patientId);
      const name = pat ? pat.name : 'Unknown Patient';
      const item = { id: enc.id, patientName: name, tokenNumber: enc.tokenNumber, chiefComplaint: enc.history?.chiefComplaint?.value };

      if (enc.status === 'VERIFIED') {
        completedList.push(item);
      } else if ((enc.status as string) === 'AWAITING_DOCTOR_REVIEW') {
        underReviewList.push(item);
      } else {
        readyList.push(item);
      }
    }

    // Health Checks
    const dbStatus = await getDbStatus();
    const ollamaStatus = await checkOllamaHealth();
    const speechStatus = await checkSpeechServiceHealth();
    const ocrStatus = await checkOCRServiceHealth();

    const isHealthy =
      dbStatus.status === 'healthy' &&
      ((ollamaStatus.status as string) === 'healthy' || ollamaStatus.status === 'ok') &&
      (speechStatus.status === 'healthy' || speechStatus.status === 'ok') &&
      (ocrStatus.status === 'healthy' || ocrStatus.status === 'ok');

    return {
      activity: {
        totalPatients: patients.length,
        totalEncounters: encounters.length,
        activeEncounters: activeEncounters.length,
        completedEncounters: completedEncounters.length,
        waitingForReview: waitingForReview.length,
      },
      reviewQueueBreakdown: {
        urgent,
        high,
        medium,
        low,
        totalOpenItems: urgent + high + medium + low,
      },
      doctorTriage: {
        readyForReview: readyList,
        underReview: underReviewList,
        completed: completedList,
      },
      systemHealth: {
        overallStatus: isHealthy ? 'healthy' : 'degraded',
        database: dbStatus,
        ollama: ollamaStatus,
        speech: speechStatus,
        ocr: ocrStatus,
      },
    };
  },
};
