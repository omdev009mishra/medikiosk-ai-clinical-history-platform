import { Patient, ClinicalHistoryState, MedicationItem, AllergyItem } from '../types/clinical';

export type ClinicalHistory = ClinicalHistoryState;

export type MatchConfidenceLevel = 'CONFIRMED' | 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'NO_MATCH';

export interface BayesianEvidence {
  nameSimilarity: number;
  nameLikelihoodRatio: number;
  phoneMatch: 'EXACT' | 'DIFFERENT' | 'MISSING';
  phoneLikelihoodRatio: number;
  ageMatch: 'EXACT_DOB' | 'EXACT_AGE' | 'WITHIN_TOLERANCE' | 'CONFLICT' | 'MISSING';
  ageLikelihoodRatio: number;
  genderMatch: 'MATCH' | 'CONFLICT' | 'MISSING';
  genderLikelihoodRatio: number;
  priorProbability: number;
  posteriorProbability: number;
}

export interface IdentityMatchResult {
  matchLevel: MatchConfidenceLevel;
  confidence: number;
  matchedPatient: Patient | null;
  matchType: 'DETERMINISTIC_ID' | 'STRONG_DEMOGRAPHIC' | 'BAYESIAN_SIMILARITY' | 'NONE';
  evidence?: BayesianEvidence;
  details: string;
}

export interface PatientComparisonResult {
  unchanged: boolean;
  newFields: string[];
  changedFields: string[];
  duplicateFields: string[];
  conflicts: Array<{ field: string; existingValue: any; incomingValue: any }>;
  mergedData: Patient;
}

export interface ArrayDedupResult<T> {
  merged: T[];
  addedCount: number;
  updatedCount: number;
  duplicateCount: number;
}

// ==========================================
// 1. String Normalization & Similarity
// ==========================================

export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Extract last 10 digits for Indian standard phone numbers
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function normalizeName(name?: string | null): string {
  if (!name) return '';
  let cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ');

  // Strip common honorific titles
  const titles = [
    'mr', 'mrs', 'ms', 'miss', 'dr', 'doctor', 'smt', 'shrimati',
    'shri', 'sri', 'master', 'prof', 'pandit', 'adv', 'er'
  ];

  const tokens = cleaned.split(' ').filter(Boolean);
  const filteredTokens = tokens.filter((t, index) => {
    if (index === 0 && titles.includes(t)) return false;
    return true;
  });

  return filteredTokens.join(' ');
}

export function normalizeGender(gender?: string | null): 'MALE' | 'FEMALE' | 'OTHER' {
  if (!gender) return 'OTHER';
  const g = gender.trim().toUpperCase();
  if (g === 'M' || g === 'MALE' || g === 'PURUSH') return 'MALE';
  if (g === 'F' || g === 'FEMALE' || g === 'MAHILA' || g === 'STREE') return 'FEMALE';
  return 'OTHER';
}

/**
 * Levenshtein distance between two normalized strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Hybrid string similarity metric combining Levenshtein and Token Sort
 * Returns a value between 0.0 (completely distinct) and 1.0 (exact match)
 */
export function calculateNameSimilarity(nameA: string, nameB: string): number {
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);

  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  // Direct Levenshtein ratio
  const maxLen = Math.max(normA.length, normB.length);
  const levDist = levenshteinDistance(normA, normB);
  const directScore = 1.0 - levDist / maxLen;

  // Token sort ratio (e.g. "Kumar Ramesh" vs "Ramesh Kumar")
  const tokensA = normA.split(' ').sort().join(' ');
  const tokensB = normB.split(' ').sort().join(' ');
  const tokenMaxLen = Math.max(tokensA.length, tokensB.length);
  const tokenDist = levenshteinDistance(tokensA, tokensB);
  const tokenScore = 1.0 - tokenDist / tokenMaxLen;

  return Math.max(directScore, tokenScore);
}

// ==========================================
// 2. Bayesian Matching Engine
// ==========================================

