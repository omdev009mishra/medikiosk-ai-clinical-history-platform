"""
Controlled Clinical Terminology Normalization Layer for Hinglish & Hindi
Preserves natural grammatical Hindi structure while restoring recognized English 
medical terminology and loanwords into Latin script for optimal clinical extraction.
"""

import re
from typing import Tuple

# Controlled dictionary: mapped in order of specificity (longer phrases first)
CLINICAL_HINGLISH_DICTIONARY = [
    # --- Multi-word time & duration phrases ---
    ("लास्ट तु देस", "last two days"),
    ("लास्ट तु देश", "last two days"),
    ("लास्ट टू डेज", "last two days"),
    ("लास्ट 2 डेज", "last two days"),
    ("लास्ट टू डेज़", "last two days"),
    ("लास्ट दो दिन", "last two days"),
    ("लास्ट वन वीक", "last one week"),
    ("लास्ट 1 वीक", "last one week"),
    ("लास्ट एक हफ्ता", "last one week"),
    ("लास्ट वन मंथ", "last one month"),
    ("लास्ट कुछ दिन", "last few days"),
    ("फ़्यू डेज़", "few days"),
    ("फ्यू डेज", "few days"),

    # --- Multi-word symptoms & conditions (English Loanwords transliterated to Devanagari) ---
    ("चेस्ट पेन", "chest pain"),
    ("चेस्ट पैन", "chest pain"),
    ("चेस्ट में पेन", "chest pain"),
    ("ब्लड प्रेशर", "blood pressure"),
    ("हार्ट अटैक", "heart attack"),
    ("हार्ट प्रॉब्लम", "heart problem"),
    ("हार्ट की बीमारी", "heart disease"),
    ("सांस लेने में दिक्कत", "difficulty breathing"),
    ("सांस लेने में तकलीफ", "difficulty breathing"),
    ("सांस लेने में परेशानी", "difficulty breathing"),
    ("सांस फूलना", "shortness of breath"),
    ("यूरिन इन्फेक्शन", "urine infection"),
    ("यूरिन में जलन", "burning urination"),
    ("स्टमक पेन", "stomach pain"),
    ("बैक पेन", "back pain"),
    ("बैक पैन", "back pain"),
    ("नी पेन", "knee pain"),
    ("सोर थ्रोट", "sore throat"),
    ("थ्रोट इन्फेक्शन", "throat infection"),
    ("लूज मोशन", "loose motions"),
    ("लूज मोशन्स", "loose motions"),
    ("बीपी हाई", "high BP"),
    ("बीपी लो", "low BP"),
    ("ब्लड शुगर", "blood sugar"),
    ("शुगर लेवल", "sugar level"),
    ("ब्लड टेस्ट", "blood test"),
    ("यूरिन टेस्ट", "urine test"),
    ("सीटी स्कैन", "CT scan"),
    ("एमआरआई", "MRI"),
    ("ईसीजी", "ECG"),
    ("एक्सरे", "X-ray"),
    ("एक्स-रे", "X-ray"),
    ("अल्ट्रासाउंड", "ultrasound"),
    ("सोनोग्राफी", "sonography"),

    # --- Single Clinical Terms & Symptoms ---
    ("बीपी", "BP"),
    ("डायबिटीज", "diabetes"),
    ("डायबिटिज", "diabetes"),
    ("शुगर", "sugar"),
    ("फीवर", "fever"),
    ("कफ", "cough"),
    ("वोमिटिंग", "vomiting"),
    ("नॉशिया", "nausea"),
    ("नौसिया", "nausea"),
    ("पेन", "pain"),
    ("पैन", "pain"),
    ("इन्फेक्शन", "infection"),
    ("इंफेक्शन", "infection"),
    ("एलर्जी", "allergy"),
    ("अस्थमा", "asthma"),
    ("थायराइड", "thyroid"),
    ("कोलेस्ट्रॉल", "cholesterol"),
    ("एसिडिटी", "acidity"),
    ("गैस", "gas"),
    ("कब्ज", "constipation"),
    ("स्टूल", "stool"),
    ("मोशन", "motion"),
    ("स्वेलिंग", "swelling"),
    ("रैश", "rash"),
    ("रैशेज", "rashes"),
    ("इचिंग", "itching"),

    # --- Common Medical / Hospital Context Terms ---
    ("मेडिसिन", "medicine"),
    ("मेडिसिन्स", "medicines"),
    ("टैबलेट", "tablet"),
    ("टैबलेट्स", "tablets"),
    ("कैप्सूल", "capsule"),
    ("सिरप", "syrup"),
    ("इंजेक्शन", "injection"),
    ("डॉक्टर", "doctor"),
    ("हॉस्पिटल", "hospital"),
    ("क्लीनिक", "clinic"),
    ("इमरजेंसी", "emergency"),
    ("एडमिट", "admitted"),
    ("डिस्चार्ज", "discharged"),
    ("ऑपरेशन", "surgery"),
    ("सर्जरी", "surgery"),
    ("चेकअप", "checkup"),
    ("प्रिस्क्रिप्शन", "prescription"),
    ("रिपोर्ट", "report"),
    ("रिपोर्ट्स", "reports"),

    # --- General Temporal & Severity Loanwords ---
    ("लास्ट", "last"),
    ("यस्टरडे", "yesterday"),
    ("टुडे", "today"),
    ("टुमॉरो", "tomorrow"),
    ("मॉर्निंग", "morning"),
    ("नाइट", "night"),
    ("ईवनिंग", "evening"),
    ("आफ्टरनून", "afternoon"),
    ("डेज", "days"),
    ("डेज़", "days"),
    ("वीक्स", "weeks"),
    ("मंथ्स", "months"),
    ("इयर्स", "years"),
    ("सीवियर", "severe"),
    ("माइल्ड", "mild"),
    ("मॉडरेट", "moderate"),
    ("नॉर्मल", "normal"),
    ("प्रॉब्लम", "problem"),
    ("सिम्प्टम", "symptom"),
    ("सिम्प्टम्स", "symptoms"),
    ("कंडीशन", "condition"),
    ("रिलीफ", "relief"),
]

