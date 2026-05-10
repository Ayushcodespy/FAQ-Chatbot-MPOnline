# Deployment Guide

Recommended setup:

- Backend API: Render Web Service
- Database: Render PostgreSQL
- Frontend: Vercel static Vite app

## 1. Prepare Secrets

Do not commit real API keys, SMTP passwords, or database URLs. Keep them only in hosting environment variables.

Before public deployment, rotate any key that was ever copied into `.env.example`, screenshots, reports, chat, or Git history.

## 2. Deploy Backend On Render

1. Push this repository to GitHub.
2. Open Render and create a new Blueprint from the repository.
3. Render reads `render.yaml` and creates:
   - `faq-chatbot-api`
   - `faq-chatbot-db`
   Both are configured with `plan: free` for demo deployment.
4. Fill all `sync: false` environment variables in Render:
   - `BOOTSTRAP_ADMIN_EMAIL`
   - `BOOTSTRAP_ADMIN_PASSWORD`
   - `GEMINI_API_KEY` or `OPENAI_API_KEY`
   - `SMTP_USERNAME`
   - `SMTP_PASSWORD`
   - `SMTP_FROM_EMAIL`
5. Deploy the service.

Backend start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

After deploy, test:

```text
https://your-backend.onrender.com/
https://your-backend.onrender.com/docs
```

## 3. Persist Uploaded Documents And FAISS Data

The app stores uploaded documents and FAISS index files on disk. Render service filesystems are ephemeral unless you attach a persistent disk.

For a completely free demo, skip the persistent disk. The app can run, but uploaded files and FAISS index files can disappear after restart/redeploy.

For production, add a persistent disk to the backend service. Persistent disks are not part of the free demo setup:

```text
Mount path: /opt/render/project/src/app/storage
```

Keep these backend environment variables:

```text
VECTOR_STORE_PATH=/opt/render/project/src/app/storage/faiss.index
VECTOR_METADATA_PATH=/opt/render/project/src/app/storage/faiss_metadata.json
UPLOAD_DIR=/opt/render/project/src/app/storage/uploads
```

Without this disk, uploads and vector files can disappear after redeploy/restart.

Render free web services also block outbound SMTP ports such as `465` and `587`. Password login works, but OTP email features may not work on the free backend unless you switch email sending to an HTTP-based email API.

## 4. Deploy Frontend On Vercel

1. Import the same GitHub repository in Vercel.
2. Set the project root directory to:

```text
frontend
```

3. Use these settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

4. Add this frontend environment variable:

```text
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

5. Deploy the frontend.

## 5. Update Backend CORS

After Vercel gives the frontend URL, update backend `ALLOWED_ORIGINS` on Render:

```text
["https://your-frontend-domain.vercel.app"]
```

Then redeploy the backend.

## 6. Final Checks

Open the frontend URL and verify:

- Login works.
- Chat API responds.
- Admin dashboard opens for admin users.
- Document upload works.
- Grievance submit/reply/status update works.
- Notifications open and close correctly.

Run API tests against production:

```powershell
$env:API_BASE_URL="https://your-backend.onrender.com/api"
$env:HEALTH_URL="https://your-backend.onrender.com"
$env:TEST_USER_EMAIL="user@example.com"
$env:TEST_USER_PASSWORD="user-password"
$env:TEST_ADMIN_EMAIL="admin@example.com"
$env:TEST_ADMIN_PASSWORD="admin-password"
$env:RUN_MUTATION_TESTS="1"
.\venv\Scripts\python.exe test.py
```
