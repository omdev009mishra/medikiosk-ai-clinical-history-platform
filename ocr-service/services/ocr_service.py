import time
import logging
import numpy as np
from typing import Dict, Any, List
from config import get_config
from services.preprocessing_service import preprocess_image

logger = logging.getLogger("ocr_service.engine")
logging.basicConfig(level=logging.INFO)

class OCRService:
    _instance = None

    def __init__(self):
        self.ocr_engine = None
        self.is_loaded = False
        self.load_error = None
        self.actual_device = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize_engine(self):
        if self.is_loaded and self.ocr_engine is not None:
            return

        cfg = get_config()
        lang = cfg.ocr_lang
        use_gpu = False

        if cfg.device in ["gpu", "cuda"]:
            use_gpu = True

        logger.info(f"Initializing PaddleOCR engine (lang='{lang}', use_gpu={use_gpu})...")

        try:
            from paddleocr import PaddleOCR
            self.ocr_engine = PaddleOCR(use_textline_orientation=True, lang=lang)
            self.is_loaded = True
            self.actual_device = "cpu"
            self.load_error = None
            logger.info("PaddleOCR engine initialized successfully.")
        except Exception as e:
            logger.warning(f"PaddleOCR initial load failed ({e}), retrying base initialization...")
            try:
                from paddleocr import PaddleOCR
                self.ocr_engine = PaddleOCR(lang=lang)
                self.is_loaded = True
                self.actual_device = "cpu"
                self.load_error = None
                logger.info("PaddleOCR CPU fallback initialization successful.")
            except Exception as cpu_err:
                self.is_loaded = False
                self.load_error = str(cpu_err)
                logger.error(f"Fatal: Could not initialize PaddleOCR engine: {cpu_err}")
                raise cpu_err

    def process_image(self, image_input) -> Dict[str, Any]:
        if not self.is_loaded or self.ocr_engine is None:
            self.initialize_engine()

        cfg = get_config()
        min_conf = cfg.min_confidence

        start_time = time.time()
        preprocessed = preprocess_image(image_input)

        # Run PaddleOCR text detection and recognition
        result = self.ocr_engine.ocr(preprocessed, cls=True)

        lines_text = []
        confidences = []
        low_confidence_regions = []

        if result and len(result) > 0 and result[0] is not None:
            for line_idx, line_data in enumerate(result[0]):
                box = line_data[0]
                text_info = line_data[1]
                text = text_info[0].strip()
                confidence = float(text_info[1])

                if text:
                    lines_text.append(text)
                    confidences.append(confidence)

                    if confidence < min_conf:
                        low_confidence_regions.append({
                            "line_index": line_idx,
                            "text": text,
                            "confidence": round(confidence, 3),
                            "box": box,
                        })

        full_text = "\n".join(lines_text).strip()
        avg_conf = float(np.mean(confidences)) if len(confidences) > 0 else 0.0
        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "text": full_text,
            "average_confidence": round(avg_conf, 3),
            "low_confidence_regions": low_confidence_regions,
            "lines_count": len(lines_text),
            "processing_time_ms": elapsed_ms,
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "status": "healthy" if self.is_loaded else ("errored" if self.load_error else "uninitialized"),
            "service": "ocr-service",
            "ocr_ready": self.is_loaded,
            "device": self.actual_device or get_config().device,
            "lang": get_config().ocr_lang,
            "min_confidence": get_config().min_confidence,
            "error": self.load_error,
        }
