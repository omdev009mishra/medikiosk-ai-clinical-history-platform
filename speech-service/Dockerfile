FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (ffmpeg required for audio decoding/Faster-Whisper)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service source code
COPY . .

ENV SPEECH_HOST=0.0.0.0
ENV SPEECH_PORT=8001
ENV WHISPER_MODEL=small
ENV WHISPER_DEVICE=auto
ENV WHISPER_COMPUTE_TYPE=auto

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "main.py"]
