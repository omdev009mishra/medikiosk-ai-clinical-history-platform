# MediKiosk Local Speech Service (Faster-Whisper)

Local Speech-to-Text Recognition Microservice powered by Faster-Whisper for MediKiosk.

---

## 🚀 Windows PowerShell Quick Start Guide

Run the following commands from the project root:

```powershell
# 1. Navigate to speech-service directory
cd .\speech-service

# 2. Create Python virtual environment (if not already created)
python -m venv venv

# 3. Activate virtual environment
.\venv\Scripts\Activate.ps1

# 4. Install & upgrade dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 5. Start Speech Microservice on Port 8001
$env:WHISPER_MODEL="small"
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

---

## 🧪 Diagnostics & Health Check

In a separate PowerShell terminal:

```powershell
# Run automated diagnostic script
.\speech-service\check-speech.ps1

# Or query health endpoint directly
Invoke-RestMethod http://127.0.0.1:8001/health
```

Expected response:

```json
{
  "status": "healthy",
  "service": "speech-service",
  "model": "small",
  "device": "cpu",
  "compute_type": "int8",
  "modelLoaded": true,
  "error": null
}
```
