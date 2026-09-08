/**
 * Clinical Data Normalization Engine
 * Provides deterministic normalization for medications, dosages, lab units, and dates.
 */

export interface NormalizedDosage {
  amount: number;
  unit: string;
  originalText: string;
}

export interface NormalizedMedication {
  canonicalName: string;
  rawName: string;
  dosage?: NormalizedDosage;
  frequency?: string;
  route?: string;
}

export interface NormalizedLabResult {
  canonicalTestName: string;
  rawTestName: string;
  numericResult?: number;
  rawResult: string;
  normalizedUnit?: string;
  rawUnit?: string;
  referenceRange?: string;
}

export interface NormalizedDate {
  isoDate?: string;
  originalText: string;
  isAmbiguous: boolean;
}

/**
 * Normalizes medication names and dosages.
 */
export function normalizeMedication(name: string, rawDosage?: string, frequency?: string, route?: string): NormalizedMedication {
  let cleanName = (name || '')
    .trim()
    .replace(/^(Tab\.|Cap\.|Syrup|Syp\.|Inj\.|Cap|Tab|Injn)\s+/i, '')
    .replace(/\s*\(\w+\)$/, '')
    .trim();

  let extractedDosage = rawDosage;
  let extractedFreq = frequency;

  // If dosage is missing, check if dosage is embedded in name (e.g. "Telmisartan 40mg")
  if (!extractedDosage) {
    const doseMatch = cleanName.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|gm|ml|mcg))\b/i);
    if (doseMatch) {
      extractedDosage = doseMatch[1];
      cleanName = cleanName.replace(doseMatch[1], '').trim();
    }
  }

  // If frequency is missing, check if frequency is embedded in name (e.g. "OD", "BD", "Once daily")
  if (!extractedFreq) {
    const freqMatch = cleanName.match(/\b(OD|BD|TDS|QID|HS|SOS|Once daily|Twice daily)\b/i);
    if (freqMatch) {
      extractedFreq = freqMatch[1];
      cleanName = cleanName.replace(freqMatch[1], '').trim();
    }
  }

  const canonicalName = cleanName.toLowerCase().trim();
  const dosage = extractedDosage ? normalizeDosage(extractedDosage) : undefined;

  return {
    canonicalName,
    rawName: name,
    dosage,
    frequency: extractedFreq?.trim(),
    route: route?.trim() || 'Oral',
  };
}

/**
 * Normalizes dosage amounts and units using deterministic conversion.
 */
export function normalizeDosage(dosageStr: string): NormalizedDosage {
  const trimmed = (dosageStr || '').trim();
  
  // Match "500 mg", "500mg", "0.5 g", "5 ml"
  const match = trimmed.match(/^([\d.]+)\s*([a-zA-C%gml/]+)/i);
  if (match) {
    let val = parseFloat(match[1]);
    let unit = match[2].toLowerCase();

    // Deterministic unit conversion: 0.5 g -> 500 mg
    if (unit === 'g' || unit === 'gm' || unit === 'grams') {
      val = val * 1000;
      unit = 'mg';
    } else if (unit === 'mcg' || unit === 'ug') {
      val = val / 1000;
      unit = 'mg';
    }

    return {
      amount: val,
      unit,
      originalText: dosageStr,
    };
  }

  return {
    amount: 0,
    unit: trimmed,
    originalText: dosageStr,
  };
}

/**
 * Normalizes lab test names and units.
 */
export function normalizeLabResult(testName: string, resultStr: string, unitStr?: string, refRange?: string): NormalizedLabResult {
  const cleanTestName = (testName || '').trim();
  let canonicalName = cleanTestName.toLowerCase()
    .replace(/^(serum|blood|plasma)\s+/i, '')
    .replace(/\s+level$/, '')
    .trim();

  // Normalize common test synonyms
  if (canonicalName.includes('cholesterol') && canonicalName.includes('total')) {
    canonicalName = 'total_cholesterol';
  } else if (canonicalName.includes('triglyceride')) {
    canonicalName = 'triglycerides';
  } else if (canonicalName.includes('hba1c') || canonicalName.includes('glycated hemoglobin')) {
    canonicalName = 'hba1c';
  } else if (canonicalName.includes('creatinine')) {
    canonicalName = 'creatinine';
  }

  let normalizedUnit = (unitStr || '').trim().toLowerCase();
  if (normalizedUnit === 'mg per dl' || normalizedUnit === 'mg/dl') {
    normalizedUnit = 'mg/dL';
  } else if (normalizedUnit === '%') {
    normalizedUnit = '%';
  }

  const numVal = parseFloat(resultStr);

  return {
    canonicalTestName: canonicalName,
    rawTestName: testName,
    numericResult: isNaN(numVal) ? undefined : numVal,
    rawResult: resultStr,
    normalizedUnit: normalizedUnit || unitStr,
    rawUnit: unitStr,
    referenceRange: refRange,
  };
}

/**
 * Normalizes dates and flags ambiguous numeric representations (e.g. 04/05/2025).
 */
export function normalizeDate(dateStr: string): NormalizedDate {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) {
    return { originalText: '', isAmbiguous: false };
  }

  // Check YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { isoDate: trimmed, originalText: dateStr, isAmbiguous: false };
  }

  // Check DD-Mon-YYYY or DD Mon YYYY (e.g. 15-Aug-2026, 12 May 2026)
  const monMatch = trimmed.match(/^(\d{1,2})[-/\s]+([a-zA-Z]{3,9})[-/\s]+(\d{4})$/);
  if (monMatch) {
    const day = monMatch[1].padStart(2, '0');
    const monthStr = monMatch[2];
    const year = monMatch[3];
    const dateObj = new Date(`${monthStr} ${day}, ${year}`);
    if (!isNaN(dateObj.getTime())) {
      const iso = dateObj.toISOString().split('T')[0];
      return { isoDate: iso, originalText: dateStr, isAmbiguous: false };
    }
  }

  // Check numeric slash dates (e.g., 04/05/2025 - is it April 5 or May 4?)
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    // If both part 1 and part 2 are <= 12 and not identical, date format is ambiguous!
    if (p1 <= 12 && p2 <= 12 && p1 !== p2) {
      return {
        originalText: dateStr,
        isAmbiguous: true, // Flag as ambiguous: DO NOT GUESS
      };
    }
    const iso = `${slashMatch[3]}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    return { isoDate: iso, originalText: dateStr, isAmbiguous: false };
  }

  return { originalText: dateStr, isAmbiguous: false };
}
