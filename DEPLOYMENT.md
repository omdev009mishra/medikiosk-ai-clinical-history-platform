# MediKiosk — Production Hybrid Deployment & Operations Guide

> **Architecture:** Hybrid Local-First + Central Cloud (AWS Mumbai `ap-south-1`)  
> **Target Deployments:** Hospital Local Server (LAN) & Central AWS Cloud  
> **Compliance:** ABDM FHIR R4, DPDP Act 2023  

---

## 1. Architecture Overview

MediKiosk operates on a **Local-First / Hybrid Architecture**:

```text
                             INTERNET
                                │
                         Cloudflare / HTTPS
                                │
                                ▼
               MEDIKIOSK CLOUD (AWS Mumbai: ap-south-1)
                  ├── Application Containers (ECS / EC2)
                  ├── Amazon RDS (PostgreSQL 16)
                  ├── Amazon S3 (Medical Document Archive)
                  └── Central Sync Ingest API
                                ▲
                                │ TLS / Mutual Auth
                         Secure Sync Queue
                                │
                                ▼
                   HOSPITAL LOCAL SERVER (LAN)
                  ├── MediKiosk Container (Port 3000)
                  ├── Local PostgreSQL 16 (Port 5432)
                  ├── Faster-Whisper Microservice (Port 8001)
                  ├── PaddleOCR Microservice (Port 8002)
                  └── Local-First Sync Queue Worker
                          ▲              ▲
                          │              │
                    Hospital LAN    Hospital LAN
                          │              │
                  ┌───────┴──────┐ ┌─────┴────────┐
                  │ Patient Kiosk│ │Doctor Station│
                  └──────────────┘ └──────────────┘
```

### Key Safety & Operational Guarantees:
1. **Local-First Independence:** If internet connectivity drops, patient intake, voice interviews, Faster-Whisper STT, PaddleOCR, local triage, and Doctor Workstations remain 100% operational on the hospital LAN (`http://medikiosk.local:3000`).
2. **Dual-Layer Persistence:** All patient records, active encounters, audit trails, and sync queue tasks are persisted concurrently to PostgreSQL and durable JSON journals (`./data/`). All data survives container restarts, API crashes, and host reboots.
3. **Automatic Sync Recovery:** When internet reconnects, queued changes drain with exponential backoff and idempotency tokens.
4. **One Patient Master Record:** Bayesian demographic deduplication guarantees a real patient (e.g. Ramesh Kumar) never gets duplicated across kiosk retries, offline reconnects, or repeated visits.
5. **Internal Microservices Isolation:** Faster-Whisper (port 8001), PaddleOCR (port 8002), and PostgreSQL (port 5432) are bound to the internal Docker network and never exposed to the public internet.
6. **Casualty Triage Priority:** Urgent/red-flag symptoms are routed directly to the hospital's **Casualty** department (`CASUALTY` badge, immediate doctor audio alert, zero diagnostic claims to the patient).
7. **Voice Failover Architecture:** Gemini Live is utilized for full-duplex conversational voice when cloud internet is active; if hospital connectivity drops, the system automatically falls back to local Faster-Whisper STT on port 8001 with zero disruption.

---

## 2. Local Development Setup

### Prerequisites:
- Node.js 22+ & npm
- Python 3.10+ (for local microservices)

### Steps:
```bash
# 1. Clone repository
git clone https://github.com/omdev009mishra/medikiosk-ai-clinical-history-platform.git
cd medikiosk-ai-clinical-history-platform

# 2. Install Node dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in GEMINI_API_KEY

# 4. Start local development server (Frontend + Backend on Port 3000)
npm run dev

# 5. Typecheck & verify
npx tsc --noEmit
```

---

## 3. Hospital Server Installation (Docker Compose)

### System Requirements for Local Hospital Server:
- **OS:** Ubuntu 22.04 LTS / Debian 12 / Windows Server with Docker Desktop
- **RAM:** 16 GB minimum (32 GB recommended for concurrent AI Whisper & OCR)
- **CPU:** 8+ cores (or NVIDIA GPU with CUDA support for Whisper)
- **Storage:** 256 GB SSD (for local PostgreSQL database & OCR scans)

### 1-Click Hospital Deployment:
```bash
# 1. Navigate to deployment folder
cd /opt/medikiosk

# 2. Configure environment
cat <<EOF > .env
DEPLOYMENT_MODE=LOCAL_HOSPITAL
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://medikiosk:medikiosk_local_secret@postgres:5432/medikiosk_db
GEMINI_API_KEY=your_gemini_api_key_here
CLOUD_API_URL=https://api.medikiosk.in
CLOUD_SYNC_SECRET=hospital_delhi_aiia_token
EOF

# 3. Start all containers in background (uses 'hospital' profile for API + Postgres + Whisper + OCR)
docker compose --profile hospital up -d

# 4. Verify running services
docker compose ps
```

