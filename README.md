# MPOnline FAQ Chatbot

A full-stack document-grounded FAQ chatbot built with FastAPI, React/Vite, PostgreSQL, FAISS, OCR, email notifications, and role-based workflows.

The app has two entry points:

- Public visitors open the landing page and can ask the floating chatbot without login.
- Logged-in users can use saved chat sessions and submit grievances.
- Admin/expert users can manage documents, grievances, expert queries, analytics, and notifications.

## Current Features

- Public landing page at `/` with floating chatbot and grievance login CTA.
- Email OTP registration and login support.
- Password login support.
- JWT auth with `user`, `admin`, and `expert` roles.
- RAG chat backed by uploaded documents and FAISS vector search.
- Admin document upload with custom document titles, multi-file upload, document list, and delete action.
- ChatGPT-like saved chat sessions with new-chat, reopen, delete, and feedback.
- Grievance submission, list/detail modal, comments, status update, email notification, and in-app notifications.
- Admin/expert dashboard with cards, feedback chart, grievance chart, and analytics.
- Expert escalation queue for unanswered or manually escalated questions.
- Public/private API split: `/api/public/chat` is open, most other APIs require JWT.

## Project Structure

```text
FAQ_Chatbot/
  app/
    main.py                 FastAPI app, startup, CORS, router mounting
    config.py               .env settings and runtime paths
    database.py             SQLAlchemy engine/session dependency
    dependencies.py         JWT current-user and role guards
    models/                 SQLAlchemy entities and Pydantic schemas
    routes/                 API route modules
    services/               Auth, chat, AI, document, OCR, email, analytics logic
    utils/                  Chunking and JWT helpers
    data/                   FAISS index and metadata
    uploads/                Uploaded source files
  frontend/
    src/
      App.jsx               Frontend route map
      pages/                Landing, login, chat, dashboard, upload, grievance, expert pages
      components/           Layout, sidebar, protected route, grievance thread
      context/              Auth context
      services/api.js       Axios API client and localStorage auth
      styles/global.css     App-wide UI styling
    public/chatbot/         Floating chatbot PNG icon assets
```

## Connectivity Overview

Frontend connects to the backend through `frontend/src/services/api.js`.

```js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
```

All normal frontend API calls are relative to this base URL:

```text
api.get("/documents") -> http://localhost:8000/api/documents
api.post("/chat")    -> http://localhost:8000/api/chat
```

Authentication works like this:

1. Login/register API returns `access_token` and `user`.
2. `authStorage.setSession()` stores them in browser `localStorage`.
3. Axios interceptor adds `Authorization: Bearer <token>` to every request.
4. Backend `get_current_user` validates the JWT.
5. Protected frontend routes check `user.role` before rendering admin/expert pages.

## Backend Routers

All routers are mounted in `app/main.py` under `settings.api_prefix`, which defaults to `/api`.

| Router file | Mounted endpoints | Purpose |
| --- | --- | --- |
| `app/routes/auth.py` | `/api/auth/...` | Register, email OTP, password login, OTP login |
| `app/routes/chat.py` | `/api/public/chat`, `/api/chat`, `/api/chat/sessions`, `/api/history`, `/api/reset` | Public chat, protected RAG chat, saved chat sessions |
| `app/routes/documents.py` | `/api/upload`, `/api/documents`, `/api/documents/{id}` | Admin knowledge-base upload/list/delete |
| `app/routes/grievance.py` | `/api/grievance...`, `/api/grievances...` | User grievances, support queue, comments, status updates |
| `app/routes/expert.py` | `/api/ask-expert`, `/api/expert-queries...` | Manual/automatic expert escalation |
| `app/routes/feedback.py` | `/api/feedback` | Helpful/not-helpful and rating feedback |
| `app/routes/notifications.py` | `/api/notifications...` | In-app notifications |
| `app/routes/analytics.py` | `/api/analytics/...` | Dashboard analytics |

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for request bodies, auth requirements, and behavior.

## Main Runtime Flows

### App Startup

1. `uvicorn app.main:app --reload` starts FastAPI.
2. `Base.metadata.create_all(bind=engine)` creates missing tables.
3. `ensure_bootstrap_admin(...)` creates the configured admin if missing.
4. Routers are mounted under `/api`.
5. CORS allows the configured frontend origin.

### Document Upload and Vector Database

