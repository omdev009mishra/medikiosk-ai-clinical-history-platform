import {
  InterviewState,
  InterviewOption,
  StandardizedQuestion,
  InterviewTurnResponse,
} from '../types/interview';
import {
  getNextMedicalQuestion,
  generateMedicalSummary,
  StructuredMedicalHistory,
  MessageTurn,
  GeminiResponse,
} from './medicalInterrogation';
import { clinicalStore } from '../db/store';
import { interviewSafetyService } from './interviewSafetyService';
import { runValidationPipeline } from './clinicalValidationPipeline';
import { generateClinicalExtraction } from '../ai/gemini';
import { generateEncounterSummary } from './summaryGenerator';

const MAX_QUESTIONS = Number(process.env.MAX_ADAPTIVE_INTERVIEW_QUESTIONS) || 14;
const activeInterviewStates: Map<string, InterviewState> = new Map();

function buildPriorOcrContext(encounterId: string): string {
  try {
    const encounter = clinicalStore.getEncounter(encounterId);
    if (!encounter || !encounter.documents || encounter.documents.length === 0) {
      return '';
    }

    return encounter.documents
      .map((d) => {
        const title = `Document [${d.documentType} - ${d.fileName}]`;
        const text = d.extractedText ? `Text: ${d.extractedText.slice(0, 800)}` : '';
        const meds = d.extractedEntities?.medications?.length
          ? `Meds: ${d.extractedEntities.medications.map((m: any) => m.name).join(', ')}`
          : '';
        const labs = d.extractedEntities?.investigations?.length
          ? `Labs: ${d.extractedEntities.investigations.map((i: any) => `${i.testName}=${i.result}`).join(', ')}`
          : '';
        return [title, text, meds, labs].filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n---\n');
  } catch {
    return '';
  }
}

export const adaptiveInterviewService = {
  /**
   * Retrieves an existing active interview state or creates a fresh session.
   */
  async getOrCreateState(encounterId: string, language: string = 'en'): Promise<InterviewState> {
    const existing = activeInterviewStates.get(encounterId);
    if (existing) {
      return existing;
    }

    const encounter = clinicalStore.getEncounter(encounterId);
    const existingHistory = (encounter as any)?.conversationHistory || [];
    const existingKnown = (encounter as any)?.structuredHistory || {};
    const existingStatus = existingHistory.length > 0 ? 'ACTIVE' : 'NOT_STARTED';

    const state: InterviewState = {
      encounterId,
      status: existingStatus,
      conversationHistory: [...existingHistory],
      knownInformation: { ...existingKnown },
      missingInformation: [],
      askedQuestions: [],
      generatedFacts: [],
      questionCount: existingHistory.filter((m: any) => m.role === 'ASSISTANT').length,
      maxQuestions: MAX_QUESTIONS,
      safetyFlags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    activeInterviewStates.set(encounterId, state);
    return state;
  },

  /**
   * Idempotent Interview Start returning natural, empathetic greeting and dynamic category options
   * from the new Medical Interrogation Engine (Gemini / Local fallback).
   */
  async startInterview(encounterId: string, language: string = 'en'): Promise<InterviewTurnResponse> {
    const state = await this.getOrCreateState(encounterId, language);

    // Idempotency check: If already active, return existing last question & state
    if (state.status !== 'NOT_STARTED' && state.conversationHistory.length > 0) {
      console.log(`[Medical Interrogation] Idempotent start hit for encounter ${encounterId}.`);
      const lastAssistantMsg = [...state.conversationHistory].reverse().find((m) => m.role === 'ASSISTANT');
      const questionStr = lastAssistantMsg ? lastAssistantMsg.content : 'Hello, how can I assist you today?';

      const questionObj: StandardizedQuestion = {
        id: `turn_${state.questionCount || 1}`,
        questionId: `turn_${state.questionCount || 1}`,
        question: questionStr,
        domain: 'CONVERSATIONAL',
        field: 'dialogue',
        text: questionStr,
        answerType: 'TEXT',
        options: [],
      };

      return {
        interviewStatus: state.status,
        status: state.status,
        question: questionObj,
        completion: { detected: false },
        completionDetected: false,
        aiResponse: {
          message: questionStr,
          question: questionStr,
          expectsFreeText: true,
          suggestedAnswerType: 'TEXT',
          options: [],
        },
        nextQuestion: questionStr,
        knownFacts: Object.values(state.knownInformation),
        state,
      };
    }

    const priorOcrContext = buildPriorOcrContext(encounterId);

    console.log(`[Medical Interrogation] Generating opening question for encounter ${encounterId} in language ${language}...`);
    const initialResp = await getNextMedicalQuestion({
      history: [],
      latestAnswer: '',
      questionNumber: 1,
      structuredHistory: {},
      language,
      isInitial: true,
      priorOcrContext,
    });

    const openingGreeting = initialResp.assistantMessage;
    const formattedOptions: InterviewOption[] = (initialResp.options || []).map((opt, idx) => ({
      id: `opt_${idx}`,
      label: opt,
      value: opt,
    }));

    state.status = 'ACTIVE';
    state.conversationHistory.push({
      role: 'ASSISTANT',
      content: openingGreeting,
      timestamp: new Date().toISOString(),
    });
    state.questionCount = 1;
    state.updatedAt = new Date().toISOString();

    const enc = clinicalStore.getEncounter(encounterId);
    if (enc) {
      (enc as any).conversationHistory = [...state.conversationHistory];
      (enc as any).structuredHistory = { ...state.knownInformation };
      clinicalStore.updateEncounter(encounterId, {
        history: enc.history,
        ...({ conversationHistory: state.conversationHistory } as any),
      });
    }

    const questionObj: StandardizedQuestion = {
      id: 'turn_1',
      questionId: 'turn_1',
      question: openingGreeting,
      domain: 'CONVERSATIONAL',
      field: 'dialogue',
      text: openingGreeting,
      answerType: formattedOptions.length > 0 ? 'SINGLE_SELECT' : 'TEXT',
      options: formattedOptions,
    };

    return {
      interviewStatus: state.status,
      status: state.status,
      question: questionObj,
      completion: { detected: false },
      completionDetected: false,
      aiResponse: {
        message: openingGreeting,
        question: openingGreeting,
        expectsFreeText: true,
        suggestedAnswerType: formattedOptions.length > 0 ? 'SINGLE_SELECT' : 'TEXT',
        options: formattedOptions,
      },
      nextQuestion: openingGreeting,
      knownFacts: Object.values(state.knownInformation),
      state,
    };
  },

  /**
   * Processes patient response using the new Medical Interrogation Engine (Gemini / Local fallback).
   * Extracts structured medical history, performs red-flag screening, and decides the next question.
   */
  async processResponse(
    encounterId: string,
    patientAnswer: string,
    language: string = 'en',
    clientAskedQuestionIds: string[] = []
  ): Promise<InterviewTurnResponse> {
    const state = await this.getOrCreateState(encounterId, language);

    const previousPatientTurn = [...state.conversationHistory].reverse().find((m) => m.role === 'PATIENT');
    const previousMessage = previousPatientTurn ? previousPatientTurn.content : '(none)';

    console.log(`[MEDICAL DEBUG] Patient transcript received: "${patientAnswer}"`);
    console.log(`[MEDICAL DEBUG] Conversation turns: ${state.conversationHistory.length}`);
    console.log(`[MEDICAL DEBUG] Previous patient message: "${previousMessage}"`);
    console.log('[MEDICAL DEBUG] Generating next question');

    console.log('[INTERVIEW STATE BEFORE]', JSON.stringify(state.knownInformation));
    console.log('[TRANSCRIPT RECEIVED]', patientAnswer);

    // Record patient turn in conversation history
    state.conversationHistory.push({
      role: 'PATIENT',
      content: patientAnswer,
      timestamp: new Date().toISOString(),
    });

    // 1. Immediate Deterministic Red Flag Safety Evaluation
    const activeEncounter = clinicalStore.getEncounter(encounterId);
    const safetyCheck = interviewSafetyService.checkEmergency(patientAnswer, activeEncounter);

    if (safetyCheck.isEmergency && safetyCheck.alert) {
      console.warn(`[Medical Interrogation] DETERMINISTIC EMERGENCY RED FLAG DETECTED for encounter ${encounterId}:`, safetyCheck.alert.title);

      const matchedAlert = safetyCheck.alert;
      const isHi = language.startsWith('hi');
      const escalationMsg = isHi ? safetyCheck.messageHi : safetyCheck.messageEn;

      state.safetyFlags.push({
        trigger: `RED_FLAG_${matchedAlert.category}`,
        source: 'DETERMINISTIC_SAFETY_ENGINE',
        timestamp: new Date().toISOString(),
      });

      if (activeEncounter) {
        activeEncounter.status = 'EMERGENCY';
        activeEncounter.triageCategory = 'CASUALTY';
        activeEncounter.isEmergency = true;
        activeEncounter.emergencyDetails = {
          detectedAt: new Date().toISOString(),
          matchedCategory: matchedAlert.category,
          matchedSymptoms: matchedAlert.matchedSymptoms,
          staffNotified: false,
          locationNotice: 'Casualty Department (Ground Floor, Red Line)',
        };
        if (!activeEncounter.alerts.some((a) => a.id === matchedAlert.id)) {
          activeEncounter.alerts.push(matchedAlert);
        }
        clinicalStore.updateEncounter(encounterId, {
          status: activeEncounter.status,
          triageCategory: activeEncounter.triageCategory,
          isEmergency: true,
          emergencyDetails: activeEncounter.emergencyDetails,
          alerts: activeEncounter.alerts,
        });
      }

      state.conversationHistory.push({
        role: 'ASSISTANT',
        content: escalationMsg,
        timestamp: new Date().toISOString(),
      });

      state.questionCount += 1;
      state.updatedAt = new Date().toISOString();
      state.status = 'EMERGENCY';

      return {
        interviewStatus: 'EMERGENCY',
        status: 'EMERGENCY',
        isEmergency: true,
        emergencyAlert: matchedAlert,
        question: {
          id: `turn_${state.questionCount}`,
          questionId: `turn_${state.questionCount}`,
          question: escalationMsg,
          domain: 'EMERGENCY',
          field: 'urgent_alert',
          text: escalationMsg,
          answerType: 'TEXT',
          options: [],
        },
        completion: {
          detected: true,
          reason: matchedAlert.title || 'Emergency medical alert triggered',
        },
        completionDetected: true,
        aiResponse: {
          message: escalationMsg,
          question: escalationMsg,
          expectsFreeText: false,
          suggestedAnswerType: 'TEXT',
          options: [],
        },
        nextQuestion: escalationMsg,
        knownFacts: Object.values(state.knownInformation),
        state,
      };
    }

    // Format conversation history for Medical Interrogation Engine
    const formattedHistory: MessageTurn[] = state.conversationHistory.slice(0, -1).map((m, idx) => ({
      id: `turn_${idx}`,
      role: m.role === 'PATIENT' ? 'user' : 'assistant',
      message: m.content,
      timestamp: m.timestamp,
    }));

    const priorOcrContext = buildPriorOcrContext(encounterId);

    // Generate response from the new Medical Interrogation Engine
    console.log(`[Medical Interrogation Engine] Generating next medical question for encounter ${encounterId}...`);
    const aiOutput: GeminiResponse = await getNextMedicalQuestion({
      history: formattedHistory,
      latestAnswer: patientAnswer,
      questionNumber: state.questionCount,
      structuredHistory: state.knownInformation,
      language,
      priorOcrContext,
    });

    console.log(`[MEDICAL DEBUG] Next question generated: "${aiOutput.assistantMessage}"`);
    console.log(`[MEDICAL DEBUG] Suggested options:`, JSON.stringify(aiOutput.options || []));
    console.log('[MEDICAL INTERROGATION RESPONSE]', JSON.stringify(aiOutput));

    // Update internal structured history
    if (aiOutput.structuredHistory && typeof aiOutput.structuredHistory === 'object') {
      const sh = aiOutput.structuredHistory;

      // Normalize scalar fields
      if (sh.chiefComplaint) {
        const cc = Array.isArray(sh.chiefComplaint) ? sh.chiefComplaint.join(', ') : String(sh.chiefComplaint);
        state.chiefComplaint = cc;
        state.knownInformation.chiefComplaint = cc;
        state.knownInformation.chief_complaint = cc;
      }
      if (sh.duration) {
        const dur = Array.isArray(sh.duration) ? sh.duration.join(', ') : String(sh.duration);
        state.knownInformation.duration = dur;
        state.knownInformation.onset = dur;
        state.knownInformation.painDuration = dur;
      }
      if (sh.location) {
        const loc = Array.isArray(sh.location) ? sh.location.join(', ') : String(sh.location);
        state.knownInformation.location = loc;
        state.knownInformation.painLocation = loc;
      }
      if (sh.character) {
        const char = Array.isArray(sh.character) ? sh.character.join(', ') : String(sh.character);
        state.knownInformation.character = char;
        state.knownInformation.painCharacter = char;
      }
      if (sh.severity) {
        const sev = Array.isArray(sh.severity) ? sh.severity.join(', ') : String(sh.severity);
        state.knownInformation.severity = sev;
        state.knownInformation.painSeverity = sev;
      }
      if (sh.radiation) {
        const rad = Array.isArray(sh.radiation) ? sh.radiation.join(', ') : String(sh.radiation);
        state.knownInformation.radiation = rad;
      }
      if (sh.symptoms) {
        const syms = Array.isArray(sh.symptoms) ? sh.symptoms : [String(sh.symptoms)];
        state.knownInformation.symptoms = Array.from(new Set([...(state.knownInformation.symptoms || []), ...syms]));
      }
      if (sh.associatedSymptoms) {
        const assoc = Array.isArray(sh.associatedSymptoms) ? sh.associatedSymptoms : [String(sh.associatedSymptoms)];
        state.knownInformation.associatedSymptoms = Array.from(
          new Set([...(state.knownInformation.associatedSymptoms || []), ...assoc])
        );
      }
      if (sh.medications) {
        const meds = Array.isArray(sh.medications) ? sh.medications : [String(sh.medications)];
        state.knownInformation.medications = Array.from(new Set([...(state.knownInformation.medications || []), ...meds]));
      }
      if (sh.allergies) {
        const allg = Array.isArray(sh.allergies) ? sh.allergies : [String(sh.allergies)];
        state.knownInformation.allergies = Array.from(new Set([...(state.knownInformation.allergies || []), ...allg]));
      }
      if (sh.pastMedicalHistory) {
        const pmh = Array.isArray(sh.pastMedicalHistory) ? sh.pastMedicalHistory : [String(sh.pastMedicalHistory)];
        state.knownInformation.pastMedicalHistory = Array.from(
          new Set([...(state.knownInformation.pastMedicalHistory || []), ...pmh])
        );
      }

      // Synchronize SOCRATES structure for physician reports
      state.knownInformation.socrates = {
        site: state.knownInformation.location || null,
        onset: state.knownInformation.duration || null,
        character: state.knownInformation.character || null,
        radiation: state.knownInformation.radiation || null,
        associations: state.knownInformation.associatedSymptoms || [],
        timing: sh.timing || state.knownInformation.socrates?.timing || null,
        exacerbating_relieving: sh.exacerbatingRelieving || state.knownInformation.socrates?.exacerbating_relieving || null,
        severity: state.knownInformation.severity || null,
      };

      // Also sync back to encounter store
      const encounter = clinicalStore.getEncounter(encounterId);
      if (encounter) {
        if (state.chiefComplaint) {
          encounter.history.chiefComplaint = {
            value: state.chiefComplaint,
            duration: state.knownInformation.duration || 'Reported',
            source: 'PATIENT_VOICE',
            confidence: 0.95,
          };
        }
        clinicalStore.updateEncounter(encounterId, { history: encounter.history });
      }
    }

    console.log('[INTERVIEW STATE AFTER]', JSON.stringify(state.knownInformation));

    // Handle Emergency / Red Flag Abort from AI Interrogation Engine
    if (aiOutput.status === 'urgent_stop' || aiOutput.riskLevel === 'urgent') {
      console.warn(`[Medical Interrogation] URGENT RED FLAG DETECTED by AI for encounter ${encounterId}:`, aiOutput.urgentReason);

      const alertId = `ALERT_RED_FLAG_${Date.now()}`;
      const textToScan = `${aiOutput.urgentReason || ''} ${state.chiefComplaint || ''} ${patientAnswer}`.toLowerCase();
      let alertCategory: any = 'OTHER';
      if (textToScan.includes('stroke') || textToScan.includes('neuro') || textToScan.includes('speech') || textToScan.includes('facial') || textToScan.includes('numbness') || textToScan.includes('paralysis')) {
        alertCategory = 'NEUROLOGICAL';
      } else if (textToScan.includes('heart') || textToScan.includes('cardiac') || textToScan.includes('chest pain') || textToScan.includes('angina')) {
        alertCategory = 'CARDIAC';
      } else if (textToScan.includes('breath') || textToScan.includes('respirat') || textToScan.includes('dyspnea') || textToScan.includes('asthma')) {
        alertCategory = 'RESPIRATORY';
      } else if (textToScan.includes('bleed') || textToScan.includes('hemorrhage') || textToScan.includes('khoon')) {
        alertCategory = 'HEMORRHAGE';
      } else if (textToScan.includes('faint') || textToScan.includes('syncope') || textToScan.includes('collapse') || textToScan.includes('unconscious')) {
        alertCategory = 'SYNCOPE';
      }

      const emergencyAlert = {
        id: alertId,
        severity: 'EMERGENCY' as const,
        category: alertCategory,
        title: alertCategory !== 'OTHER' ? `Acute ${alertCategory} Red Flag Detected` : 'Emergency Red Flag Detected',
        description: aiOutput.urgentReason || 'Critical symptoms detected. Immediate emergency medical evaluation advised.',
        matchedSymptoms: [state.chiefComplaint || 'Emergency Clinical Warning'],
        recommendedAction: 'Immediate triage to Emergency Department / Senior Physician evaluation.',
        triggeredAt: new Date().toISOString(),
      };

      state.safetyFlags.push({
        trigger: 'EMERGENCY_RED_FLAG_ABORT',
        source: 'AI_CLINICAL_INTERROGATION',
        timestamp: new Date().toISOString(),
      });

      const encounter = clinicalStore.getEncounter(encounterId);
      if (encounter) {
        encounter.status = 'EMERGENCY';
        encounter.triageCategory = 'CASUALTY';
        encounter.isEmergency = true;
        encounter.emergencyDetails = {
          detectedAt: new Date().toISOString(),
          matchedCategory: alertCategory !== 'OTHER' ? alertCategory : 'CASUALTY',
          matchedSymptoms: emergencyAlert.matchedSymptoms,
          staffNotified: false,
          locationNotice: 'Casualty Department (Ground Floor, Red Line)',
        };
        encounter.alerts.push(emergencyAlert);
        clinicalStore.updateEncounter(encounterId, {
          status: encounter.status,
          triageCategory: encounter.triageCategory,
          isEmergency: true,
          emergencyDetails: encounter.emergencyDetails,
          alerts: encounter.alerts,
        });
      }

      state.conversationHistory.push({
        role: 'ASSISTANT',
        content: aiOutput.assistantMessage,
        timestamp: new Date().toISOString(),
      });

      state.questionCount += 1;
      state.updatedAt = new Date().toISOString();
      state.status = 'EMERGENCY';

      return {
        interviewStatus: 'EMERGENCY',
        status: 'EMERGENCY',
        isEmergency: true,
        emergencyAlert,
        question: {
          id: `turn_${state.questionCount}`,
          questionId: `turn_${state.questionCount}`,
          question: aiOutput.assistantMessage,
          domain: 'EMERGENCY',
          field: 'urgent_alert',
          text: aiOutput.assistantMessage,
          answerType: 'TEXT',
          options: [],
        },
        completion: {
          detected: true,
          reason: aiOutput.urgentReason || 'Emergency medical alert triggered',
        },
        completionDetected: true,
        aiResponse: {
          message: aiOutput.assistantMessage,
          question: aiOutput.assistantMessage,
          expectsFreeText: false,
          suggestedAnswerType: 'TEXT',
          options: [],
        },
        nextQuestion: aiOutput.assistantMessage,
        knownFacts: Object.values(state.knownInformation),
        state,
      };
    }

    // Handle Natural Interview Completion
    if (aiOutput.status === 'complete' || state.questionCount >= MAX_QUESTIONS) {
      console.log(`[Medical Interrogation] Interview complete for encounter ${encounterId}. Finalizing intake...`);

      state.conversationHistory.push({
        role: 'ASSISTANT',
        content: aiOutput.assistantMessage,
        timestamp: new Date().toISOString(),
      });

      state.questionCount += 1;
      state.updatedAt = new Date().toISOString();
      state.status = 'COMPLETED';

      // Execute secondary AI extraction and validation pipeline
      await this.completeInterview(encounterId);

      return {
        interviewStatus: 'COMPLETED',
        status: 'COMPLETED',
        question: {
          id: `turn_${state.questionCount}`,
          questionId: `turn_${state.questionCount}`,
          question: aiOutput.assistantMessage,
          domain: 'COMPLETION',
          field: 'completion',
          text: aiOutput.assistantMessage,
          answerType: 'TEXT',
          options: [],
        },
        completion: { detected: true, reason: 'Clinical history-taking complete' },
        completionDetected: true,
        aiResponse: {
          message: aiOutput.assistantMessage,
          question: aiOutput.assistantMessage,
          expectsFreeText: false,
          suggestedAnswerType: 'TEXT',
          options: [],
        },
        nextQuestion: aiOutput.assistantMessage,
        knownFacts: Object.values(state.knownInformation),
        state,
      };
    }

    // Continue Interrogation: Single Question with Dynamic Options
    state.conversationHistory.push({
      role: 'ASSISTANT',
      content: aiOutput.assistantMessage,
      timestamp: new Date().toISOString(),
    });

    const lastQuestionTurn = [...state.conversationHistory].reverse().find((m) => m.role === 'ASSISTANT');
    const lastAnswerTurn = [...state.conversationHistory].reverse().find((m) => m.role === 'PATIENT');
    console.log(`[MEDICAL DEBUG] Stored conversation history length: ${state.conversationHistory.length}`);
    console.log(`[MEDICAL DEBUG] Last recorded question: "${lastQuestionTurn?.content || ''}"`);
    console.log(`[MEDICAL DEBUG] Last recorded answer: "${lastAnswerTurn?.content || ''}"`);

    state.questionCount += 1;
    state.updatedAt = new Date().toISOString();

    const activeEnc = clinicalStore.getEncounter(encounterId);
    if (activeEnc) {
      (activeEnc as any).conversationHistory = [...state.conversationHistory];
      (activeEnc as any).structuredHistory = { ...state.knownInformation };
      clinicalStore.updateEncounter(encounterId, {
        history: activeEnc.history,
        ...({ conversationHistory: state.conversationHistory } as any),
      });
    }

    const formattedOptions: InterviewOption[] = (aiOutput.options || []).map((opt, idx) => ({
      id: `opt_${idx}`,
      label: opt,
      value: opt,
    }));

    const turnQuestion: StandardizedQuestion = {
      id: `turn_${state.questionCount}`,
      questionId: `turn_${state.questionCount}`,
      question: aiOutput.assistantMessage,
      domain: 'CONVERSATIONAL',
      field: 'dialogue',
      text: aiOutput.assistantMessage,
      answerType: formattedOptions.length > 0 ? 'SINGLE_SELECT' : 'TEXT',
      options: formattedOptions,
      needsClarification: false,
    };

    return {
      interviewStatus: 'ACTIVE',
      status: 'ACTIVE',
      question: turnQuestion,
      completion: { detected: false },
      completionDetected: false,
      aiResponse: {
        message: aiOutput.assistantMessage,
        question: aiOutput.assistantMessage,
        expectsFreeText: true,
        suggestedAnswerType: formattedOptions.length > 0 ? 'SINGLE_SELECT' : 'TEXT',
        options: formattedOptions,
      },
      nextQuestion: aiOutput.assistantMessage,
      knownFacts: Object.values(state.knownInformation),
      state,
    };
  },

  /**
   * Finalizes the interview pipeline.
   * State: COMPLETING -> Structured Summary -> Secondary MedGemma Extraction -> Normalization -> Validation -> COMPLETED
   */
  async completeInterview(encounterId: string): Promise<InterviewState> {
    const state = await this.getOrCreateState(encounterId);
    state.status = 'COMPLETING';
    console.log(`[MediKiosk Completion] Starting interview completion pipeline for encounter ${encounterId}...`);

    try {
      const encounter = clinicalStore.getEncounter(encounterId);
      if (encounter) {
        if (state.chiefComplaint || state.knownInformation.chief_complaint) {
          encounter.history.chiefComplaint = {
            value: state.chiefComplaint || state.knownInformation.chief_complaint || 'Reported Issue',
            duration: state.knownInformation.duration || 'Reported',
            source: 'PATIENT_VOICE',
            confidence: 0.95,
          };
        }

        // 1. Generate Structured Medical Summary from Medical Interrogation Engine
        const priorOcrContext = buildPriorOcrContext(encounterId);
        const historyTurns: MessageTurn[] = state.conversationHistory.map((m) => ({
          role: m.role === 'PATIENT' ? 'user' : 'assistant',
          message: m.content,
          timestamp: m.timestamp,
        }));

        try {
          const finalSummary = await generateMedicalSummary({
            history: historyTurns,
            structuredHistory: state.knownInformation,
            language: encounter.language,
            priorOcrContext,
          });

          (state as any).finalSummary = finalSummary;
          const fullSummary = await generateEncounterSummary(encounter);
          if (finalSummary && finalSummary.title && finalSummary.sections) {
            fullSummary.sections.provisionalClinicalNotes = `${finalSummary.title}\n${finalSummary.sections.map((s) => `${s.label}: ${s.value}`).join('\n')}`;
          }
          encounter.summary = fullSummary;
        } catch (summaryErr) {
          console.warn('[MediKiosk Completion] Summary generation fallback:', summaryErr);
        }

        // 2. Secondary Local AI Processing: MedGemma 1.5 Entity Extraction
        // (Ensures MedGemma validates entities without inventing facts)
        const fullTranscript = state.conversationHistory.map((m) => `${m.role}: ${m.content}`).join('\n');
        const extracted = await generateClinicalExtraction(fullTranscript, encounter.language);

        if (extracted && extracted.entities) {
          if (extracted.entities.medications) {
            encounter.history.medications.push(...extracted.entities.medications);
          }
          if (extracted.entities.allergies) {
            encounter.history.allergies.push(...extracted.entities.allergies);
          }
          if (extracted.entities.diagnoses) {
            encounter.history.pastMedicalHistory.push(...extracted.entities.diagnoses.map((d: any) => d.name));
          }
        }

        // 3. Clinical Validation Pipeline: Cross-checks contradictions with prior OCR records
        runValidationPipeline(encounter);
        clinicalStore.updateEncounter(encounterId, encounter);
      }

      state.status = 'COMPLETED';
      state.updatedAt = new Date().toISOString();
      console.log(`[MediKiosk Completion] Interview completion pipeline successfully executed for ${encounterId}.`);
      return state;
    } catch (err) {
      console.error(`[MediKiosk Completion Error] Failed to execute completion pipeline for ${encounterId}:`, err);
      state.status = 'ERROR';
      state.updatedAt = new Date().toISOString();
      return state;
    }
  },
};
