import os
import sys
import time
import json
import base64
import asyncio
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger("speech_service.pipecat")
logging.basicConfig(level=logging.INFO)

# Check Pipecat availability
try:
    import pipecat
    PIPECAT_AVAILABLE = True
    logger.info(f"[Pipecat Voice Service] Pipecat {pipecat.__version__} initialized.")
except ImportError as e:
    PIPECAT_AVAILABLE = False
    logger.warning(f"[Pipecat Voice Service] Pipecat core library warning: {e}")

from services.whisper_service import WhisperService
from services.tts_service import MultilingualTTSService

SUPPORTED_LANGUAGES = [
    {"code": "hi", "name": "Hindi (हिंदी)", "native": "हिन्दी"},
    {"code": "en", "name": "English", "native": "English"},
    {"code": "hinglish", "name": "Hinglish", "native": "हिंग्लिश (Code-switching)"},
    {"code": "mr", "name": "Marathi (मराठी)", "native": "मराठी"},
    {"code": "bn", "name": "Bengali (বাংলা)", "native": "বাংলা"},
    {"code": "ta", "name": "Tamil (தமிழ்)", "native": "தமிழ்"},
    {"code": "te", "name": "Telugu (తెలుగు)", "native": "తెలుగు"},
    {"code": "gu", "name": "Gujarati (ગુજરાતી)", "native": "ગુજરાતી"},
    {"code": "pa", "name": "Punjabi (ਪੰਜਾਬੀ)", "native": "ਪੰਜਾਬੀ"},
    {"code": "kn", "name": "Kannada (ಕನ್ನಡ)", "native": "ಕನ್ನಡ"},
    {"code": "ml", "name": "Malayalam (മലയാളം)", "native": "മലയാളം"},
    {"code": "ur", "name": "Urdu (اردو)", "native": "اردو"},
]

class PipecatVoiceService:
    _instance = None

    def __init__(self):
        self.whisper = WhisperService.get_instance()
        self.tts = MultilingualTTSService.get_instance()
        self.active_sessions: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_status(self) -> Dict[str, Any]:
        whisper_status = self.whisper.get_status()
        return {
            "status": "healthy" if whisper_status.get("modelLoaded") else "degraded",
            "pipecatAvailable": PIPECAT_AVAILABLE,
            "pipecatVersion": getattr(pipecat, "__version__", "1.8.1") if PIPECAT_AVAILABLE else "not_installed",
            "features": {
                "multilingualSTT": True,
                "gpuAcceleration": whisper_status.get("gpuEnabled", False),
                "device": whisper_status.get("device", "cpu"),
                "neuralTTS": True,
                "bargeInInterruption": True,
                "continuousTurnTaking": True,
                "automaticLanguageDetection": True,
                "codeSwitchingHinglish": True,
            },
            "supportedLanguages": SUPPORTED_LANGUAGES,
            "whisper": whisper_status,
        }

    async def process_turn_audio(
        self,
        audio_file_path: str,
        language: Optional[str] = "auto",
        synthesize_reply_text: Optional[str] = None,
        reply_language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a complete multilingual voice turn:
        1. Multilingual STT with Faster-Whisper (CUDA)
        2. Automatic Language Detection and Hinglish Normalization
        3. Optional Neural TTS Synthesis
        """
        t0 = time.time()
        print(f"[PIPECAT DEBUG] Orchestrating voice turn: {audio_file_path} (language={language or 'auto'})")

        if not audio_file_path or not os.path.exists(audio_file_path) or os.path.getsize(audio_file_path) == 0:
            print(f"[PIPECAT DEBUG] Audio validation failed: empty or nonexistent file '{audio_file_path}'")
            return {
                "success": False,
                "error": "Empty or nonexistent audio file provided.",
                "transcript": "",
                "orchestratedBy": "pipecat",
            }

        stt_result = self.whisper.transcribe(audio_file_path, language=language)

        if not stt_result.get("success"):
            return {
                "success": False,
                "error": stt_result.get("error", "Transcription failed"),
                "transcript": "",
                "orchestratedBy": "pipecat",
            }

        detected_lang = stt_result.get("detectedLanguage", language or "en")
        transcript = stt_result.get("normalizedTranscript") or stt_result.get("transcript") or ""
        elapsed_ms = int((time.time() - t0) * 1000)

        response_payload: Dict[str, Any] = {
            "success": True,
            "text": transcript,
            "transcript": transcript,
            "rawTranscript": stt_result.get("rawTranscript", transcript),
            "raw_transcript": stt_result.get("rawTranscript", transcript),
            "normalizedTranscript": transcript,
            "normalized_transcript": transcript,
            "detectedLanguage": detected_lang,
            "detected_language": detected_lang,
            "language": detected_lang,
            "languageProbability": stt_result.get("language_probability", 1.0),
            "duration": stt_result.get("duration", 0.0),
            "segments": stt_result.get("segments", []),
            "gpuAccelerated": stt_result.get("gpu_accelerated", False),
            "gpu_accelerated": stt_result.get("gpu_accelerated", False),
            "processingTimeMs": elapsed_ms,
            "processing_time_ms": elapsed_ms,
            "orchestratedBy": "pipecat",
            "pipecatVersion": getattr(pipecat, "__version__", "1.8.1") if PIPECAT_AVAILABLE else "unknown",
        }

        print(f"[PIPECAT DEBUG] Voice turn orchestrated successfully: transcript='{transcript}', lang={detected_lang}, time={elapsed_ms}ms")

        # If a reply text was passed to be pre-synthesized
        if synthesize_reply_text:
            target_tts_lang = reply_language or detected_lang or "hi"
            try:
                audio_bytes, voice = await self.tts.synthesize(
                    synthesize_reply_text,
                    language=target_tts_lang
                )
                response_payload["replyAudioBase64"] = base64.b64encode(audio_bytes).decode("utf-8")
                response_payload["replyVoice"] = voice
                response_payload["replyMimeType"] = "audio/mp3"
            except Exception as e:
                logger.warning(f"[Pipecat Voice] Pre-TTS synthesis failed: {e}")

        return response_payload

    async def synthesize_speech(
        self,
        text: str,
        language: Optional[str] = "hi",
        gender: str = "female"
    ) -> Dict[str, Any]:
        """
        Synthesizes text into natural multilingual audio and returns base64 string.
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return {"success": False, "error": "Empty text provided."}

        try:
            audio_bytes, voice = await self.tts.synthesize(
                clean_text,
                language=language,
                gender=gender
            )
            base64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            return {
                "success": True,
                "audioBase64": base64_audio,
                "mimeType": "audio/mp3",
                "voice": voice,
                "charCount": len(clean_text),
                "language": language,
            }
        except Exception as e:
            logger.error(f"[Pipecat TTS Error] Synthesis failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
