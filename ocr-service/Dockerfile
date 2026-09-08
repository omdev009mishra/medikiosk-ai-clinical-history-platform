FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for PaddleOCR and OpenCV headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service source code
COPY . .

ENV OCR_HOST=0.0.0.0
ENV OCR_PORT=8002
ENV OCR_LANG=en
ENV OCR_DEVICE=auto

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8002/health || exit 1

CMD ["python", "main.py"]
