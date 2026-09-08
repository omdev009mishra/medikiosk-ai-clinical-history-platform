import pymupdf as fitz
from PIL import Image
import io
import logging
from config import get_config

logger = logging.getLogger("ocr_service.pdf")

def convert_pdf_to_images(pdf_bytes: bytes) -> list[Image.Image]:
    """
    Renders PDF pages to high-DPI PIL Images using PyMuPDF (fitz).
    Enforces MAX_PDF_PAGES configured threshold.
    """
    cfg = get_config()
    max_pages = cfg.max_pdf_pages

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = len(doc)

        logger.info(f"Processing PDF document with {page_count} page(s)...")

        if page_count > max_pages:
            raise ValueError(f"PDF page count ({page_count}) exceeds maximum allowed limit of {max_pages} pages.")

        images = []
        # Render each page at 2.0x scale (~144-200 DPI) for sharp medical text
        zoom_matrix = fitz.Matrix(2.0, 2.0)

        for i in range(page_count):
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=zoom_matrix)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data)).convert("RGB")
            images.append(img)

        doc.close()
        return images

    except Exception as e:
        logger.error(f"Error rendering PDF pages: {e}")
        raise e
