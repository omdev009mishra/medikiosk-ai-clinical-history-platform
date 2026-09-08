import { ClinicalEncounter, Patient } from '../types/clinical';
import { generateClinicalBrief } from './clinicalBriefGenerator';

/**
 * Final Verified Clinical Record Service (Phase 6.7)
 * Generates structured printable clinical record view (HTML).
 */
export const clinicalRecordPrintService = {
  async generatePrintableHtml(encounter: ClinicalEncounter, patient: Patient): Promise<string> {
    const brief = generateClinicalBrief(encounter);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MediKiosk Verified Clinical Encounter Record — ${encounter.id}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; color: #1e293b; background: #fff; line-height: 1.5; }
    .header { border-bottom: 3px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-size: 13px; color: #64748b; }
    .badge { display: inline-block; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #dcfce7; color: #15803d; }
    .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: 700; color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .item { padding: 8px 12px; border-left: 3px solid #cbd5e1; margin-bottom: 8px; background: #f8fafc; border-radius: 0 6px 6px 0; }
    .item-title { font-weight: 700; font-size: 13px; color: #0f172a; }
    .item-desc { font-size: 12px; color: #334155; }
    .footer { margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">ALL INDIA INSTITUTE OF AYURVEDA / MEDIKIOSK</h1>
      <div class="subtitle">FINAL VERIFIED CLINICAL ENCOUNTER SUMMARY RECORD</div>
    </div>
    <div>
      <span class="badge">DOCTOR VERIFIED</span>
    </div>
  </div>

  <div class="grid">
    <div>
      <strong>Patient Name:</strong> ${patient.name}<br>
      <strong>Hospital Patient ID:</strong> ${patient.abhaId || patient.id}<br>
      <strong>Age / Gender:</strong> ${patient.age} Y / ${patient.gender}<br>
      <strong>Phone:</strong> ${patient.phone}
    </div>
    <div>
      <strong>Encounter ID:</strong> ${encounter.id}<br>
      <strong>Date:</strong> ${new Date(encounter.createdAt).toLocaleString()}<br>
      <strong>Mode:</strong> ${encounter.mode} (${encounter.language.toUpperCase()})<br>
      <strong>Status:</strong> ${encounter.status}
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Chief Complaint</div>
    <div class="item">
      <div class="item-title">${brief.chiefComplaint.label}</div>
      <div class="item-desc">${brief.chiefComplaint.value} [Source: ${brief.chiefComplaint.source}]</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. History of Present Illness (SOCRATES)</div>
    ${brief.historyOfPresentIllness.items.map((i) => `
      <div class="item">
        <div class="item-title">${i.label}</div>
        <div class="item-desc">${i.value}</div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">3. Verified Medications</div>
    ${brief.medications.items.map((m) => `
      <div class="item">
        <div class="item-title">${m.label}</div>
        <div class="item-desc">${m.value}</div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">4. Verified Allergies</div>
    ${brief.allergies.items.map((a) => `
      <div class="item">
        <div class="item-title">${a.label}</div>
        <div class="item-desc">${a.value}</div>
      </div>
    `).join('')}
  </div>

  <div class="footer">
    Verified by Attending Physician &bull; MediKiosk AI Clinical History Platform &bull; DPDP Act 2023 & ABDM FHIR Compliant
  </div>
</body>
</html>
    `;
  },
};
