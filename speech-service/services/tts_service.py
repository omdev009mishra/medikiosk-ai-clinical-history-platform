import os
import io
import time
import logging
import asyncio
from typing import Optional, Dict, Tuple
import edge_tts

logger = logging.getLogger("speech_service.tts")
logging.basicConfig(level=logging.INFO)

# Mapping of language code to high-fidelity Indian neural voices
VOICE_MAP: Dict[str, Dict[str, str]] = {
    "hi": {
        "female": "hi-IN-SwaraNeural",
        "male": "hi-IN-MadhurNeural",
    },
    "hinglish": {
        "female": "hi-IN-SwaraNeural",
        "male": "hi-IN-MadhurNeural",
    },
    "en": {
        "female": "en-IN-NeerjaNeural",
        "male": "en-IN-PrabhatNeural",
    },
    "en-in": {
        "female": "en-IN-NeerjaNeural",
        "male": "en-IN-PrabhatNeural",
    },
    "mr": {
        "female": "mr-IN-AarohiNeural",
        "male": "mr-IN-ManoharNeural",
    },
    "bn": {
        "female": "bn-IN-TanishaaNeural",
        "male": "bn-IN-BashkarNeural",
    },
    "ta": {
        "female": "ta-IN-PallaviNeural",
        "male": "ta-IN-ValluvarNeural",
    },
    "te": {
        "female": "te-IN-ShrutiNeural",
        "male": "te-IN-MohanNeural",
    },
    "gu": {
        "female": "gu-IN-DhwaniNeural",
        "male": "gu-IN-NiranjanNeural",
    },
    "kn": {
        "female": "kn-IN-SapnaNeural",
        "male": "kn-IN-GaganNeural",
    },
    "ml": {
        "female": "ml-IN-SobhanaNeural",
        "male": "ml-IN-MidhunNeural",
    },
    "ur": {
        "female": "ur-IN-GulNeural",
        "male": "ur-IN-SalmanNeural",
    },
}

DEFAULT_VOICE = "hi-IN-SwaraNeural"

# In-memory LRU cache to avoid regenerating common prompts (e.g. greetings, confirmations)
_AUDIO_CACHE: Dict[str, bytes] = {}
_MAX_CACHE_ENTRIES = 120

class MultilingualTTSService:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @staticmethod
    def resolve_voice(language: Optional[str] = "hi", gender: str = "female") -> str:
        if not language:
            return DEFAULT_VOICE
        lang = language.lower().strip().split("-")[0]
        gender_key = "male" if gender and gender.lower() == "male" else "female"

        if lang in VOICE_MAP:
            return VOICE_MAP[lang].get(gender_key, VOICE_MAP[lang]["female"])
        if language.lower() in VOICE_MAP:
            return VOICE_MAP[language.lower()].get(gender_key, VOICE_MAP[language.lower()]["female"])

        return DEFAULT_VOICE

    async def synthesize(
        self,
        text: str,
        language: Optional[str] = "hi",
        gender: str = "female",
        rate: str = "+0%",
        pitch: str = "+0Hz"
    ) -> Tuple[bytes, str]:
        """
        Synthesizes text into high-fidelity neural MP3 audio.
        Returns: (audio_bytes, voice_used)
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return b"", DEFAULT_VOICE

        voice = self.resolve_voice(language, gender)
        cache_key = f"{voice}:{clean_text}"

        if cache_key in _AUDIO_CACHE:
            return _AUDIO_CACHE[cache_key], voice

        t0 = time.time()
        try:
            communicate = edge_tts.Communicate(clean_text, voice, rate=rate, pitch=pitch)
            audio_buffer = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_buffer.extend(chunk["data"])

            result_bytes = bytes(audio_buffer)
            elapsed_ms = int((time.time() - t0) * 1000)
            logger.info(f"[TTS] Synthesized {len(clean_text)} chars in {elapsed_ms}ms using voice '{voice}' ({len(result_bytes)} bytes)")

            # Cache if within size bounds
            if len(_AUDIO_CACHE) >= _MAX_CACHE_ENTRIES:
                oldest_key = next(iter(_AUDIO_CACHE))
                del _AUDIO_CACHE[oldest_key]
            _AUDIO_CACHE[cache_key] = result_bytes

            return result_bytes, voice
        except Exception as e:
            logger.error(f"[TTS Error] Failed to synthesize with voice '{voice}': {e}")
            raise e
