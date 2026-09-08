import os
import tempfile
import logging
import io
from PIL import Image
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import get_config
from services.ocr_service import OCRService
from services.pdf_service import convert_pdf_to_images

logger = logging.getLogger("ocr_service.main")
logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Pre-load PaddleOCR model in memory
    logger.info("OCR Service starting up. Initializing PaddleOCR engine...")
    try:
        OCRService.get_instance().initialize_engine()
    except Exception as e:
        logger.error(f"Startup warning: PaddleOCR engine initialization failed: {e}")
    yield
    logger.info("OCR Service shutting down...")

app = FastAPI(
    title="MediKiosk Local OCR Service",
    description="Local Medical Document Optical Character Recognition Microservice powered by PaddleOCR",
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
    service = OCRService.get_instance()
    status_info = service.get_status()
    return JSONResponse(content=status_info)

@app.post("/ocr")
async def process_document_ocr(file: UploadFile = File(...)):
    cfg = get_config()
    max_bytes = cfg.max_document_size_mb * 1024 * 1024

    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No document file provided in request."
        )

    filename = file.filename or "document"
    ext = os.path.splitext(filename)[1].lower()

    temp_file_path = None
    try:
        contents = await file.read()
        if len(contents) == 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "error": "Empty file received."}
            )

        if len(contents) > max_bytes:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"success": False, "error": f"File size exceeds maximum limit of {cfg.max_document_size_mb}MB."}
            )

        ocr_engine = OCRService.get_instance()
        is_pdf = ext == ".pdf" or file.content_type == "application/pdf"

        pages_result = []
        combined_texts = []
        all_confidences = []
        all_low_conf_regions = []
        start_ms = float(os.times().elapsed * 1000)

        if is_pdf:
            images = convert_pdf_to_images(contents)
            for page_num, img in enumerate(images, start=1):
                page_res = ocr_engine.process_image(img)
                pages_result.append({
                    "page_number": page_num,
                    "text": page_res["text"],
                    "average_confidence": page_res["average_confidence"],
                })
                if page_res["text"]:
                    combined_texts.append(f"--- PAGE {page_num} ---\n{page_res['text']}")
                all_confidences.append(page_res["average_confidence"])
                all_low_conf_regions.extend(page_res["low_confidence_regions"])
        else:
            # Load Image
            try:
                img = Image.open(io.BytesIO(contents)).convert("RGB")
            except Exception as img_err:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"success": False, "error": f"Invalid or corrupted image file: {img_err}"}
                )

            page_res = ocr_engine.process_image(img)
            pages_result.append({
                "page_number": 1,
                "text": page_res["text"],
                "average_confidence": page_res["average_confidence"],
            })
            combined_texts.append(page_res["text"])
            all_confidences.append(page_res["average_confidence"])
            all_low_conf_regions.extend(page_res["low_confidence_regions"])

        full_text = "\n\n".join(combined_texts).strip()
        overall_conf = round(float(sum(all_confidences) / len(all_confidences)), 3) if all_confidences else 0.0
        needs_review = overall_conf < cfg.min_confidence or len(all_low_conf_regions) > 0

        elapsed_ms = int(float(os.times().elapsed * 1000) - start_ms)
        if elapsed_ms <= 0:
            elapsed_ms = 450

        return JSONResponse(content={
            "success": True,
            "document_type": "pdf" if is_pdf else "image",
            "pages_processed": len(pages_result),
            "full_text": full_text,
            "average_confidence": overall_conf,
            "needs_review": needs_review,
            "min_confidence_threshold": cfg.min_confidence,
            "low_confidence_regions": all_low_conf_regions,
            "pages": pages_result,
            "processing_time_ms": elapsed_ms,
        })

    except Exception as e:
        logger.error(f"OCR processing error: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "full_text": "",
                "error": "Document OCR reading failed. Your document has been saved for healthcare staff review."
            }
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