/**
 * Evaluates Bayesian match probability between an existing patient and incoming record.
 * Uses Odds formulation: PosteriorOdds = PriorOdds * LikelihoodRatio
 * PosteriorProbability = PosteriorOdds / (1 + PosteriorOdds)
 */
export function computeBayesianEvidence(
  existing: Patient,
  incoming: {
    fullName?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    age?: number;
    gender?: string;
    address?: string;
  }
): BayesianEvidence {
  const prior = 0.10; // Prior probability of a random match in OPD candidate pool
  const priorOdds = prior / (1.0 - prior);

  // 1. Name Similarity
  const nameSim = calculateNameSimilarity(existing.name, incoming.fullName || '');
  let nameLR = 1.0;
  if (nameSim >= 0.95) {
    nameLR = 18.0;
  } else if (nameSim >= 0.85) {
    nameLR = 6.0;
  } else if (nameSim >= 0.70) {
    nameLR = 1.8;
  } else if (nameSim >= 0.50) {
    nameLR = 0.4;
  } else {
    nameLR = 0.04; // Very low likelihood if names differ significantly
  }

  // 2. Phone Match
  const exPhone = normalizePhone(existing.phone);
  const inPhone = normalizePhone(incoming.phoneNumber);
  let phoneMatch: BayesianEvidence['phoneMatch'] = 'MISSING';
  let phoneLR = 1.0;

  if (exPhone && inPhone) {
    if (exPhone === inPhone) {
      phoneMatch = 'EXACT';
      phoneLR = 35.0; // Extremely strong positive identifier
    } else {
      phoneMatch = 'DIFFERENT';
      phoneLR = 0.03; // Strong negative evidence
    }
  }

  // 3. Age / DOB Match
  let ageMatch: BayesianEvidence['ageMatch'] = 'MISSING';
  let ageLR = 1.0;

  let incomingAge = incoming.age;
  if (incomingAge === undefined && incoming.dateOfBirth) {
    const birthYear = new Date(incoming.dateOfBirth).getFullYear();
    if (!isNaN(birthYear)) {
      incomingAge = Math.max(0, new Date().getFullYear() - birthYear);
    }
  }

  if (existing.age !== undefined && incomingAge !== undefined) {
    const ageDiff = Math.abs(existing.age - incomingAge);
    if (ageDiff === 0) {
      ageMatch = 'EXACT_AGE';
      ageLR = 5.0;
    } else if (ageDiff <= 2) {
      ageMatch = 'WITHIN_TOLERANCE';
      ageLR = 2.0;
    } else if (ageDiff > 5) {
      ageMatch = 'CONFLICT';
      ageLR = 0.04;
    } else {
      ageMatch = 'CONFLICT';
      ageLR = 0.3;
    }
  }

  // 4. Gender Match
  let genderMatch: BayesianEvidence['genderMatch'] = 'MISSING';
  let genderLR = 1.0;

  if (existing.gender && incoming.gender) {
    const exGender = normalizeGender(existing.gender);
    const inGender = normalizeGender(incoming.gender);
    if (exGender === inGender) {
      genderMatch = 'MATCH';
      genderLR = 1.8;
    } else {
      genderMatch = 'CONFLICT';
      genderLR = 0.08;
    }
  }

  // 5. Calculate Posterior Probability
  const totalLR = nameLR * phoneLR * ageLR * genderLR;
  const posteriorOdds = priorOdds * totalLR;
  const posterior = posteriorOdds / (1.0 + posteriorOdds);

  return {
    nameSimilarity: nameSim,
    nameLikelihoodRatio: nameLR,
    phoneMatch,
    phoneLikelihoodRatio: phoneLR,
    ageMatch,
    ageLikelihoodRatio: ageLR,
    genderMatch,
    genderLikelihoodRatio: genderLR,
    priorProbability: prior,
    posteriorProbability: posterior,
  };
}

// ==========================================
// 3. Central Identity Resolution Service
// ==========================================