### Accessing on Hospital LAN:
- **Patient Kiosks:** `http://medikiosk.local:3000` (or `http://192.168.1.50:3000`)
- **Doctor Workstations:** `http://medikiosk.local:3000/doctor`

---

## 4. Central Cloud Deployment (AWS Mumbai: ap-south-1)

### AWS Resources:
1. **Amazon ECS / EC2:** Runs `docker-compose.production.yml` with the MediKiosk API container (lightweight ~400MB image; Whisper and OCR remain local to the hospital).
2. **Amazon RDS PostgreSQL:** Multi-AZ PostgreSQL 16 instance in private VPC subnets with SSL enabled.
3. **Amazon S3:** Private bucket `medikiosk-clinical-records-2026` with Server-Side Encryption (SSE-S3).
4. **AWS Application Load Balancer (ALB):** Terminating HTTPS and WSS (WebSocket).
5. **Cloudflare:** CDN, DDoS protection, Web Application Firewall (WAF), and DNS.

### AWS Cloud Launch Commands (API Only):
```bash
# 1. Pull latest changes
git pull origin main

# 2. Build and launch cloud production container (Starts API only; DOES NOT build Whisper/OCR)
docker compose -f docker-compose.production.yml up -d --build

# Alternatively, using standard compose (profiles automatically exclude Whisper/OCR in cloud):
# docker compose up -d --build app

# 3. Check health probe
curl -f http://localhost:3000/api/ready
```

---

## 5. Cloudflare, SSL/TLS & WebSocket (WSS)

Configure Cloudflare DNS and SSL:
1. **DNS Records (Proxied - Orange Cloud):**
   - `app.medikiosk.in` $\to$ CNAME to AWS ALB DNS
   - `api.medikiosk.in` $\to$ CNAME to AWS ALB DNS
   - `doctor.medikiosk.in` $\to$ CNAME to AWS ALB DNS
2. **SSL/TLS Encryption Mode:** **Full (Strict)**.
3. **WebSockets:** Enable WebSockets under Cloudflare Network settings (for `/api/live-voice` full-duplex voice streaming).
4. **WAF Rules:** Block non-Indian IPs from Kiosk administration endpoints if desired.

---

## 6. Database Operations & Backups

### Hospital Local Database Backup:
```bash
# Automated daily backup script
docker exec medikiosk-postgres pg_dump -U medikiosk medikiosk_db | gzip > /opt/backups/medikiosk_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore from backup
gunzip -c /opt/backups/medikiosk_20260909_000000.sql.gz | docker exec -i medikiosk-postgres psql -U medikiosk medikiosk_db
```

### Cloud RDS Database Backup:
- Automated daily snapshots with 35-day retention.
- Point-in-Time Recovery (PITR) enabled with 5-minute RPO.

---

## 7. Cloud Synchronization & Local-First Verification

### Checking Sync Status:
```bash
curl http://localhost:3000/api/sync/status
```
Example Output:
```json
{
  "success": true,
  "data": {
    "mode": "LOCAL_HOSPITAL",
    "isOnline": true,
    "cloudReachable": true,
    "pendingCount": 0,
    "syncedCount": 142,
    "statusMessage": "All records synchronized with cloud."
  }
}
```

### Triggering Manual Sync:
```bash
curl -X POST http://localhost:3000/api/sync/trigger
```

---

## 8. CLI Command Cheat Sheet

| Operation | Command |
|---|---|
| Start Local Hospital Stack | `docker compose --profile hospital up -d` |
| Start AWS Cloud Stack (API Only) | `docker compose -f docker-compose.production.yml up -d --build` |
| View Service Logs | `docker compose logs -f app` |
| Check Container Health | `docker compose ps` |
| Stop Stack | `docker compose down` |
| Rebuild Application (Cloud) | `docker compose up -d --build app` |
| Rebuild Application (Hospital) | `docker compose --profile hospital build && docker compose --profile hospital up -d` |
| Run Deduplication Suite | `node scratch/test_patient_deduplication.js` |
| Run Hybrid Sync Suite | `node scratch/test_hybrid_sync.js` |
| Run Casualty Pipeline Suite | `node scratch/test_emergency_pipeline.js` |
| Run Restart Persistence Audit | `node scratch/test_restart_persistence.cjs --setup && node scratch/test_restart_persistence.cjs --verify` |
| TypeScript Validation | `npx tsc --noEmit` |
| Production Build | `npm run build` |

---

## 9. Troubleshooting

### Issue: "Hospital Network Mode" status shown on Kiosk UI
- **Cause:** Hospital internet router is down or disconnected.
- **Resolution:** Normal expected local-first behavior. Inform staff that Kiosk and Doctor Workstation continue operating normally on the LAN; all records will automatically sync when internet returns.

### Issue: Whisper container failing on CPU
- **Resolution:** In `.env`, ensure `WHISPER_DEVICE=cpu` and `WHISPER_COMPUTE_TYPE=int8` if no NVIDIA GPU is available on the server.
