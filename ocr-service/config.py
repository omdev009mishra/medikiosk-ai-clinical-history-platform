import os
from pydantic import BaseModel

class OCRServiceConfig(BaseModel):
    ocr_lang: str = os.getenv("OCR_LANG", "en")
    device: str = os.getenv("OCR_DEVICE", "auto")
    min_confidence: float = float(os.getenv("OCR_MIN_CONFIDENCE", "0.70"))
    max_pdf_pages: int = int(os.getenv("MAX_PDF_PAGES", "20"))
    max_document_size_mb: int = int(os.getenv("MAX_DOCUMENT_SIZE_MB", "20"))
    host: str = os.getenv("OCR_HOST", "127.0.0.1")
    port: int = int(os.getenv("OCR_PORT", "8002"))

def get_config() -> OCRServiceConfig:
    return OCRServiceConfig()
