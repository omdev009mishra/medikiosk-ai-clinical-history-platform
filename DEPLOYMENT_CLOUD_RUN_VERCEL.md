# MediKiosk demo deployment: Cloud Run + Vercel

This branch adds deployment configuration for a **demonstration only**. It does not deploy resources or configure cloud credentials.

## Architecture

- **Frontend:** Vercel (Vite static build)
- **Backend and WebSocket:** Google Cloud Run (existing Express server and `/api/live-voice`)
- **Storage:** existing JSON file-backed store, intentionally disposable for a demo
- **AI:** Gemini, configured through a Cloud Run Secret Manager secret

The Docker image also serves the built frontend. You can use that combined deployment for a quick smoke test; the Vercel setup is for the split-origin architecture.

## Changes made

- `VITE_API_BASE_URL` lets the frontend call the Cloud Run API origin.
- `VITE_WS_BASE_URL` lets Gemini Live connect to the Cloud Run WebSocket origin.
- API requests send credentials, and the server can use `SameSite=None; Secure` cookies for the cross-origin Vercel frontend.
- CORS now rejects origins that are not in the configured allow-list instead of reflecting them.
- The app container listens on Cloud Run's injected `PORT` (8080 by default) and writes demo JSON files under `/tmp/medikiosk-data`.
- `vercel.json` configures the Vite build and SPA fallback.
- A branch-specific GitHub Actions workflow runs TypeScript, production build, and Docker image build checks.

## Important: security gate before public access

**Do not make this API publicly accessible yet.** The current application is not ready to expose real patient information to the public internet:

- Patient and encounter read/write routes in `server/routes/api.ts` are not consistently protected by authentication middleware.
- The current demo doctor credentials include a default PIN, and the admin login handler accepts weak demo PINs.
- The repository's seeded records contain realistic patient-like identifiers and contact details.

CORS is a browser policy, not API authentication; it does not prevent direct HTTP clients from calling these routes. Before enabling unauthenticated Cloud Run access or connecting a public Vercel site, add server-side authorization to all patient/encounter/document/admin routes, replace the demo login behavior with properly verified credentials, and replace seeded records with clearly synthetic data. Do not use real patient data.

## Cloud Run setup (after the security gate)

1. Create a Google Cloud project, enable billing, and enable Cloud Run and Cloud Build.
2. Create a Secret Manager secret for `GEMINI_API_KEY`; grant the Cloud Run service account access to that secret.
3. Deploy the container from this repository using the Dockerfile, region `asia-south1`, and port `8080`.
4. Configure runtime variables using `.env.cloud.example`:
   - `NODE_ENV=production`
   - `DEPLOYMENT_MODE=CLOUD`
   - `DATA_DIR=/tmp/medikiosk-data`
   - `ALLOWED_ORIGINS=https://YOUR-PRODUCTION-VERCEL-DOMAIN`
   - `CROSS_SITE_COOKIES=true`
   - `SESSION_COOKIE_SECURE=true`
   - `GEMINI_API_KEY` from Secret Manager
5. Keep maximum instances at 1 for this JSON demo, but understand that this **does not make the data durable**.
6. Verify `https://YOUR-CLOUD-RUN-URL/api/ready` and `https://YOUR-CLOUD-RUN-URL/api/health`.

Example deployment command (run only after the security gate is cleared):

```bash
gcloud run deploy medikiosk-api \
  --source . \
  --region asia-south1 \
  --port 8080 \
  --max 1 \
  --set-env-vars NODE_ENV=production,DEPLOYMENT_MODE=CLOUD,DATA_DIR=/tmp/medikiosk-data,CROSS_SITE_COOKIES=true,SESSION_COOKIE_SECURE=true,ALLOWED_ORIGINS=https://YOUR-PRODUCTION-VERCEL-DOMAIN \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

Do not add `--allow-unauthenticated` until the security gate above is complete.

## Vercel setup (after the security gate)

Import this GitHub repository into Vercel and select branch `deployment/cloud-run-vercel`.

- Framework preset: Vite
- Root directory: `.`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

Set these build environment variables for the production deployment:

- `VITE_API_BASE_URL=https://YOUR-CLOUD-RUN-URL` (origin only; do not append `/api`)
- `VITE_WS_BASE_URL=wss://YOUR-CLOUD-RUN-URL`

The Cloud Run `ALLOWED_ORIGINS` value must exactly match the Vercel production origin, including scheme and without a trailing slash. Redeploy the Vercel frontend after changing build variables.

## Demo limitations

- JSON files under `/tmp` are ephemeral. Cloud Run can replace an instance at any time; records can be lost on restart or scale events. A maximum of one instance avoids cross-instance divergence but is not persistence.
- The speech and OCR Python microservices are not included in the app Docker image. Their localhost defaults will not work in Cloud Run. The Gemini Live WebSocket is served by the Node app; local Faster-Whisper/PaddleOCR fallback workflows need separate service deployments.
- This is not a production, clinical, or ABDM-compliant hosting configuration. Use synthetic data only.