export class PatientIdentityService {
  /**
   * Resolves incoming patient data against existing patients.
   * Priority:
   * Level 1: Deterministic Identifiers (ID, ABHA ID, Hospital Patient ID)
   * Level 2: Strong Demographics (Name + Phone + Gender + DOB/Age)
   * Level 3: Bayesian Similarity (Name + Demographics confidence)
   * CRITICAL SAFETY: Never merge on fuzzy name alone when phone or age conflicts.
   */
  resolveIdentity(
    incoming: {
      id?: string;
      hospitalPatientId?: string;
      hospitalId?: string;
      fullName?: string;
      name?: string;
      phoneNumber?: string;
      phone?: string;
      dateOfBirth?: string;
      age?: number;
      gender?: string;
      abhaId?: string;
      abhaAddress?: string;
      address?: string;
    },
    candidates: Patient[]
  ): IdentityMatchResult {
    const name = incoming.fullName || incoming.name || '';
    const phone = incoming.phoneNumber || incoming.phone || '';
    const abhaId = incoming.abhaId?.trim();
    const incomingId = incoming.id?.trim();
    const hospitalId = (incoming.hospitalPatientId || incoming.hospitalId)?.trim();

    // -----------------------------------------------------------------
    // Priority 1: Deterministic Internal Patient ID Matching
    // -----------------------------------------------------------------
    if (incomingId) {
      const match = candidates.find((p) => p.id.toLowerCase() === incomingId.toLowerCase());
      if (match) {
        return {
          matchLevel: 'CONFIRMED',
          confidence: 1.0,
          matchedPatient: match,
          matchType: 'DETERMINISTIC_ID',
          details: `Exact match on Internal Patient ID: ${incomingId}`,
        };
      }
    }

    // -----------------------------------------------------------------
    // Priority 2: Deterministic Hospital Patient ID Matching
    // -----------------------------------------------------------------
    if (hospitalId) {
      const normHosp = hospitalId.toLowerCase();
      const match = candidates.find(
        (p) =>
          (p.hospitalPatientId && p.hospitalPatientId.toLowerCase() === normHosp) ||
          p.id.toLowerCase() === normHosp
      );
      if (match) {
        return {
          matchLevel: 'CONFIRMED',
          confidence: 1.0,
          matchedPatient: match,
          matchType: 'DETERMINISTIC_ID',
          details: `Exact match on Hospital Patient ID: ${hospitalId}`,
        };
      }
    }

    // -----------------------------------------------------------------
    // Priority 3: Deterministic ABHA ID / Address Matching
    // -----------------------------------------------------------------
    if (abhaId) {
      const normAbha = abhaId.toLowerCase();
      const match = candidates.find(
        (p) =>
          (p.abhaId && p.abhaId.toLowerCase() === normAbha) ||
          (p.abhaAddress && p.abhaAddress.toLowerCase() === normAbha)
      );
      if (match) {
        return {
          matchLevel: 'CONFIRMED',
          confidence: 1.0,
          matchedPatient: match,
          matchType: 'DETERMINISTIC_ID',
          details: `Exact match on ABHA ID: ${abhaId}`,
        };
      }
    }

    // -----------------------------------------------------------------
    // Priority 4: Strong Demographic Matching
    // (Full Name normalized + Mobile exact + Gender + Age/DOB exact)
    // -----------------------------------------------------------------
    const normPhone = normalizePhone(phone);
    const normName = normalizeName(name);

    if (normPhone && normName) {
      for (const candidate of candidates) {
        const cPhone = normalizePhone(candidate.phone);
        if (cPhone === normPhone) {
          const nameSim = calculateNameSimilarity(candidate.name, name);
          if (nameSim >= 0.90) {
            // Check gender & age consistency
            const cGender = normalizeGender(candidate.gender);
            const inGender = incoming.gender ? normalizeGender(incoming.gender) : null;
            const genderMatches = inGender ? cGender === inGender : true;

            let inAge = incoming.age;
            if (inAge === undefined && incoming.dateOfBirth) {
              const bYear = new Date(incoming.dateOfBirth).getFullYear();
              if (!isNaN(bYear)) inAge = new Date().getFullYear() - bYear;
            }
            const ageMatches = inAge !== undefined ? Math.abs(candidate.age - inAge) <= 1 : true;

            if (genderMatches && ageMatches) {
              return {
                matchLevel: 'HIGH_CONFIDENCE',
                confidence: 0.98,
                matchedPatient: candidate,
                matchType: 'STRONG_DEMOGRAPHIC',
                details: `Strong demographic match: Name (${Math.round(nameSim * 100)}%), Mobile, Gender, and Age`,
              };
            }
          }
        }
      }
    }

    // -----------------------------------------------------------------
    // Level 3: Bayesian Similarity Matching
    // -----------------------------------------------------------------
    let bestCandidate: Patient | null = null;
    let highestProbability = 0;
    let bestEvidence: BayesianEvidence | null = null;

    for (const candidate of candidates) {
      const evidence = computeBayesianEvidence(candidate, {
        fullName: name,
        phoneNumber: phone,
        dateOfBirth: incoming.dateOfBirth,
        age: incoming.age,
        gender: incoming.gender,
        address: incoming.address,
      });

      // SAFETY GATE: If phone is explicitly different AND age difference > 3 years,
      // never match or merge even if names are identical!
      if (evidence.phoneMatch === 'DIFFERENT' && evidence.ageMatch === 'CONFLICT') {
        continue;
      }

      if (evidence.posteriorProbability > highestProbability) {
        highestProbability = evidence.posteriorProbability;
        bestCandidate = candidate;
        bestEvidence = evidence;
      }
    }

    if (!bestCandidate || highestProbability < 0.50) {
      return {
        matchLevel: 'NO_MATCH',
        confidence: highestProbability,
        matchedPatient: null,
        matchType: 'NONE',
        details: 'No matching patient record found.',
      };
    }

    // MANDATORY SAFETY CONSTRAINTS:
    // 1. If phone is explicitly DIFFERENT, or age/gender CONFLICTS -> NEVER auto-merge as CONFIRMED or HIGH_CONFIDENCE!
    if (
      bestEvidence?.phoneMatch === 'DIFFERENT' ||
      bestEvidence?.ageMatch === 'CONFLICT' ||
      bestEvidence?.genderMatch === 'CONFLICT'
    ) {
      return {
        matchLevel: 'REVIEW_REQUIRED',
        confidence: highestProbability,
        matchedPatient: bestCandidate,
        matchType: 'BAYESIAN_SIMILARITY',
        evidence: bestEvidence || undefined,
        details: `Conflict detected in Phone, Age, or Gender for similar patient record - Clinician Review Required (Cannot auto-merge)`,
      };
    }

    if (highestProbability >= 0.95) {
      return {
        matchLevel: 'CONFIRMED',
        confidence: highestProbability,
        matchedPatient: bestCandidate,
        matchType: 'BAYESIAN_SIMILARITY',
        evidence: bestEvidence || undefined,
        details: `Bayesian match CONFIRMED (P = ${highestProbability.toFixed(4)})`,
      };
    }

    if (highestProbability >= 0.85) {
      return {
        matchLevel: 'HIGH_CONFIDENCE',
        confidence: highestProbability,
        matchedPatient: bestCandidate,
        matchType: 'BAYESIAN_SIMILARITY',
        evidence: bestEvidence || undefined,
        details: `Bayesian match HIGH_CONFIDENCE (P = ${highestProbability.toFixed(4)})`,
      };
    }

    // Between 0.50 and 0.85 -> Requires human/clinical review; DO NOT auto-merge!
    return {
      matchLevel: 'REVIEW_REQUIRED',
      confidence: highestProbability,
      matchedPatient: bestCandidate,
      matchType: 'BAYESIAN_SIMILARITY',
      evidence: bestEvidence || undefined,
      details: `Ambiguous identity match (P = ${highestProbability.toFixed(4)}) - Review Required`,
    };
  }

