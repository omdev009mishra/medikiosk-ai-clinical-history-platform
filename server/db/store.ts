import {
  Patient,
  ClinicalEncounter,
  AuditLog,
  ConsentRecord,
  DocumentRecord,
  TimelineEvent,
  RedFlagAlert,
  AIClinicalSummary,
  DoctorUser,
} from '../types/clinical';
import { evaluateRedFlags } from '../rules/redFlags';
import { patientIdentityService } from '../services/patientIdentityService';

class ClinicalStore {
  private patients: Map<string, Patient> = new Map();
  private encounters: Map<string, ClinicalEncounter> = new Map();
  private doctors: Map<string, DoctorUser> = new Map();
  private auditLogs: AuditLog[] = [];
  private abhaIndex: Map<string, string> = new Map();
  private hospitalIdIndex: Map<string, string> = new Map();
  private idempotencyStore: Map<string, { result: any; createdAt: number }> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // ----------------------------------------------------
    // SEED REGISTERED HEALTHCARE PROFESSIONALS (HPR Registry)
    // ----------------------------------------------------
    const defaultDoctors: DoctorUser[] = [
      {
        id: 'DOC_DR_VERMA',
        name: 'Dr. Alok Verma',
        regNo: 'MCI-2014-98124',
        hprId: '91-8839-2041-9981',
        council: 'Delhi Medical Council / National Medical Commission (NMC)',
        qualification: 'MBBS, MD (General Medicine - AIIMS)',
        department: 'General Medicine & Emergency Triage',
        chamber: 'Chamber 108 (Ground Floor)',
        role: 'CHIEF_CONSULTANT',
        status: 'ON_DUTY',
        phone: '+91 98110 44219',
        email: 'dr.verma@hospital.aiia.gov.in',
        pin: '1234',
        avatarInitials: 'AV',
        joinedAt: '2022-04-10T09:00:00.000Z',
      },
      {
        id: 'DOC_DR_KULKARNI',
        name: 'Dr. Sneha Kulkarni',
        regNo: 'AYUSH-DEL-2016-441',
        hprId: '91-4402-9912-1104',
        council: 'National Commission for Indian System of Medicine (NCISM)',
        qualification: 'BAMS, MD (Kayachikitsa / Panchakarma)',
        department: 'Kayachikitsa & AYUSH OPD',
        chamber: 'Chamber 204 (First Floor)',
        role: 'PHYSICIAN',
        status: 'ON_DUTY',
        phone: '+91 98221 88310',
        email: 'dr.sneha@aiia.gov.in',
        pin: '1234',
        avatarInitials: 'SK',
        joinedAt: '2023-01-15T09:30:00.000Z',
      },
      {
        id: 'DOC_DR_NAIR',
        name: 'Dr. Priya Nair',
        regNo: 'MCI-2018-77219',
        hprId: '91-7719-3320-5592',
        council: 'Maharashtra Medical Council / NMC',
        qualification: 'MBBS, MD (Med), DM (Cardiology)',
        department: 'Cardiology & Critical Care',
        chamber: 'Chamber 102 (ICU Annex)',
        role: 'CHIEF_CONSULTANT',
        status: 'ACTIVE',
        phone: '+91 97182 33410',
        email: 'dr.priya.nair@hospital.aiia.gov.in',
        pin: '1234',
        avatarInitials: 'PN',
        joinedAt: '2023-08-20T10:00:00.000Z',
      },
    ];

    defaultDoctors.forEach((doc) => this.doctors.set(doc.id, doc));

    // ----------------------------------------------------
    // SEED PATIENT A: Emergency Cardiac / Chest Pain Patient
    // ----------------------------------------------------
    const patientA: Patient = {
      id: 'PAT_001',
      abhaId: '91-8273-4412-9012',
      abhaAddress: 'ramesh.kumar54@abdm',
      name: 'Ramesh Kumar',
      age: 54,
      gender: 'MALE',
      phone: '+91 98765 43210',
      address: 'House No. 42, Sector 12, RK Puram, New Delhi',
      registeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    };
    this.patients.set(patientA.id, patientA);
    if (patientA.abhaId) this.abhaIndex.set(patientA.abhaId.toLowerCase(), patientA.id);
    this.hospitalIdIndex.set(patientA.id.toLowerCase(), patientA.id);

    const consentA: ConsentRecord = {
      patientId: patientA.id,
      encounterId: 'ENC_001',
      purposes: ['HISTORY_CAPTURE', 'DOCUMENT_PROCESSING', 'CLINICAL_SUMMARY', 'HIS_SHARING', 'ABDM_RECORD'],
      consentVersion: 'v1.0-DPDP-ABDM',
      language: 'hi',
      method: 'AUDIO_GUIDED',
      status: 'GRANTED',
      grantedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    };

