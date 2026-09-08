import sys
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import os
import tempfile
import logging
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import get_config
from services.whisper_service import WhisperService

logger = logging.getLogger("speech_service.main")
logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Pre-load Faster-Whisper model in memory
    logger.info("Speech Service starting up. Initializing Faster-Whisper model...")
    try:
        WhisperService.get_instance().initialize_model()
    except Exception as e:
        logger.error(f"Startup warning: Faster-Whisper model initialization failed: {e}")
    yield
    logger.info("Speech Service shutting down...")

app = FastAPI(
    title="MediKiosk Local Speech Service",
    description="Local Speech-to-Text Recognition Microservice powered by Faster-Whisper",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    service = WhisperService.get_instance()
    status_info = service.get_status()
    return JSONResponse(content=status_info)

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    lang: Optional[str] = Query(None)
):
    if not file:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": "No audio file provided in request."}
        )

    filename = file.filename or "recording.webm"
    ext = os.path.splitext(filename)[1]
    if not ext or len(ext) > 5:
        ext = ".webm"

    temp_file_path = None
    try:
        contents = await file.read()
        if len(contents) == 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "error": "Empty audio file received."}
            )

        # Save audio payload safely to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(contents)
            temp_file_path = tmp.name

        service = PipecatVoiceService.get_instance()
        target_lang = language or lang or None
        result = await service.process_turn_audio(temp_file_path, language=target_lang)

        if not result.get("success"):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "success": False,
                    "error": {
                        "code": "INVALID_AUDIO",
                        "message": result.get("error") or "The recorded audio could not be decoded."
                    }
                }
            )

        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Transcription unexpected failure: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "text": "",
                "error": {
                    "code": "PROCESSING_ERROR",
                    "message": f"Speech transcription failure: {str(e)}"
                }
            }
        )
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as cleanup_err:
                logger.warning(f"Could not remove temp audio file {temp_file_path}: {cleanup_err}")

# ==========================================
# Pipecat Multilingual Real-Time Voice Layer
# ==========================================
from pydantic import BaseModel
from services.pipecat_voice_service import PipecatVoiceService
from services.tts_service import MultilingualTTSService

class TTSRequestModel(BaseModel):
    text: str
    language: Optional[str] = "hi"
    gender: Optional[str] = "female"

@app.get("/pipecat/status")
def pipecat_status():
    service = PipecatVoiceService.get_instance()
    return JSONResponse(content=service.get_status())

@app.post("/pipecat/tts")
async def pipecat_synthesize(req: TTSRequestModel):
    if not req.text or not req.text.strip():
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": "Text is required for TTS synthesis."}
        )

    service = PipecatVoiceService.get_instance()
    result = await service.synthesize_speech(
        text=req.text,
        language=req.language,
        gender=req.gender or "female"
    )

    if not result.get("success"):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=result
        )

    return JSONResponse(content=result)

@app.post("/pipecat/turn")
async def pipecat_turn(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    reply_text: Optional[str] = Form(None),
    reply_language: Optional[str] = Form(None)
):
    if not file:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": "No audio file provided."}
        )

    ext = os.path.splitext(file.filename or "recording.webm")[1] or ".webm"
    temp_file_path = None
    try:
        contents = await file.read()
        if not contents or len(contents) == 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "error": "Empty audio file received."}
            )

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(contents)
            temp_file_path = tmp.name

        service = PipecatVoiceService.get_instance()
        result = await service.process_turn_audio(
            audio_file_path=temp_file_path,
            language=language or "auto",
            synthesize_reply_text=reply_text,
            reply_language=reply_language
        )

        if not result.get("success"):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "success": False,
                    "error": {
                        "code": "INVALID_AUDIO",
                        "message": result.get("error") or "Speech turn processing failed."
                    }
                }
            )

        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Pipecat turn failure: {e}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "error": str(e)}
        )
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass

if __name__ == "__main__":
    import uvicorn
    cfg = get_config()
    uvicorn.run("main:app", host=cfg.host, port=cfg.port, reload=False)
