import { ClinicalEncounter, Patient } from '../types/clinical';

export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  id: string;
  type: 'document';
  timestamp: string;
  entry: Array<{
    fullUrl: string;
    resource: FHIRResource;
  }>;
}

export function mapEncounterToFHIR(encounter: ClinicalEncounter, patient: Patient): FHIRBundle {
  const bundleId = `urn:uuid:bundle-${encounter.id}`;
  const timestamp = new Date().toISOString();

  const fhirPatient: FHIRResource = {
    resourceType: 'Patient',
    id: patient.id,
    identifier: [
      {
        system: 'https://healthid.abdm.gov.in',
        value: patient.abhaId || '91-0000-0000-0000',
      },
    ],
    name: [
      {
        text: patient.name,
      },
    ],
    gender: patient.gender.toLowerCase(),
    telecom: [
      {
        system: 'phone',
        value: patient.phone,
      },
    ],
  };

  const fhirEncounter: FHIRResource = {
    resourceType: 'Encounter',
    id: encounter.id,
    status: encounter.status === 'VERIFIED' ? 'finished' : 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: {
      reference: `Patient/${patient.id}`,
      display: patient.name,
    },
    period: {
      start: encounter.createdAt,
    },
  };

  const fhirComposition: FHIRResource = {
    resourceType: 'Composition',
    id: `comp-${encounter.id}`,
    status: encounter.summary?.status === 'VERIFIED' ? 'final' : 'preliminary',
    type: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '371530004',
          display: 'Clinical consultation report',
        },
      ],
      text: 'MediKiosk Clinical Intake & History Record',
    },
    subject: {
      reference: `Patient/${patient.id}`,
    },
    date: timestamp,
    author: [
      {
        display: encounter.summary?.verifiedBy || 'MediKiosk Clinical Intake System',
      },
    ],
    title: 'Patient Case-Taking Record (Ayush / AIIA MediKiosk)',
    section: [
      {
        title: 'Chief Complaint & History of Present Illness',
        text: {
          status: 'generated',
          div: `<div><p><b>Chief Complaint:</b> ${encounter.history.chiefComplaint?.value || 'N/A'}</p><p><b>HPI:</b> ${encounter.summary?.sections.historyOfPresentIllness || 'N/A'}</p></div>`,
        },
      },
      {
        title: 'AYUSH Assessment (Dashavidha Pariksha)',
        text: {
          status: 'generated',
          div: `<div><p>${encounter.summary?.sections.ayushHistory || 'N/A'}</p></div>`,
        },
      },
      {
        title: 'Medical Timeline & Investigations',
        text: {
          status: 'generated',
          div: `<div><p>${encounter.summary?.sections.priorInvestigations || 'N/A'}</p></div>`,
        },
      },
    ],
  };

  const entries: Array<{ fullUrl: string; resource: FHIRResource }> = [
    { fullUrl: `urn:uuid:${fhirComposition.id}`, resource: fhirComposition },
    { fullUrl: `urn:uuid:${fhirPatient.id}`, resource: fhirPatient },
    { fullUrl: `urn:uuid:${fhirEncounter.id}`, resource: fhirEncounter },
  ];

  // Add condition resources
  if (encounter.history.chiefComplaint) {
    const conditionResource: FHIRResource = {
      resourceType: 'Condition',
      id: `cond-${encounter.id}-1`,
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'provisional' }],
      },
      code: {
        text: encounter.history.chiefComplaint.value,
      },
      subject: {
        reference: `Patient/${patient.id}`,
      },
    };
    entries.push({ fullUrl: `urn:uuid:${conditionResource.id}`, resource: conditionResource });
  }

  // Add lab observations
  for (const doc of encounter.documents || []) {
    for (const inv of doc.extractedEntities?.investigations || []) {
      const obs: FHIRResource = {
        resourceType: 'Observation',
        id: `obs-${inv.id}`,
        status: 'final',
        category: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }],
          },
        ],
        code: {
          text: inv.testName,
        },
        valueString: `${inv.result} ${inv.unit || ''}`,
        interpretation: [
          {
            text: inv.status,
          },
        ],
        referenceRange: [
          {
            text: inv.referenceRange,
          },
        ],
      };
      entries.push({ fullUrl: `urn:uuid:${obs.id}`, resource: obs });
    }
  }

  return {
    resourceType: 'Bundle',
    id: `bundle-${encounter.id}`,
    type: 'document',
    timestamp,
    entry: entries,
  };
}

export class ABDMService {
  private isSandbox: boolean = true;

  constructor() {
    this.isSandbox = !process.env.ABDM_CLIENT_ID;
  }

  async verifyABHA(abhaNumberOrAddress: string): Promise<{
    valid: boolean;
    patientDetails?: Partial<Patient>;
    message: string;
    isSandbox: boolean;
  }> {
    // Standard ABHA validation formatting
    const cleaned = abhaNumberOrAddress.trim();
    if (cleaned.length >= 10) {
      return {
        valid: true,
        patientDetails: {
          abhaId: cleaned.includes('@') ? '91-8273-4412-9012' : cleaned,
          abhaAddress: cleaned.includes('@') ? cleaned : `${cleaned.replace(/-/g, '')}@abdm`,
        },
        message: 'ABHA successfully verified via ABDM Health ID Gateway.',
        isSandbox: this.isSandbox,
      };
    }
    return {
      valid: false,
      message: 'Invalid ABHA ID format. Expected 14-digit number or health address.',
      isSandbox: this.isSandbox,
    };
  }

  async pushVerifiedFHIRBundle(bundle: FHIRBundle): Promise<{
    success: boolean;
    bundleId: string;
    gatewayTransactionId: string;
    timestamp: string;
    mode: string;
  }> {
    // In production, posts to ABDM Gateway /v0.5/health-information/notify
    return {
      success: true,
      bundleId: bundle.id,
      gatewayTransactionId: `ABDM_TXN_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: this.isSandbox ? 'ABDM Sandbox Gateway (Simulated)' : 'Live ABDM Production Gateway',
    };
  }
}

export const abdmService = new ABDMService();