    const docA1: DocumentRecord = {
      id: 'DOC_001',
      patientId: patientA.id,
      encounterId: 'ENC_001',
      documentType: 'LAB_REPORT',
      fileName: 'Lipid_Profile_Report_2026.pdf',
      mimeType: 'application/pdf',
      uploadDate: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      extractedText: 'Comprehensive Metabolic & Lipid Panel. Total Cholesterol: 248 mg/dL (High). Triglycerides: 210 mg/dL (High). LDL: 165 mg/dL. HDL: 38 mg/dL.',
      processingStatus: 'COMPLETED',
      extractedEntities: {
        diagnoses: [{ name: 'Mixed Hyperlipidemia', date: '2026-08-15', confidence: 0.94 }],
        medications: [],
        investigations: [
          {
            id: 'INV_001_1',
            testName: 'Serum Total Cholesterol',
            result: '248',
            unit: 'mg/dL',
            referenceRange: '< 200 mg/dL',
            status: 'HIGH',
            date: '2026-08-15',
            sourceDocument: 'Lipid_Profile_Report_2026.pdf',
            source: 'DOCUMENT_OCR',
          },
          {
            id: 'INV_001_2',
            testName: 'Serum Triglycerides',
            result: '210',
            unit: 'mg/dL',
            referenceRange: '< 150 mg/dL',
            status: 'HIGH',
            date: '2026-08-15',
            sourceDocument: 'Lipid_Profile_Report_2026.pdf',
            source: 'DOCUMENT_OCR',
          },
          {
            id: 'INV_001_3',
            testName: 'Serum LDL Cholesterol',
            result: '165',
            unit: 'mg/dL',
            referenceRange: '< 100 mg/dL',
            status: 'HIGH',
            date: '2026-08-15',
            sourceDocument: 'Lipid_Profile_Report_2026.pdf',
            source: 'DOCUMENT_OCR',
          },
        ],
        procedures: [],
        notes: 'Significant elevation in atherogenic lipid fractions.',
      },
    };

    const docA2: DocumentRecord = {
      id: 'DOC_002',
      patientId: patientA.id,
      encounterId: 'ENC_001',
      documentType: 'PRESCRIPTION',
      fileName: 'Cardiology_OPD_Prescription_July2026.jpg',
      mimeType: 'image/jpeg',
      uploadDate: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      extractedText: 'Rx: Tab. Telmisartan 40mg OD, Tab. Atorvastatin 20mg HS, Tab. Aspirin 75mg OD. Advised low salt diet.',
      processingStatus: 'COMPLETED',
      extractedEntities: {
        diagnoses: [{ name: 'Essential Hypertension', date: '2026-07-10', confidence: 0.96 }],
        medications: [
          {
            id: 'MED_001_1',
            name: 'Tab. Telmisartan',
            dosage: '40 mg',
            frequency: 'Once daily (OD)',
            route: 'Oral',
            duration: 'Continuous',
            sourceDocument: 'Cardiology_OPD_Prescription_July2026.jpg',
            source: 'DOCUMENT_OCR',
          },
          {
            id: 'MED_001_2',
            name: 'Tab. Atorvastatin',
            dosage: '20 mg',
            frequency: 'Once daily at bedtime (HS)',
            route: 'Oral',
            duration: 'Continuous',
            sourceDocument: 'Cardiology_OPD_Prescription_July2026.jpg',
            source: 'DOCUMENT_OCR',
          },
        ],
        investigations: [],
        procedures: [],
      },
    };

    const timelineA: TimelineEvent[] = [
      {
        id: 'TL_001_1',
        date: '2026-07-10',
        title: 'Prescription — Telmisartan 40mg & Atorvastatin',
        category: 'PRESCRIPTION',
        description: 'Prior cardiology prescription for Hypertension & Dyslipidemia management.',
        sourceDocumentId: 'DOC_002',
        sourceDocumentName: 'Cardiology_OPD_Prescription_July2026.jpg',
        isAbnormal: false,
      },
      {
        id: 'TL_001_2',
        date: '2026-08-15',
        title: 'Investigation — Lipid Profile Report',
        category: 'INVESTIGATION',
        description: 'Cholesterol (248 mg/dL) & Triglycerides (210 mg/dL) elevated above reference range.',
        sourceDocumentId: 'DOC_001',
        sourceDocumentName: 'Lipid_Profile_Report_2026.pdf',
        isAbnormal: true,
      },
      {
        id: 'TL_001_3',
        date: '2026-08-30',
        title: 'MediKiosk Intake — Acute Chest Pain Presentation',
        category: 'INTAKE',
        description: 'Acute onset retrosternal chest pain with left arm radiation & sweating.',
        isAbnormal: true,
      },
    ];

