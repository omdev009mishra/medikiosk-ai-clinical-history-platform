import os
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
    parent_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    if os.path.exists(parent_env):
        load_dotenv(parent_env)
    else:
        load_dotenv()
except ImportError:
    pass

class SpeechServiceConfig(BaseModel):
    whisper_model: str = os.getenv("WHISPER_MODEL", "small")
    device: str = os.getenv("WHISPER_DEVICE", "auto")
    compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "auto")
    whisper_language: str = os.getenv("WHISPER_LANGUAGE", "auto")
    whisper_hinglish_normalization: bool = os.getenv("WHISPER_HINGLISH_NORMALIZATION", "true").lower() in ("true", "1", "yes")
    host: str = os.getenv("SPEECH_HOST", "127.0.0.1")
    port: int = int(os.getenv("SPEECH_PORT", "8001"))

def get_config() -> SpeechServiceConfig:
    return SpeechServiceConfig()
