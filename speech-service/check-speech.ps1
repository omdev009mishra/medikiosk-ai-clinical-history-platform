# MediKiosk Speech Microservice Diagnostics Script

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " MediKiosk Speech Service Diagnostics" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Python Installation Check
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCmd) {
    $pyVer = python --version 2>&1
    Write-Host "[OK] Python available ($pyVer)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Python is not found in PATH" -ForegroundColor Red
}

# 2. Virtual Environment Check
$venvPath = Join-Path $PSScriptRoot "venv"
if (Test-Path $venvPath) {
    Write-Host "[OK] Virtual environment found at $venvPath" -ForegroundColor Green
} else {
    Write-Host "[WARN] Virtual environment missing at $venvPath" -ForegroundColor Yellow
}

# 3. Faster-Whisper Import Check
$checkCode = "import faster_whisper; print('Faster-Whisper version:', faster_whisper.__version__)"
$pythonExe = Join-Path $venvPath "Scripts\python.exe"
if (Test-Path $pythonExe) {
    $fwResult = & $pythonExe -c $checkCode 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Faster-Whisper available ($fwResult)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Faster-Whisper import failed ($fwResult)" -ForegroundColor Red
    }
} else {
    Write-Host "[WARN] Skipping Faster-Whisper check (venv python.exe not found)" -ForegroundColor Yellow
}

# 4. Port 8001 Health Check
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:8001/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host "[OK] Speech service running on http://127.0.0.1:8001" -ForegroundColor Green
    Write-Host "[OK] Health status: $($res.status) [Model: $($res.model), Device: $($res.device)]" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Speech service is not running or unreachable on port 8001" -ForegroundColor Red
}

Write-Host "==================================================" -ForegroundColor Cyan