    const historyA = {
      chiefComplaint: {
        value: 'Acute retrosternal chest pain (छाती में भारीपन और दर्द)',
        duration: '2 hours',
        source: 'PATIENT_VOICE' as const,
        confidence: 0.96,
      },
      hpi: {
        site: 'Central retrosternal chest',
        onset: 'Sudden onset during rest',
        character: 'Heavy pressure / Squeezing sensation',
        radiation: 'Radiating to left arm and shoulder',
        severity: 8,
        associatedSymptoms: ['Profuse sweating (Diaphoresis)', 'Shortness of breath (Dyspnea)', 'Mild nausea'],
        timing: 'Continuous for 2 hours',
        exacerbatingFactors: ['Mild exertion'],
        relievingFactors: ['None so far'],
      },
      pastMedicalHistory: ['Hypertension (5 years)', 'Dyslipidemia'],
      pastSurgicalHistory: [],
      medications: [
        { id: 'M_A1', name: 'Tab. Telmisartan 40mg', source: 'DOCUMENT_OCR' as const },
        { id: 'M_A2', name: 'Tab. Atorvastatin 20mg', source: 'DOCUMENT_OCR' as const },
      ],
      allergies: [],
      familyHistory: ['Father had myocardial infarction at age 58'],
      personalHistory: {
        smoking: 'Former smoker (quit 2 years ago)',
        alcohol: false,
        diet: 'Mixed Indian diet',
      },
      reviewOfSystems: {
        cardiovascular: ['Chest tightness', 'Left arm radiation'],
        respiratory: ['Mild dyspnea'],
      },
      ayushHistory: {
        prakriti: 'Pitta-Vata',
        agni: 'Vishama Agni',
        koshtha: 'Madhyama',
        aharaVihara: {
          foodHabits: 'Frequent high fat spicy food in recent travel',
          stressLevel: 'High occupational stress',
        },
      },
    };

    const alertsA: RedFlagAlert[] = evaluateRedFlags(historyA, 'Mere seene mein do ghante se tez dard hai aur baye haath me jaa raha hai paseena bhi aa raha hai');

    const summaryA: AIClinicalSummary = {
      id: 'SUM_001',
      encounterId: 'ENC_001',
      patientId: patientA.id,
      status: 'DRAFT',
      generatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      generatedBy: 'MediKiosk AI v2.4 (gemini-3.7-flash)',
      verifiedBy: null,
      verifiedAt: null,
      sections: {
        chiefComplaint: 'Acute retrosternal chest pain for 2 hours with left arm radiation (Severity 8/10).',
        historyOfPresentIllness: '54-year-old male with known HTN and Dyslipidemia presents with acute, sudden-onset retrosternal crushing chest discomfort of 2 hours duration. Pain is described as severe heavy pressure (8/10), non-pleuritic, radiating down the left arm and shoulder. Associated with profuse diaphoresis and mild shortness of breath. No relief with rest.',
        pastMedicalHistory: 'Hypertension (5 years, compliant on Telmisartan 40mg), Dyslipidemia (documented high cholesterol 248 mg/dL on prior lab report).',
        pastSurgicalHistory: 'Nil significant surgical history.',
        drugHistory: 'Tab. Telmisartan 40mg OD, Tab. Atorvastatin 20mg HS.',
        allergyHistory: 'NKDA (No known drug allergies).',
        familyHistory: 'Strong paternal history of early Coronary Artery Disease (father suffered MI at age 58).',
        personalHistory: 'Former smoker (quit 2 years ago). High work-related stress.',
        reviewOfSystems: 'Cardiovascular: Positive for chest pressure, diaphoresis. Respiratory: Mild dyspnea. GI/Neuro: Nil focal deficit.',
        ayushHistory: 'Prakriti: Pitta-Vata; Agni: Vishama Agni; Ahara: High-fat diet, irregular meal timings; Manas: High Rajasic stress.',
        priorInvestigations: 'Lipid Profile (15-Aug-2026): Total Cholesterol 248 mg/dL [HIGH], Triglycerides 210 mg/dL [HIGH], LDL 165 mg/dL [HIGH].',
        currentMedications: 'Tab. Telmisartan 40mg OD, Tab. Atorvastatin 20mg HS.',
        medicalTimelineSummary: 'July 2026: Rx for HTN/Dyslipidemia -> Aug 2026: Abnormal Lipid Profile -> Today: Acute chest pain presentation.',
        redFlagsIdentified: 'CRITICAL ALERT (CARDIAC): Potential Acute Coronary Syndrome. Immediate 12-lead ECG, troponin I/T, oxygenation, and physician evaluation required.',
        provisionalClinicalNotes: 'High pre-test probability for Acute Coronary Syndrome (ACS / NSTEMI / STEMI) in patient with multiple cardiac risk factors.',
      },
    };

    const encounterA: ClinicalEncounter = {
      id: 'ENC_001',
      patientId: patientA.id,
      status: 'AWAITING_DOCTOR_REVIEW',
      mode: 'GENERAL',
      language: 'hi',
      tokenNumber: 'A-101',
      consent: consentA,
      history: historyA,
      documents: [docA1, docA2],
      timeline: timelineA,
      alerts: alertsA,
      summary: summaryA,
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      assignedDoctorId: 'DOC_DR_VERMA',
      hisSyncStatus: 'PENDING',
    };
    this.encounters.set(encounterA.id, encounterA);