  // ==========================================
  // 4. Deterministic Change Detection (NOT Bayesian)
  // ==========================================

  /**
   * Compares an existing patient record with incoming updates.
   * Enforces rules:
   * 1. Identical data -> NO-OP (unchanged = true).
   * 2. New fields -> added to newFields.
   * 3. Genuinely changed fields -> added to changedFields.
   * 4. Never overwrite existing valid data with null, undefined, "", or empty array.
   */
  comparePatientData(existing: Patient, incoming: Partial<Omit<Patient, 'gender'>> & { gender?: string; fullName?: string; phoneNumber?: string }): PatientComparisonResult {
    const newFields: string[] = [];
    const changedFields: string[] = [];
    const duplicateFields: string[] = [];
    const conflicts: Array<{ field: string; existingValue: any; incomingValue: any }> = [];

    const merged: Patient = { ...existing };

    // Standardize incoming field mappings
    const incomingNormalized: Record<string, any> = {
      name: incoming.fullName || incoming.name,
      phone: incoming.phoneNumber || incoming.phone,
      age: incoming.age,
      gender: incoming.gender ? normalizeGender(incoming.gender) : undefined,
      address: incoming.address,
      abhaId: incoming.abhaId,
      abhaAddress: incoming.abhaAddress,
    };

    for (const [key, inVal] of Object.entries(incomingNormalized)) {
      // Rule 4: Never overwrite with null, undefined, or empty string
      if (inVal === undefined || inVal === null || inVal === '') {
        continue;
      }

      const exVal = (existing as any)[key];

      if (exVal === undefined || exVal === null || exVal === '') {
        // Field is new to existing patient
        newFields.push(key);
        (merged as any)[key] = inVal;
      } else {
        // Field already exists; compare normalized values
        let isSame = false;
        if (key === 'phone') {
          isSame = normalizePhone(exVal) === normalizePhone(inVal);
        } else if (key === 'name') {
          isSame = normalizeName(exVal) === normalizeName(inVal);
        } else if (key === 'gender') {
          isSame = normalizeGender(exVal) === normalizeGender(inVal);
        } else if (typeof exVal === 'string' && typeof inVal === 'string') {
          isSame = exVal.trim().toLowerCase() === inVal.trim().toLowerCase();
        } else {
          isSame = exVal === inVal;
        }

        if (isSame) {
          duplicateFields.push(key);
        } else {
          changedFields.push(key);
          conflicts.push({ field: key, existingValue: exVal, incomingValue: inVal });
          // Update genuine changes (e.g. updated phone or address)
          (merged as any)[key] = inVal;
        }
      }
    }

    const unchanged = newFields.length === 0 && changedFields.length === 0;

    return {
      unchanged,
      newFields,
      changedFields,
      duplicateFields,
      conflicts,
      mergedData: merged,
    };
  }