1. Admin opens frontend `/upload`.
2. Upload page sends `POST /api/upload` with multipart fields `title` and `file`.
3. `document_service.ingest_document()` saves the file under `app/uploads`.
4. `ocr_service.extract_text()` extracts PDF/image text using PyMuPDF/pypdf/Tesseract fallback.
5. Text is chunked by `app/utils/chunking.py`.
6. `AIService.embed_texts()` creates embeddings with OpenAI or Gemini.
7. Document metadata is saved in PostgreSQL.
8. Vectors are saved in `app/data/faiss.index`.
9. Chunk metadata is saved in `app/data/faiss_metadata.json`.
10. Chat answers now use the updated knowledge base.

### Public Landing Chat

1. Visitor opens `/`.
2. Floating chatbot sends `POST /api/public/chat`.
3. Backend searches FAISS and generates a grounded answer.
4. No JWT is required and the chat is not stored as a user session.

### Logged-In Chat

1. User opens `/chat`.
2. Chat page loads sessions through `GET /api/chat/sessions`.
3. User sends a question through `POST /api/chat`.
4. Backend embeds the question, searches FAISS, generates a grounded answer, and saves the message.
5. Frontend reloads sessions/messages and shows sources/confidence.
6. Low-confidence answers can create expert queries.

### Grievance Flow

1. User opens `/grievances` and submits `POST /api/grievance`.
2. Backend stores the grievance, emails the user, and notifies admin/expert users.
3. Admin/expert opens `/grievances`, views the detail modal, replies, or changes status.
4. Replies and status updates create in-app notifications.
5. User receives email for submission, admin/expert replies, and status changes.

### Dashboard Flow

1. Admin/expert opens `/dashboard`.
2. Frontend loads `/api/analytics/questions`, `/api/analytics/failures`, `/api/analytics/usage`, and `/api/grievances`.
3. Cards show open/solved grievances, total questions, escalations, failed answers, documents, feedback, and expert queue.
4. Charts show helpful feedback share and grievance resolution rate.

## Environment Variables

Copy `.env.example` to `.env` and fill required values.

Important backend values:

```text
DATABASE_URL=postgresql://...
SECRET_KEY=...
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=admin123
BOOTSTRAP_ADMIN_USERNAME=admin
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
OPENAI_API_KEY=...
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_USE_TLS=false
MAIL_USE_SSL=true
VECTOR_STORE_PATH=app/data/faiss.index
VECTOR_METADATA_PATH=app/data/faiss_metadata.json
UPLOAD_DIR=app/uploads
```

Important frontend value:

```text
VITE_API_BASE_URL=http://localhost:8000/api
```

## Run Locally

Backend:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
Frontend: http://localhost:5173
Backend docs: http://localhost:8000/docs
API base: http://localhost:8000/api
```

## Frontend Pages

Detailed frontend page mapping is in [frontend/README.md](frontend/README.md).

Quick map:

| Route | Page file | Access |
| --- | --- | --- |
| `/` | `frontend/src/pages/LandingPage.jsx` | Public |
| `/login` | `frontend/src/pages/LoginPage.jsx` | Public unless already logged in |
| `/chat` | `frontend/src/pages/ChatPage.jsx` | Logged-in users |
| `/grievances` | `frontend/src/pages/GrievancePage.jsx` | Logged-in users |
| `/dashboard` | `frontend/src/pages/DashboardPage.jsx` | Admin/expert |
| `/upload` | `frontend/src/pages/UploadPage.jsx` | Admin |
| `/experts` | `frontend/src/pages/ExpertPanelPage.jsx` | Admin/expert |

## Notes

- Public chat uses the same knowledge base but does not require login.
- Grievance submission requires login.
- Logout redirects to landing page `/`.
- Floating chatbot icon can be replaced by placing `chatbot-icon.png` in `frontend/public/chatbot/`.
- If FAISS files are removed, uploaded DB rows can still exist but vector search will lose those chunks.
- If PostgreSQL rows are removed but FAISS metadata remains, `/documents` may show indexed fallback documents from vector metadata.




BRD LINK : https://drive.google.com/file/d/10xkN-av3bHEXy1k8D66_u9IXMhaUCqqW/view?usp=drive_link

SRS LINK : https://drive.google.com/file/d/1ZqL9-wAfYEzzg62gSuCjmqCna8YbruTv/view?usp=sharing

PROJECT REPORT LINK : https://drive.google.com/file/d/1uSKQ-IO4VJIr-QVxRjDoTLYYMhIQdC9S/view?usp=drive_link

PROJECT PRESENTATION LINK: https://docs.google.com/presentation/d/1xghSrBN9fpgm8hrcAw2JwMKEOchK4Zje/edit?usp=drive_link&ouid=111535881805042064456&rtpof=true&sd=true

DEMO VIDEO LINK : https://drive.google.com/file/d/1zNdcLvXcIcYlYhLnD33pQEPgP0OeTLJr/view?usp=sharing