    // ----------------------------------------------------
    // SEED PATIENT B: AYUSH Chronic Care / Headache Patient
    // ----------------------------------------------------
    const patientB: Patient = {
      id: 'PAT_002',
      abhaId: '91-1122-3344-5566',
      abhaAddress: 'sunita.devi@abdm',
      name: 'Sunita Devi',
      age: 42,
      gender: 'FEMALE',
      phone: '+91 98112 33445',
      address: 'A-21, Sarita Vihar, New Delhi',
      registeredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.patients.set(patientB.id, patientB);
    if (patientB.abhaId) this.abhaIndex.set(patientB.abhaId.toLowerCase(), patientB.id);
    this.hospitalIdIndex.set(patientB.id.toLowerCase(), patientB.id);

    const consentB: ConsentRecord = {
      patientId: patientB.id,
      encounterId: 'ENC_002',
      purposes: ['HISTORY_CAPTURE', 'DOCUMENT_PROCESSING', 'CLINICAL_SUMMARY', 'HIS_SHARING', 'ABDM_RECORD'],
      consentVersion: 'v1.0-DPDP-ABDM',
      language: 'hi',
      method: 'AUDIO_GUIDED',
      status: 'GRANTED',
      grantedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    };

    const docB1: DocumentRecord = {
      id: 'DOC_003',
      patientId: patientB.id,
      encounterId: 'ENC_002',
      documentType: 'PRESCRIPTION',
      fileName: 'Ayush_AIIA_OPD_Slip_May2026.jpg',
      mimeType: 'image/jpeg',
      uploadDate: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      extractedText: 'AIIA OPD: Ardhavabhedaka / Migraine. Rx: Cap. Brahmi Rasayana 500mg BD with milk, Pathyadi Kwatha 20ml BD with water.',
      processingStatus: 'COMPLETED',
      extractedEntities: {
        diagnoses: [{ name: 'Ardhavabhedaka (Vata-Pitta Shiroroga / Migraine)', date: '2026-05-12', confidence: 0.95 }],
        medications: [
          {
            id: 'MED_002_1',
            name: 'Cap. Brahmi Rasayana',
            dosage: '500 mg',
            frequency: 'Twice daily with warm milk',
            route: 'Oral',
            duration: '60 days',
            sourceDocument: 'Ayush_AIIA_OPD_Slip_May2026.jpg',
            source: 'DOCUMENT_OCR',
          },
          {
            id: 'MED_002_2',
            name: 'Pathyadi Kwatha',
            dosage: '20 ml',
            frequency: 'Twice daily before meals',
            route: 'Oral',
            duration: '30 days',
            sourceDocument: 'Ayush_AIIA_OPD_Slip_May2026.jpg',
            source: 'DOCUMENT_OCR',
          },
        ],
        investigations: [],
        procedures: [],
      },
    };

    const historyB = {
      chiefComplaint: {
        value: 'Throbbing half-sided headache (आधे सिर में धड़कता हुआ तेज दर्द / अर्धभेदक)',
        duration: '3 days',
        source: 'PATIENT_TOUCH' as const,
        confidence: 0.94,
      },
      hpi: {
        site: 'Unilateral right temporal and orbital region',
        onset: 'Gradual throbbing onset in morning, worsening with sunlight',
        character: 'Throbbing and pulsating (टीस मारने वाला दर्द)',
        radiation: 'Radiating to right eye and neck',
        severity: 6,
        associatedSymptoms: ['Photophobia (रोशनी से परेशानी)', 'Nausea (जी मिचलाना)', 'Acid reflux'],
        timing: 'Increases as sun rises (Suryavarta characteristic)',
        exacerbatingFactors: ['Sunlight / Heat exposure', 'Skipping meals', 'Mental stress'],
        relievingFactors: ['Resting in a dark quiet room', 'Cold forehead compress'],
      },
      pastMedicalHistory: ['Migraine with aura (3 years)', 'Hyperacidity (Amlapitta)'],
      pastSurgicalHistory: [],
      medications: [
        { id: 'M_B1', name: 'Cap. Brahmi Rasayana 500mg BD', source: 'DOCUMENT_OCR' as const },
        { id: 'M_B2', name: 'Tab. Paracetamol 650mg SOS', source: 'PATIENT_TOUCH' as const },
      ],
      allergies: [],
      familyHistory: ['Mother also had chronic migraine headaches'],
      personalHistory: {
        smoking: false,
        alcohol: false,
        diet: 'Vegetarian, prone to spicy and fermented foods (Pitta aggravating)',
      },
      reviewOfSystems: {
        neurological: ['Right sided throbbing headache', 'Photophobia'],
        gastrointestinal: ['Nausea', 'Epigastric burning'],
      },
      ayushHistory: {
        prakriti: 'Pitta-Vata (पित्त-वातज प्रकृति)',
        vikriti: 'Pitta-Pradhana Vata Anubandha',
        sara: 'Madhyama',
        samhanana: 'Madhyama',
        pramana: 'Sama',
        satmya: 'Katu-Amla Satmya',
        sattva: 'Madhyama',
        aharaShakti: 'Tikshna Agni prone to Vidagdha Jeerna',
        vyayamaShakti: 'Madhyama',
        vaya: 'Madhyama Vaya (42 years)',
        agni: 'Tikshna Agni (तीक्ष्णाग्नि)',
        koshtha: 'Mridu Koshtha (मृदु कोष्ठ)',
        aharaVihara: {
          dietPreference: 'Vegetarian',
          foodHabits: 'Excessive intake of tea, chilies, fermented batter (Dosa/Idli), irregular lunch',
          sleepPattern: 'Disturbed sleep, late bedtimes (Ratri Jagarana)',
          bowelHabit: 'Loose to normal motions, 1-2 times daily',
          stressLevel: 'Moderate household and work strain',
        },
      },
    };

    const summaryB: AIClinicalSummary = {
      id: 'SUM_002',
      encounterId: 'ENC_002',
      patientId: patientB.id,
      status: 'DRAFT',
      generatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      generatedBy: 'MediKiosk AYUSH Clinical Engine (v2.4 - gemini-3.7-flash)',
      verifiedBy: null,
      verifiedAt: null,
      sections: {
        chiefComplaint: 'Right-sided pulsating headache (Ardhavabhedaka) of 3 days duration with nausea and photophobia.',
        historyOfPresentIllness: '42-year-old female presenting with recurrent episodes of right temporal throbbing headache worsening over the last 3 days. Severity rated 6/10. Symptoms aggravate with sunlight exposure (Suryavarta lakshana) and skipping meals. Associated with mild photophobia, nausea, and burning sensation in epigastrium.',
        pastMedicalHistory: 'History of episodic migraine and Amlapitta (Hyperacidity). Compliant on Ayurvedic formulations.',
        pastSurgicalHistory: 'Nil significant.',
        drugHistory: 'Cap. Brahmi Rasayana 500mg BD, Pathyadi Kwatha 20ml BD, Tab. Paracetamol SOS.',
        allergyHistory: 'NKDA.',
        familyHistory: 'Maternal history of migraine.',
        personalHistory: 'Strict vegetarian. Excessive sour and spicy food intake. Irregular sleep habits (Ratri Jagarana).',
        reviewOfSystems: 'Neurological: Unilateral throbbing headache, photophobia. GI: Hyperacidity, nausea.',
        ayushHistory: 'Dashavidha Pariksha: Prakriti: Pitta-Vata; Vikriti: Pitta-Vata; Agni: Tikshna Agni with Amlapitta tendency; Koshtha: Mridu; Sara/Samhanana: Madhyama; Ahara: Pitta-prakopa ahara (Katu, Amla rasa); Vihara: Ushna-atapa sevana, disturbed Nidra.',
        priorInvestigations: 'Previous AIIA OPD evaluation documented.',
        currentMedications: 'Cap. Brahmi Rasayana 500mg BD, Pathyadi Kwatha 20ml BD.',
        medicalTimelineSummary: 'May 2026: AIIA OPD prescription -> August 2026: Acute headache exacerbation.',
        redFlagsIdentified: 'No neurological red flags (No thunderclap onset, no focal neurological deficits, no meningism). Priority: NORMAL / ROUTINE OPD.',
        provisionalClinicalNotes: 'Compatible with Pitta-Vataja Shiroroga / Ardhavabhedaka (Migraine without aura). Advise Nidana Parivarjana (avoid direct sunlight, timely meals, soothing Pitta-shamaka diet) along with clinical evaluation.',
      },
    };

    const encounterB: ClinicalEncounter = {
      id: 'ENC_002',
      patientId: patientB.id,
      status: 'AWAITING_DOCTOR_REVIEW',
      mode: 'AYUSH',
      language: 'hi',
      tokenNumber: 'B-204',
      consent: consentB,
      history: historyB,
      documents: [docB1],
      timeline: [
        {
          id: 'TL_002_1',
          date: '2026-05-12',
          title: 'AIIA AYUSH OPD Prescription',
          category: 'PRESCRIPTION',
          description: 'Prescribed Brahmi Rasayana & Pathyadi Kwatha for Ardhavabhedaka.',
          sourceDocumentId: 'DOC_003',
          sourceDocumentName: 'Ayush_AIIA_OPD_Slip_May2026.jpg',
        },
        {
          id: 'TL_002_2',
          date: '2026-08-30',
          title: 'MediKiosk AYUSH Intake Session',
          category: 'INTAKE',
          description: 'Captured Dashavidha Pariksha, Ahara-Vihara, and headache severity assessment.',
        },
      ],
      alerts: [],
      summary: summaryB,
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      assignedDoctorId: 'DOC_DR_SHARMA',
      hisSyncStatus: 'PENDING',
    };
    this.encounters.set(encounterB.id, encounterB);

    // Initial audit logs
    this.logAudit('SYSTEM', 'SYSTEM', 'SEED_DATA_INITIALIZED', 'Store', 'ENC_001', { patientCount: 2, encounterCount: 2 });
    this.logAudit('PAT_001', 'PATIENT', 'CONSENT_GRANTED', 'ConsentRecord', 'ENC_001', { version: 'v1.0-DPDP-ABDM' });
    this.logAudit('PAT_001', 'PATIENT', 'RED_FLAG_TRIGGERED', 'RedFlagAlert', 'ENC_001', { alertCount: alertsA.length });
    this.logAudit('PAT_002', 'PATIENT', 'CONSENT_GRANTED', 'ConsentRecord', 'ENC_002', { version: 'v1.0-DPDP-ABDM' });
  }

