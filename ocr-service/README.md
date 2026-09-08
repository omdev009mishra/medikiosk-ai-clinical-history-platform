# MediKiosk Local OCR Service (PaddleOCR)

Lightweight local document Optical Character Recognition microservice powered by [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), PyMuPDF, and FastAPI.

## Configuration

Set environment variables in `.env` or system environment:

* `OCR_LANG`: OCR language (`en`). Default: `en`.
* `OCR_DEVICE`: Execution device (`auto`, `gpu`, `cpu`). Default: `auto`.
* `OCR_MIN_CONFIDENCE`: Confidence threshold (0.0-1.0). Default: `0.70`.
* `MAX_PDF_PAGES`: Page limit per PDF. Default: `20`.
* `MAX_DOCUMENT_SIZE_MB`: Max file upload size. Default: `20`.
* `OCR_HOST`: Host IP. Default: `127.0.0.1`.
* `OCR_PORT`: Port. Default: `8002`.

## Windows Setup Instructions

```powershell
# 1. Navigate to OCR service directory
cd ocr-service

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
.\venv\Scripts\Activate.ps1

# 4. Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 5. Run OCR microservice
uvicorn main:app --host 127.0.0.1 --port 8002
```

## API Endpoints

* `GET /health`: Health status & loaded PaddleOCR status.
* `POST /ocr`: Upload document file (`multipart/form-data` image or PDF) and receive structured OCR JSON.
