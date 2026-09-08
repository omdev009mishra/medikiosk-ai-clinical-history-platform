import cv2
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger("ocr_service.preprocessing")

def preprocess_image(image_input) -> np.ndarray:
    """
    Safely preprocesses image for PaddleOCR without destroying table lines, stamps, or dosages.
    Accepts image file path, PIL Image, or numpy array.
    """
    try:
        if isinstance(image_input, str):
            img = cv2.imread(image_input)
            if img is None:
                pil_img = Image.open(image_input)
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        elif isinstance(image_input, Image.Image):
            img = cv2.cvtColor(np.array(image_input), cv2.COLOR_RGB2BGR)
        elif isinstance(image_input, np.ndarray):
            img = image_input.copy()
        else:
            raise ValueError("Unsupported image input type")

        if len(img.shape) == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

        # Mild contrast adjustment (CLAHE) to make faint scan text readable
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced_gray = clahe.apply(gray)

        # Convert back to 3-channel BGR image expected by PaddleOCR
        processed = cv2.cvtColor(enhanced_gray, cv2.COLOR_GRAY2BGR)
        return processed

    except Exception as e:
        logger.warning(f"Image preprocessing warning (bypassing enhancement): {e}")
        if isinstance(image_input, str):
            return cv2.imread(image_input)
        elif isinstance(image_input, Image.Image):
            return cv2.cvtColor(np.array(image_input), cv2.COLOR_RGB2BGR)
        return image_input