  // Patients
  getPatient(id: string): Patient | undefined {
    return this.patients.get(id);
  }

  getAllPatients(): Patient[] {
    return Array.from(this.patients.values());
  }

  findPatientByHospitalId(hospitalPatientId: string): Patient | undefined {
    const term = hospitalPatientId.toLowerCase().trim();
    return Array.from(this.patients.values()).find(
      (p) => (p.abhaId && p.abhaId.toLowerCase() === term) || p.id.toLowerCase() === term || (p.phone && p.phone.includes(term))
    );
  }

  searchPatients(query: string): Patient[] {
    const term = query.toLowerCase().trim();
    if (!term) return Array.from(this.patients.values());

    return Array.from(this.patients.values()).filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.phone.includes(term) ||
        (p.abhaId && p.abhaId.toLowerCase().includes(term)) ||
        p.id.toLowerCase().includes(term)
    );
  }

  registerPatient(data: {
    fullName: string;
    dateOfBirth?: string;
    gender?: string;
    phoneNumber: string;
    abhaId?: string;
    address?: string;
  }): Patient {
    // 1. Identity Resolution (Deterministic -> Strong Demographics -> Bayesian)
    const match = patientIdentityService.resolveIdentity(
      {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        abhaId: data.abhaId,
        address: data.address,
      },
      this.getAllPatients()
    );

    if (match.matchLevel === 'CONFIRMED' || match.matchLevel === 'HIGH_CONFIDENCE') {
      const existing = match.matchedPatient!;
      // 2. Deterministic Change Detection
      const comparison = patientIdentityService.comparePatientData(existing, data);

      if (comparison.unchanged) {
        console.log(
          `[PATIENT_IDENTITY_RESOLUTION] Incoming: ${data.fullName} | Candidate: ${existing.id} | Confidence: ${match.matchLevel} (${match.confidence.toFixed(2)}) | Decision: REUSE_EXISTING_PATIENT | Action: NO_OP`
        );
        this.logAudit(existing.id, 'PATIENT', 'PATIENT_IDENTITY_RESOLVED_NOOP', 'Patient', existing.id, {
          confidence: match.confidence,
          matchLevel: match.matchLevel,
          details: match.details,
        });
        return existing;
      }

      console.log(
        `[PATIENT_IDENTITY_RESOLUTION] Patient: ${existing.id} | Decision: REUSE_EXISTING_PATIENT | Changes: ${comparison.newFields.concat(comparison.changedFields).join(', ')} | Action: UPDATE_FIELD`
      );
      this.patients.set(existing.id, comparison.mergedData);
      if (comparison.mergedData.abhaId) {
        this.abhaIndex.set(comparison.mergedData.abhaId.toLowerCase(), existing.id);
      }
      this.logAudit(existing.id, 'PATIENT', 'PATIENT_RECORD_UPDATED', 'Patient', existing.id, {
        newFields: comparison.newFields,
        changedFields: comparison.changedFields,
        confidence: match.confidence,
      });
      return comparison.mergedData;
    }

    const count = this.patients.size + 1;
    const hospitalPatientId = `MK-2026-${count.toString().padStart(6, '0')}`;
    const id = `PAT_${Date.now().toString().slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;

    const patient: Patient = {
      id,
      name: data.fullName,
      age: data.dateOfBirth ? Math.max(1, new Date().getFullYear() - new Date(data.dateOfBirth).getFullYear()) : 30,
      gender: ((data.gender || 'MALE').toUpperCase() === 'FEMALE' ? 'FEMALE' : (data.gender || 'MALE').toUpperCase() === 'OTHER' ? 'OTHER' : 'MALE') as any,
      phone: data.phoneNumber,
      abhaId: data.abhaId || hospitalPatientId,
      address: data.address,
      registeredAt: new Date().toISOString(),
      verifiedIdentity: true,
    };

    this.patients.set(id, patient);
    if (patient.abhaId) {
      this.abhaIndex.set(patient.abhaId.toLowerCase(), id);
    }
    this.hospitalIdIndex.set(hospitalPatientId.toLowerCase(), id);
    this.hospitalIdIndex.set(id.toLowerCase(), id);

    console.log(
      `[PATIENT_IDENTITY_RESOLUTION] Incoming: ${data.fullName} | Decision: CREATE_NEW_PATIENT | ID: ${id} | HospitalID: ${hospitalPatientId}`
    );
    this.logAudit(id, 'PATIENT', 'PATIENT_REGISTERED', 'Patient', id, { hospitalPatientId });
    return patient;
  }

  updatePatient(id: string, updates: Partial<Patient>): Patient | undefined {
    const existing = this.patients.get(id);
    if (!existing) return undefined;

    const comparison = patientIdentityService.comparePatientData(existing, updates as any);
    if (comparison.unchanged) {
      return existing;
    }

    const updated: Patient = { ...existing, ...comparison.mergedData };
    this.patients.set(id, updated);
    if (updated.abhaId) {
      this.abhaIndex.set(updated.abhaId.toLowerCase(), id);
    }
    this.logAudit(id, 'PATIENT', 'PATIENT_RECORD_UPDATED', 'Patient', id, {
      changedFields: comparison.changedFields,
      newFields: comparison.newFields,
    });
    return updated;
  }

  createPatient(patientData: Omit<Patient, 'id' | 'registeredAt'> & { id?: string; fullName?: string; phoneNumber?: string }): Patient {
    const match = patientIdentityService.resolveIdentity(
      {
        id: patientData.id,
        fullName: patientData.name || patientData.fullName,
        phoneNumber: patientData.phone || patientData.phoneNumber,
        age: patientData.age,
        gender: patientData.gender,
        abhaId: patientData.abhaId,
        abhaAddress: patientData.abhaAddress,
        address: patientData.address,
      },
      this.getAllPatients()
    );

    if (match.matchLevel === 'CONFIRMED' || match.matchLevel === 'HIGH_CONFIDENCE') {
      const existing = match.matchedPatient!;
      const comparison = patientIdentityService.comparePatientData(existing, patientData);

      if (comparison.unchanged) {
        console.log(
          `[PATIENT_IDENTITY_RESOLUTION] Incoming: ${patientData.name || patientData.fullName} | Candidate: ${existing.id} | Confidence: ${match.matchLevel} | Decision: REUSE_EXISTING_PATIENT | Action: NO_OP`
        );
        this.logAudit(existing.id, 'PATIENT', 'PATIENT_IDENTITY_RESOLVED_NOOP', 'Patient', existing.id, {
          confidence: match.confidence,
          matchLevel: match.matchLevel,
        });
        return existing;
      }

      console.log(
        `[PATIENT_IDENTITY_RESOLUTION] Patient: ${existing.id} | Decision: REUSE_EXISTING_PATIENT | Changes: ${comparison.newFields.concat(comparison.changedFields).join(', ')} | Action: UPDATE_FIELD`
      );
      this.patients.set(existing.id, comparison.mergedData);
      this.logAudit(existing.id, 'PATIENT', 'PATIENT_RECORD_UPDATED', 'Patient', existing.id, {
        newFields: comparison.newFields,
        changedFields: comparison.changedFields,
      });
      return comparison.mergedData;
    }

    const id = patientData.id || `PAT_${Date.now().toString().slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;
    const patient: Patient = {
      ...patientData,
      id,
      registeredAt: new Date().toISOString(),
    };
    this.patients.set(id, patient);
    if (patient.abhaId) {
      this.abhaIndex.set(patient.abhaId.toLowerCase(), id);
    }
    this.hospitalIdIndex.set(id.toLowerCase(), id);
    this.logAudit(id, 'PATIENT', 'PATIENT_REGISTERED', 'Patient', id);
    return patient;
  }

  // Encounters
  getEncounter(id: string): ClinicalEncounter | undefined {
    return this.encounters.get(id);
  }

  getAllEncounters(): ClinicalEncounter[] {
    return Array.from(this.encounters.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  createEncounter(data: {
    patientId: string;
    mode?: 'GENERAL' | 'AYUSH';
    language?: 'hi' | 'en' | 'mr' | 'gu' | 'bn' | 'ta' | 'te';
    idempotencyKey?: string;
  }): ClinicalEncounter {
    // 1. Check idempotency store
    if (data.idempotencyKey && this.idempotencyStore.has(data.idempotencyKey)) {
      const cached = this.idempotencyStore.get(data.idempotencyKey)!;
      console.log(`[ENCOUNTER_IDEMPOTENCY] Cache hit for key: ${data.idempotencyKey}`);
      return cached.result;
    }

    // 2. Active encounter reuse: if patient already has INTAKE_IN_PROGRESS within last 15 minutes, reuse
    const active = Array.from(this.encounters.values()).find(
      (e) =>
        e.patientId === data.patientId &&
        e.status === 'INTAKE_IN_PROGRESS' &&
        Date.now() - new Date(e.createdAt).getTime() < 15 * 60 * 1000
    );
    if (active) {
      console.log(`[ENCOUNTER_IDEMPOTENCY] Reusing active INTAKE_IN_PROGRESS encounter: ${active.id} for patient: ${data.patientId}`);
      if (data.idempotencyKey) {
        this.idempotencyStore.set(data.idempotencyKey, { result: active, createdAt: Date.now() });
      }
      return active;
    }

    const encounterId = `ENC_${Date.now().toString().slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;
    const tokenNumber = `K-${Math.floor(100 + Math.random() * 900)}`;

    const consent: ConsentRecord = {
      patientId: data.patientId,
      encounterId,
      purposes: ['HISTORY_CAPTURE', 'DOCUMENT_PROCESSING', 'CLINICAL_SUMMARY', 'HIS_SHARING', 'ABDM_RECORD'],
      consentVersion: 'v1.0-DPDP-ABDM',
      language: data.language || 'hi',
      method: 'AUDIO_GUIDED',
      status: 'GRANTED',
      grantedAt: new Date().toISOString(),
    };

    const encounter: ClinicalEncounter = {
      id: encounterId,
      patientId: data.patientId,
      status: 'INTAKE_IN_PROGRESS',
      mode: data.mode || 'GENERAL',
      language: data.language || 'hi',
      tokenNumber,
      consent,
      history: {
        hpi: {},
        pastMedicalHistory: [],
        pastSurgicalHistory: [],
        medications: [],
        allergies: [],
        familyHistory: [],
        personalHistory: {},
        reviewOfSystems: {},
        ayushHistory: {},
      },
      documents: [],
      timeline: [],
      alerts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      hisSyncStatus: 'PENDING',
    };

    this.encounters.set(encounterId, encounter);
    if (data.idempotencyKey) {
      this.idempotencyStore.set(data.idempotencyKey, { result: encounter, createdAt: Date.now() });
    }
    this.logAudit(data.patientId, 'PATIENT', 'ENCOUNTER_CREATED', 'ClinicalEncounter', encounterId);
    return encounter;
  }

  updateEncounter(id: string, updates: Partial<ClinicalEncounter>): ClinicalEncounter | undefined {
    const enc = this.encounters.get(id);
    if (!enc) return undefined;

    let mergedHistory = enc.history;
    if (updates.history) {
      const dedupResult = patientIdentityService.deduplicateClinicalHistory(enc.history, updates.history);
      mergedHistory = dedupResult.history;
    }

    const updated: ClinicalEncounter = {
      ...enc,
      ...updates,
      history: mergedHistory,
      updatedAt: new Date().toISOString(),
    };
    this.encounters.set(id, updated);
    return updated;
  }

  // ==========================================
  // Doctor & HPR Registry Management (Admin Role)
  // ==========================================
  getAllDoctors(): DoctorUser[] {
    return Array.from(this.doctors.values());
  }

  getDoctor(id: string): DoctorUser | undefined {
    return this.doctors.get(id);
  }

  registerDoctor(doctorData: Omit<DoctorUser, 'id' | 'joinedAt'> & { id?: string }): DoctorUser {
    const id = doctorData.id || `DOC_${Date.now().toString().slice(-4)}`;
    const initials = (doctorData.name || 'DR')
      .replace(/^Dr\.\s*/i, '')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'DR';

    const doctor: DoctorUser = {
      ...doctorData,
      id,
      avatarInitials: doctorData.avatarInitials || initials,
      status: doctorData.status || 'ACTIVE',
      pin: doctorData.pin || '1234',
      joinedAt: new Date().toISOString(),
    };

    this.doctors.set(id, doctor);
    this.logAudit('ADMIN_OFFICER', 'ADMIN', 'DOCTOR_REGISTERED_HPR', 'DoctorRegistry', id, {
      doctorName: doctor.name,
      hprId: doctor.hprId,
      department: doctor.department,
      chamber: doctor.chamber,
    });
    return doctor;
  }

  updateDoctor(id: string, updates: Partial<DoctorUser>): DoctorUser | undefined {
    const existing = this.doctors.get(id);
    if (!existing) return undefined;

    const updated: DoctorUser = {
      ...existing,
      ...updates,
    };
    this.doctors.set(id, updated);
    this.logAudit('ADMIN_OFFICER', 'ADMIN', 'DOCTOR_PROFILE_UPDATED', 'DoctorRegistry', id, {
      updatedFields: Object.keys(updates),
    });
    return updated;
  }

  deleteDoctor(id: string): boolean {
    const existing = this.doctors.get(id);
    if (!existing) return false;
    this.doctors.delete(id);
    this.logAudit('ADMIN_OFFICER', 'ADMIN', 'DOCTOR_ACCESS_REVOKED', 'DoctorRegistry', id, {
      revokedDoctor: existing.name,
    });
    return true;
  }

  // Audit Logs
  logAudit(
    actor: string,
    role: 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'SYSTEM',
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>
  ) {
    const log: AuditLog = {
      id: `AUDIT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      actor,
      role,
      action,
      resource,
      resourceId,
      timestamp: new Date().toISOString(),
      details,
    };
    this.auditLogs.unshift(log);
    // Keep max 500 logs in memory
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
  }

  getAuditLogs(limit: number = 100): AuditLog[] {
    return this.auditLogs.slice(0, limit);
  }
}

export const clinicalStore = new ClinicalStore();