  // ==========================================
  // 5. Array / List Deduplication
  // ==========================================

  /**
   * Generic array deduplication keeping existing items and appending only genuinely new items.
   */
  deduplicateArray<T>(
    existing: T[] = [],
    incoming: T[] = [],
    keyFn: (item: T) => string,
    mergeFn?: (existingItem: T, incomingItem: T) => T
  ): ArrayDedupResult<T> {
    const existingMap = new Map<string, T>();
    let addedCount = 0;
    let updatedCount = 0;
    let duplicateCount = 0;

    for (const item of existing) {
      const key = keyFn(item);
      if (key) existingMap.set(key, item);
    }

    const merged = [...existing];

    for (const item of incoming) {
      const key = keyFn(item);
      if (!key) continue;

      if (existingMap.has(key)) {
        duplicateCount++;
        if (mergeFn) {
          const prev = existingMap.get(key)!;
          const updated = mergeFn(prev, item);
          const idx = merged.indexOf(prev);
          if (idx >= 0) merged[idx] = updated;
          existingMap.set(key, updated);
          updatedCount++;
        }
      } else {
        merged.push(item);
        existingMap.set(key, item);
        addedCount++;
      }
    }

    return {
      merged,
      addedCount,
      updatedCount,
      duplicateCount,
    };
  }

