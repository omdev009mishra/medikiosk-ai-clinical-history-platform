import os
import sys
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
import time
import logging
from typing import Dict, Any, Optional
from config import get_config
from services.hinglish_normalizer import process_transcript_payload

logger = logging.getLogger("speech_service.whisper")
logging.basicConfig(level=logging.INFO)

class WhisperService:
    _instance = None

    def __init__(self):
        self.model = None
        self.loaded_model_name = None
        self.actual_device = None
        self.actual_compute_type = None
        self.is_loaded = False
        self.load_error = None
        self.cuda_devices_count = 0

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize_model(self):
        if self.is_loaded and self.model is not None:
            return

        cfg = get_config()
        model_name = cfg.whisper_model or "small"
        requested_device = (cfg.device or "auto").lower().strip()
        requested_compute = (cfg.compute_type or "auto").lower().strip()

        print("[MediKiosk Speech] Starting Faster-Whisper...")
        print(f"[MediKiosk Speech] WHISPER_MODEL requested: {model_name}")

        import ctranslate2
        from faster_whisper import WhisperModel

        # Register DLL directories on Windows (CUDA 12 & cuDNN 9)
        if sys.platform == "win32":
            ct2_dir = os.path.dirname(ctranslate2.__file__)
            extra_dirs = [
                ct2_dir,
                r"C:\Program Files\NVIDIA Corporation\RTX Remix\exts\omni.flux.internal_pip_archive\pip_prebundle\torch\lib",
            ]
            for extra in extra_dirs:
                if os.path.isdir(extra):
                    if hasattr(os, "add_dll_directory"):
                        try:
                            os.add_dll_directory(extra)
                        except Exception:
                            pass
                    os.environ["PATH"] = extra + os.pathsep + os.environ.get("PATH", "")

        # Check CUDA availability
        print("[MediKiosk Speech] Checking CUDA...")
        try:
            self.cuda_devices_count = ctranslate2.get_cuda_device_count()
        except Exception as e:
            logger.warning(f"Error querying CUDA devices: {e}")
            self.cuda_devices_count = 0

        print(f"[MediKiosk Speech] CUDA devices detected: {self.cuda_devices_count}")

        use_cuda = False
        if requested_device == "cuda":
            use_cuda = self.cuda_devices_count > 0
        elif requested_device == "auto":
            use_cuda = self.cuda_devices_count > 0
        else:
            use_cuda = False

        if use_cuda:
            target_compute = requested_compute if requested_compute not in ["auto", ""] else "float16"
            print(f"[MediKiosk Speech] Testing Faster-Whisper GPU initialization on device 0 with compute_type='{target_compute}'...")
            try:
                loaded_m = WhisperModel(model_name, device="cuda", compute_type=target_compute)
                # Verify CUDA runtime execution by transcribing a silent probe buffer
                import numpy as np
                dummy_audio = np.zeros(4000, dtype=np.float32)
                _ = list(loaded_m.transcribe(dummy_audio, beam_size=1)[0])

                self.model = loaded_m
                self.loaded_model_name = model_name
                self.actual_device = "cuda"
                self.actual_compute_type = target_compute
                self.is_loaded = True
                self.load_error = None
                print("[MediKiosk Speech] GPU acceleration enabled")
                logger.info(f"Faster-Whisper '{model_name}' verified and running on GPU ({target_compute}).")
                return
            except Exception as cuda_err:
                print(f"[MediKiosk Speech] GPU initialization failed: {cuda_err}")
                print("[MediKiosk Speech] Falling back to CPU int8")
                logger.warning(f"CUDA initialization failed: {cuda_err}. Falling back to CPU int8.")

        # Fallback / Explicit CPU configuration
        print(f"[MediKiosk Speech] Loading Faster-Whisper '{model_name}' on CPU (int8)...")
        target_compute = requested_compute if requested_compute not in ["auto", "", "float16", "int8_float16"] else "int8"
        try:
            self.model = WhisperModel(model_name, device="cpu", compute_type=target_compute, cpu_threads=4)
            self.loaded_model_name = model_name
            self.actual_device = "cpu"
            self.actual_compute_type = target_compute
            self.is_loaded = True
            self.load_error = None
            print(f"[MediKiosk Speech] Faster-Whisper '{model_name}' loaded successfully on CPU ({target_compute}).")
            logger.info(f"Faster-Whisper '{model_name}' CPU initialization successful.")
        except Exception as cpu_err:
            self.is_loaded = False
            self.load_error = str(cpu_err)
            logger.error(f"Fatal: Could not initialize Faster-Whisper model '{model_name}' on CPU: {cpu_err}")
            raise cpu_err

    def transcribe(self, file_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        if not self.is_loaded or self.model is None:
            self.initialize_model()

        start_time = time.time()
        cfg = get_config()

        # Resolve language parameter and requested mode
        req_lang = (language or cfg.whisper_language or "auto").strip().lower()
        active_mode = "auto"
        selected_language: Optional[str] = None

        if req_lang in ["hinglish", "hi-en", "en-hi"]:
            active_mode = "hinglish"
            selected_language = None  # Whisper auto-detects multilingual mix
        elif req_lang in ["auto", "none", "all", "detect", ""]:
            active_mode = "auto"
            selected_language = None  # Dynamic auto-detection
        elif req_lang in ["hi", "hindi", "hi-in"]:
            active_mode = "hi"
            selected_language = "hi"
        elif req_lang in ["en", "english", "en-us", "en-in"]:
            active_mode = "en"
            selected_language = "en"
        else:
            active_mode = req_lang
            selected_language = req_lang

        logger.info(f"[MediKiosk Speech] Transcribing audio with mode='{active_mode}', language='{selected_language}' (task='transcribe')")
        print(f"[WHISPER DEBUG] Received transcription request")
        print(f"[WHISPER DEBUG] Device: {self.actual_device}")
        print(f"[WHISPER DEBUG] Compute type: {self.actual_compute_type}")
        print(f"[WHISPER DEBUG] Generating transcription")

        try:
            try:
                segments, info = self.model.transcribe(
                    file_path,
                    language=selected_language,
                    task="transcribe",
                    beam_size=5,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500),
                    condition_on_previous_text=False
                )
                segment_list = []
                full_text_parts = []
                for segment in segments:
                    text_clean = segment.text.strip()
                    if text_clean:
                        full_text_parts.append(text_clean)
                        segment_list.append({
                            "id": segment.id,
                            "start": round(segment.start, 2),
                            "end": round(segment.end, 2),
                            "text": text_clean,
                        })
            except Exception as vad_err:
                logger.warning(f"[WHISPER DEBUG] VAD filter error ({vad_err}). Retrying without VAD filter...")
                segments, info = self.model.transcribe(
                    file_path,
                    language=selected_language,
                    task="transcribe",
                    beam_size=5,
                    vad_filter=False,
                    condition_on_previous_text=False
                )
                segment_list = []
                full_text_parts = []
                for segment in segments:
                    text_clean = segment.text.strip()
                    if text_clean:
                        full_text_parts.append(text_clean)
                        segment_list.append({
                            "id": segment.id,
                            "start": round(segment.start, 2),
                            "end": round(segment.end, 2),
                            "text": text_clean,
                        })

            raw_full_text = " ".join(full_text_parts).strip()
            elapsed_ms = int((time.time() - start_time) * 1000)

            detected_lang = getattr(info, "language", selected_language or "en")
            lang_prob = round(float(getattr(info, "language_probability", 1.0)), 3)
            audio_duration = round(float(getattr(info, "duration", 0.0)), 2)
            if audio_duration == 0.0 and segment_list:
                audio_duration = segment_list[-1]["end"]

            # Process Hinglish / Hindi Clinical Normalization Layer
            raw_transcript, normalized_transcript = process_transcript_payload(
                raw_full_text,
                detected_language=detected_lang,
                mode=active_mode,
                enabled=cfg.whisper_hinglish_normalization
            )

            try:
                print(f"[WHISPER DEBUG] Audio duration: {audio_duration}s")
                print(f"[WHISPER DEBUG] Detected language: {detected_lang}")
                print(f"[WHISPER DEBUG] Raw transcript: \"{raw_transcript}\"")
                print(f"[WHISPER DEBUG] Normalized transcript: \"{normalized_transcript}\"")
                print(f"[WHISPER DEBUG] Transcript: \"{normalized_transcript or raw_transcript}\"")
            except Exception:
                try:
                    logger.info(f"[WHISPER DEBUG] Audio duration: {audio_duration}s")
                    logger.info(f"[WHISPER DEBUG] Detected language: {detected_lang}")
                    logger.info(f"[WHISPER DEBUG] Raw transcript: {raw_transcript}")
                    logger.info(f"[WHISPER DEBUG] Normalized transcript: {normalized_transcript}")
                except Exception:
                    pass

            return {
                "success": True,
                "rawTranscript": raw_transcript,
                "raw_transcript": raw_transcript,
                "normalizedTranscript": normalized_transcript,
                "normalized_transcript": normalized_transcript,
                "transcript": normalized_transcript,
                "text": normalized_transcript,
                "detectedLanguage": detected_lang,
                "detected_language": detected_lang,
                "language": detected_lang,
                "language_probability": lang_prob,
                "duration": audio_duration,
                "segments": segment_list,
                "processing_time_ms": elapsed_ms,
                "gpu_accelerated": (self.actual_device == "cuda"),
                "mode": active_mode
            }
        except Exception as e:
            if "cublas" in str(e).lower() or "cuda" in str(e).lower():
                logger.warning(f"[MediKiosk Speech] CUDA execution error ({e}). Seamlessly switching to CPU int8...")
                from faster_whisper import WhisperModel
                self.model = WhisperModel(self.loaded_model_name or "small", device="cpu", compute_type="int8", cpu_threads=4)
                self.actual_device = "cpu"
                self.actual_compute_type = "int8"
                return self.transcribe(file_path, language=language)

            logger.error(f"Error during audio decoding/transcription: {e}")
            return {
                "success": False,
                "rawTranscript": "",
                "normalizedTranscript": "",
                "transcript": "",
                "text": "",
                "error": f"Audio processing failed: {str(e)}",
            }

    def get_status(self) -> Dict[str, Any]:
        cfg = get_config()
        is_gpu = (self.actual_device == "cuda")
        return {
            "status": "healthy" if self.is_loaded else "unavailable",
            "service": "speech-service",
            "model": self.loaded_model_name or cfg.whisper_model,
            "device": self.actual_device or "cpu",
            "compute_type": self.actual_compute_type or "int8",
            "gpuEnabled": is_gpu,
            "cudaDevices": self.cuda_devices_count,
            "defaultLanguage": cfg.whisper_language,
            "modelLoaded": self.is_loaded,
            "error": self.load_error
        }