def normalize_hinglish_transcript(raw_text: str) -> str:
    """
    Normalizes transliterated English/Hinglish medical terms to Latin script
    while strictly preserving surrounding Hindi grammatical words and meaning.
    """
    if not raw_text or not raw_text.strip():
        return ""

    normalized = raw_text.strip()

    # Apply phrase replacements in priority order (longer phrases first)
    for devanagari_phrase, english_equiv in CLINICAL_HINGLISH_DICTIONARY:
        pattern = re.compile(re.escape(devanagari_phrase), re.IGNORECASE)
        normalized = pattern.sub(english_equiv, normalized)

    # Clean up excess spaces
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return normalized

def process_transcript_payload(raw_text: str, detected_language: str, mode: str = "auto", enabled: bool = True) -> Tuple[str, str]:
    """
    Returns (rawTranscript, normalizedTranscript).
    - In Hindi mode ('hi'): Preserves pure Hindi Devanagari.
    - In English mode ('en'): Preserves pure English.
    - In Hinglish or Auto mode: Normalizes transliterated English loanwords to Latin script.
    """
    raw = (raw_text or "").strip()
    if not raw:
        return "", ""

    norm_mode = (mode or "auto").strip().lower()

    # If normalization is globally disabled or mode is pure Hindi, preserve original script
    if not enabled or norm_mode in ["hi", "hindi"]:
        return raw, raw

    # If pure English mode and detected as English, raw and normalized are identical
    if norm_mode in ["en", "english"] and detected_language == "en":
        return raw, raw

    # In Hinglish or Auto mode, normalize transliterated clinical terms
    normalized = normalize_hinglish_transcript(raw)
    return raw, normalized