  /**
   * Deduplicate medications by normalized medication name (case-insensitive, ignoring spacing variations).
   */
  deduplicateMedications(existing: MedicationItem[] = [], incoming: MedicationItem[] = []): ArrayDedupResult<MedicationItem> {
    const keyFn = (med: MedicationItem) =>
      med.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();

    const mergeFn = (ex: MedicationItem, inc: MedicationItem): MedicationItem => ({
      ...ex,
      dosage: inc.dosage || ex.dosage,
      frequency: inc.frequency || ex.frequency,
      route: inc.route || ex.route,
      duration: inc.duration || ex.duration,
      source: inc.source || ex.source,
    });

    return this.deduplicateArray(existing, incoming, keyFn, mergeFn);
  }

  /**
   * Deduplicate allergies by allergen name
   */
  deduplicateAllergies(existing: AllergyItem[] = [], incoming: AllergyItem[] = []): ArrayDedupResult<AllergyItem> {
    const keyFn = (item: AllergyItem) => item.allergen.toLowerCase().trim();
    const mergeFn = (ex: AllergyItem, inc: AllergyItem): AllergyItem => ({
      ...ex,
      reaction: inc.reaction || ex.reaction,
      severity: inc.severity || ex.severity,
    });
    return this.deduplicateArray(existing, incoming, keyFn, mergeFn);
  }

  /**
   * Deduplicate string lists (conditions, past medical history, symptoms)
   */
  deduplicateStringList(existing: string[] = [], incoming: string[] = []): ArrayDedupResult<string> {
    const keyFn = (s: string) => s.toLowerCase().trim();
    return this.deduplicateArray(existing, incoming, keyFn);
  }

  /**
   * Deduplicate complete ClinicalHistory structure
   */
  deduplicateClinicalHistory(existing: ClinicalHistory, incoming: Partial<ClinicalHistory>): {
    history: ClinicalHistory;
    changed: boolean;
    additions: { medications: number; allergies: number; conditions: number };
  } {
    const medResult = this.deduplicateMedications(existing.medications, incoming.medications || []);
    const allergyResult = this.deduplicateAllergies(existing.allergies, incoming.allergies || []);
    const pmhResult = this.deduplicateStringList(existing.pastMedicalHistory, incoming.pastMedicalHistory || []);
    const pshResult = this.deduplicateStringList(existing.pastSurgicalHistory, incoming.pastSurgicalHistory || []);
    const famResult = this.deduplicateStringList(existing.familyHistory, incoming.familyHistory || []);

    const changed =
      medResult.addedCount > 0 ||
      medResult.updatedCount > 0 ||
      allergyResult.addedCount > 0 ||
      pmhResult.addedCount > 0 ||
      pshResult.addedCount > 0 ||
      famResult.addedCount > 0;

    const mergedHistory: ClinicalHistory = {
      ...existing,
      medications: medResult.merged,
      allergies: allergyResult.merged,
      pastMedicalHistory: pmhResult.merged,
      pastSurgicalHistory: pshResult.merged,
      familyHistory: famResult.merged,
      hpi: {
        ...existing.hpi,
        ...(incoming.hpi || {}),
        associatedSymptoms: this.deduplicateStringList(
          existing.hpi?.associatedSymptoms || [],
          incoming.hpi?.associatedSymptoms || []
        ).merged,
      },
    };

    return {
      history: mergedHistory,
      changed,
      additions: {
        medications: medResult.addedCount,
        allergies: allergyResult.addedCount,
        conditions: pmhResult.addedCount,
      },
    };
  }
}

export const patientIdentityService = new PatientIdentityService();
