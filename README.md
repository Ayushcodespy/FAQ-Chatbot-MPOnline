# MPOnline FAQ Chatbot

Production-ready full-stack FAQ chatbot built with FastAPI, React (Vite), PostgreSQL, FAISS, OCR via Tesseract, and a grounded RAG pipeline. The chatbot answers only from uploaded MPOnline documents and escalates uncertain cases to experts.

## Features

- RAG-based FAQ answering with OpenAI or Gemini
- PDF and image document upload with OCR
- FAISS local vector search
- PostgreSQL-backed auth, chat history, grievance, expert queue, feedback, and analytics
- JWT authentication with `user`, `admin`, and `expert` roles
- React frontend with chat, upload, dashboard, grievance, and expert workflows
- Hindi and English response mode

## Backend Setup

1. Create PostgreSQL database:

```sql
CREATE DATABASE faq_chatbot;
```

2. Create and activate a virtual environment.

3. Install Python dependencies:

```bash
pip install -r requirements.txt
```

4. Copy `.env.example` to `.env` and update:

- `DATABASE_URL`
- `SECRET_KEY`
- `BOOTSTRAP_ADMIN_*`
- `LLM_PROVIDER`
- `OPENAI_API_KEY` or `GEMINI_API_KEY`
- `TESSERACT_CMD` if required on Windows

5. Install Tesseract OCR on your machine.

6. Run the backend:

```bash
uvicorn app.main:app --reload
```

## Frontend Setup

1. Change into the frontend directory.
2. Install dependencies with `npm install`.
3. Create `frontend/.env` with `VITE_API_BASE_URL=http://localhost:8000/api`.
4. Start the app with `npm run dev`.

## Default Workflow

1. Start the backend with `BOOTSTRAP_ADMIN_*` set in `.env`.
2. Log in as the bootstrap admin and upload MPOnline documents from the Upload page.
3. Register normal end users from the login screen and ask questions in Chat.
4. Users can open the Grievance page to submit complaints and view all of their own grievance entries.
5. If a user submits a grievance, it appears in the admin or expert Dashboard with a notification badge and status controls.
6. Review expert escalations and analytics from the admin or expert UI.

## Chat Experience

- The chat page now supports multiple chat sessions like ChatGPT.
- Use `New chat` to start a fresh conversation.
- Previous chats remain visible in the sidebar and can be reopened anytime.

## RAG Flow

1. Upload PDF or image documents.
2. Extract text using native PDF parsing plus Tesseract OCR fallback.
3. Clean and chunk text into overlapping searchable passages.
4. Generate embeddings with OpenAI or Gemini.
5. Store vectors locally in FAISS and metadata in JSON.
6. Retrieve top relevant chunks for a question.
7. Ask the LLM to answer only from retrieved context.
8. Return `"I don't know"` and escalate if confidence is low or context is missing.

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for endpoint details.
