  # MPOnline FAQ Chatbot - Full System Flow Explanation

  This document explains how the project works end to end.

  It is written for understanding the actual codebase, not just the theory.

  ---

  ## 1. Project Purpose

  This project is a **document-grounded FAQ chatbot** for MPOnline-type service documents.

  The chatbot is **not a general chatbot**.

  It answers only from uploaded PDF/image documents by using:

  - OCR for extracting text
  - Chunking for breaking large text into smaller searchable parts
  - Embeddings for vector representation
  - FAISS for similarity search
  - OpenAI or Gemini for answer generation
  - PostgreSQL for application data

  If relevant context is not found, the system returns:

  `I don't know`

  ---

  ## 2. High-Level Architecture

  The stack is split into 4 main layers:

  ### Backend

  - FastAPI app
  - Authentication
  - Upload/OCR/indexing
  - Chat/RAG logic
  - Expert escalation
  - Grievance system
  - Notifications
  - Analytics APIs

  ### AI Layer

  - Embedding generation
  - Grounded answer generation
  - Provider can be OpenAI or Gemini

  ### Retrieval Layer

  - FAISS index stores vector embeddings locally
  - JSON metadata file stores chunk-to-document mapping

  ### Frontend

  - React + Vite
  - Chat UI
  - Upload page
  - Dashboard
  - Grievance page
  - Expert panel
  - Notification bell

  ---

  ## 3. What Happens on App Startup

  Main file: `app/main.py`

  When the backend starts:

  1. FastAPI app is created.
  2. `Base.metadata.create_all(bind=engine)` runs.
    This creates all missing database tables in PostgreSQL.
  3. A DB session is opened.
  4. `ensure_bootstrap_admin(...)` runs.
    This creates the first admin user if it does not already exist.
  5. Routers are mounted under `/api`.

  So startup does 2 important things:

  - ensures DB tables exist
  - ensures bootstrap admin exists

  ---

  ## 4. Configuration and Environment Variables

  Main file: `app/config.py`

  Settings are loaded from `.env`.

  Important values:

  - `DATABASE_URL`
    PostgreSQL connection string
  - `LLM_PROVIDER`
    `openai` or `gemini`
  - `OPENAI_API_KEY` / `GEMINI_API_KEY`
  - `VECTOR_STORE_PATH`
    FAISS index file path
  - `VECTOR_METADATA_PATH`
    metadata JSON path
  - `UPLOAD_DIR`
    where uploaded files are stored
  - `TOP_K_CHUNKS`
    how many chunks are retrieved from FAISS
  - `MIN_SIMILARITY_SCORE`
    threshold below which chunks are treated as not relevant
  - `MAX_CHUNK_WORDS`
    chunk size
  - `CHUNK_OVERLAP_WORDS`
    overlap between chunks
  - `TESSERACT_CMD`
    path to Tesseract if not already on PATH

  On startup, the code also makes sure these folders exist:

  - `app/uploads`
  - folder containing `app/data/faiss.index`

  ---

  ## 5. Database Layer

  Main file: `app/database.py`

  The project uses:

  - SQLAlchemy engine
  - SQLAlchemy session factory
  - PostgreSQL as persistent relational storage

  `get_db()` provides a DB session to FastAPI routes.

  ### Major tables in this project

  Defined in `app/models/entities.py`

  - `users`
  - `documents`
  - `chat_history`
  - `chat_sessions`
  - `chat_messages`
  - `expert_queries`
  - `grievances`
  - `grievance_comments`
  - `feedback`
  - `notifications`

  ---

  ## 6. Where Uploaded Documents Are Saved

  This is the most important part if you want to understand document flow.

  ### Physical file storage

  When an admin uploads a file:

  - the raw file is saved in `app/uploads/`
  - it is renamed to a UUID-based unique filename

  Example:

  `app/uploads/3e5a9b2d4c0f4a0da6f3d63f7c2c11ab.pdf`

  This is done in:

  - `app/services/document_service.py`
  - function: `save_upload(file)`

  ### Relational DB storage

  After OCR succeeds, one row is inserted into the `documents` table:

  - original filename
  - saved file path
  - extracted text
  - chunk count
  - uploaded_by

  So document information is also stored in PostgreSQL.

  ### Vector storage

  The document text is chunked and embedded.

  Those embeddings are stored in FAISS:

  - `app/data/faiss.index`

  Chunk metadata is stored in:

  - `app/data/faiss_metadata.json`

  So one uploaded document is stored in **three places**:

  1. raw file on disk
  2. document row in PostgreSQL
  3. embeddings + metadata in FAISS files

  ---

  ## 7. Full Upload Flow

  Frontend file:

  - `frontend/src/pages/UploadPage.jsx`

  Backend route:

  - `POST /api/upload`
  - file: `app/routes/documents.py`

  ### Step by step

  1. Admin selects a PDF or image in the Upload page.
  2. Frontend creates `FormData`.
  3. Frontend sends `POST /api/upload`.
  4. Backend route calls `ingest_document(db, file, current_user)`.
  5. `save_upload()` writes the uploaded file into `app/uploads`.
  6. `extract_text(saved_path)` runs OCR/text extraction.
  7. Extracted text is chunked using `chunk_text(...)`.
  8. `AIService.embed_texts(chunks)` creates embeddings.
  9. A `Document` row is stored in PostgreSQL.
  10. `vector_store.add_embeddings(...)` stores embeddings into FAISS.
  11. Backend returns upload success response.
  12. Frontend shows:
      `filename indexed successfully with N chunks`

  ---

  ## 8. How OCR Works

  Main file:

  - `app/services/ocr_service.py`

  ### If the file is an image

  Flow:

  1. open image with PIL
  2. run Tesseract OCR
  3. use language pack `eng+hin`
  4. clean the text

  ### If the file is a PDF

  Flow per page:

  1. try `PyMuPDF` text extraction first using `page.get_text("text")`
  2. if extracted text is too small, treat page as scanned image
  3. render page as image
  4. run Tesseract on that page image
  5. merge all page text
  6. clean final text

  So PDF extraction is hybrid:

  - native PDF text extraction first
  - OCR fallback if page looks image-based/scanned

  ---

  ## 9. How Chunking Works

  Main file:

  - `app/utils/chunking.py`

  The document text is normalized first:

  - null bytes removed
  - multiple whitespace collapsed

  Then chunking happens word-by-word.

  ### Logic

  - split text into words
  - create chunks of `MAX_CHUNK_WORDS`
  - overlap by `CHUNK_OVERLAP_WORDS`

  Example:

  If chunk size is 180 and overlap is 40:

  - chunk 1 = words 1 to 180
  - chunk 2 = words 141 to 320
  - chunk 3 = words 281 to 460

  Why overlap is used:

  - context continuity
  - important sentences are less likely to be cut badly

  ---

  ## 10. How FAISS Storage Works

  Main file:

  - `app/services/vector_store.py`

  The project uses a local FAISS index.

  ### What is saved in FAISS

  FAISS stores only vectors.

  For each chunk embedding:

  - vector goes into `faiss.index`
  - metadata goes into `faiss_metadata.json`

  Metadata example for each chunk:

  - `document_id`
  - `document_name`
  - `chunk_index`
  - `text`

  ### Important detail

  This code normalizes vectors and uses:

  - `faiss.IndexFlatIP`

  Because vectors are normalized, inner product behaves like cosine similarity.

  ---

  ## 11. If You Upload Two Documents, What Happens

  Suppose you upload:

  1. `ServiceA.pdf`
  2. `ServiceB.pdf`

  Then this happens:

  ### On disk

  Both files are saved separately in `app/uploads/`

  ### In PostgreSQL

  Two separate rows are created in `documents`

  ### In FAISS

  All chunk embeddings from both documents are added into the same FAISS index

  ### In metadata JSON

  Each chunk keeps its own document reference

  So search can return:

  - some chunks from document 1
  - some chunks from document 2

  If a user question matches both documents, context can come from both.

  The final answer prompt includes source names, so the LLM knows where each chunk came from.

  ---

  ## 12. Full Chat / Response Flow

  Frontend file:

  - `frontend/src/pages/ChatPage.jsx`

  Backend route:

  - `POST /api/chat`
  - file: `app/routes/chat.py`

  Main backend logic:

  - `app/services/chat_service.py`
  - function: `answer_question(...)`

  ### Step by step

  1. User types a question in the chat box.
  2. Frontend sends:
    - `question`
    - `language`
    - `session_id`
  3. Backend enters `answer_question(...)`.
  4. Backend checks whether FAISS has any indexed data.
    If no data:
    - returns `409`
    - message: upload documents first
  5. Backend loads existing chat session or creates a new one.
  6. `AIService.embed_query(question)` creates the query embedding.
  7. `vector_store.search(query_embedding, top_k)` retrieves nearest chunks.
  8. Retrieved chunks are filtered by `MIN_SIMILARITY_SCORE`.
  9. If nothing passes the filter:
    - expert query is created
    - answer becomes `I don't know`
  10. If relevant chunks are found:
      - `generate_grounded_answer(...)` is called
  11. The LLM gets:
      - question
      - retrieved context
      - strict grounding instructions
  12. LLM returns structured JSON:
      - `answer`
      - `grounded`
      - `confidence`
      - `sources`
  13. Backend calculates final confidence.
  14. If low confidence or not grounded:
      - expert query is created
      - final answer becomes `I don't know`
  15. Chat result is stored in:
      - `chat_history`
      - `chat_messages`
  16. Session title is updated from `New chat` to first question text.
  17. API response is returned to frontend.
  18. Frontend reloads:
      - chat sessions
      - messages of active session
  19. UI shows the assistant response.

  ---

  ## 13. How the Response Is Generated

  Main file:

  - `app/services/ai_service.py`

  ### Step 1: Build Context

  Retrieved chunks are converted into one context string like:

  `[Source: file.pdf | Chunk 2] ...text...`

  ### Step 2: Prompt Rules

  The prompt tells the LLM:

  - answer only from context
  - if context is insufficient, say `I don't know`
  - do not invent procedures, fees, deadlines, URLs
  - return JSON
  - use Markdown only for readability

  ### Step 3: LLM Call

  If provider is OpenAI:

  - embeddings from OpenAI embedding model
  - response from OpenAI chat model

  If provider is Gemini:

  - embeddings from Gemini embedding model
  - response from Gemini chat model

  ### Step 4: JSON Parsing

  The response is parsed.

  If parsing fails:

  - fallback answer becomes `I don't know`

  ### Step 5: Grounding Check

  Even if LLM answered something, backend still checks:

  - grounded flag
  - confidence

  If grounded is false or confidence too low:

  - answer returned to user becomes `I don't know`

  That is how hallucination is reduced.

  ---

  ## 14. Why You Sometimes Get `I don't know`

  This can happen when:

  1. no document has been uploaded
  2. OCR extracted poor text
  3. question does not match any chunk strongly enough
  4. LLM marks answer as not grounded
  5. confidence falls below threshold

  So `I don't know` is often a **safety decision**, not a bug.

  ---

  ## 15. How Chat Sessions Work

  Tables involved:

  - `chat_sessions`
  - `chat_messages`

  ### Session behavior

  - `New chat` creates a new row in `chat_sessions`
  - each user question/assistant answer pair creates one `chat_messages` row
  - session title is automatically set from first question
  - sidebar loads sessions from `GET /api/chat/sessions`
  - opening a session loads its message list from:
    `GET /api/chat/sessions/{id}/messages`

  ### Delete chat

  Single session delete endpoint:

  - `DELETE /api/chat/sessions/{session_id}`

  This removes that session and its messages.

  ### Reset all chats

  `POST /api/reset`

  This clears:

  - `chat_history`
  - `chat_messages`
  - `chat_sessions`

  It does **not** delete uploaded documents or FAISS data.

  ---

  ## 16. How the Frontend Shows the Response

  Main file:

  - `frontend/src/pages/ChatPage.jsx`

  Flow:

  1. user submits question
  2. Axios sends request to backend
  3. backend returns structured answer
  4. frontend reloads session list
  5. frontend reloads current session messages
  6. `ReactMarkdown` renders the answer nicely
  7. user can:
    - ask expert
    - give helpful/not helpful feedback

  So the response visible in UI is not directly inserted from the request result only.
  The page also reloads session/message state after the response comes back.

  ---

  ## 17. Feedback Flow

  Table:

  - `feedback`

  When user clicks:

  - `Helpful`
  - `Not Helpful`

  Frontend sends:

  - question
  - answer
  - rating

  Backend stores it in the `feedback` table.

  Chat session sidebar also supports session feedback by taking the latest chat message of that session.

  ---

  ## 18. Expert Escalation Flow

  Table:

  - `expert_queries`

  Main files:

  - `app/routes/expert.py`
  - `app/services/chat_service.py`

  Expert query is created in two ways:

  ### Automatic escalation

  During chat:

  - no relevant context found
  - or confidence is low

  Then backend creates an expert query automatically.

  ### Manual escalation

  User clicks `Ask Expert`

  Then frontend calls:

  - `POST /api/ask-expert`

  ### Expert resolution

  Admin/expert sees records in Expert Panel
  and can resolve them by writing `expert_response`.

  ---

  ## 19. Grievance Flow

  Tables:

  - `grievances`
  - `grievance_comments`

  Main file:

  - `app/routes/grievance.py`

  ### Create grievance

  User submits complaint:

  - row inserted into `grievances`
  - admins/experts receive notifications

  ### Comment flow

  Both sides can comment:

  - user can reply
  - admin/expert can reply

  Comments are stored in:

  - `grievance_comments`

  ### Status update

  Admin/expert can set status like:

  - `open`
  - `in_review`
  - `resolved`
  - `rejected`

  When status changes:

  - grievance status column updates
  - a status-update comment is inserted
  - the user receives a notification

  ---

  ## 20. Notification Flow

  Table:

  - `notifications`

  Main files:

  - `app/routes/notifications.py`
  - `frontend/src/components/Layout.jsx`

  Notifications are created for things like:

  - new grievance submitted
  - grievance reply
  - grievance status changed
  - expert escalation requested
  - expert query updated

  Frontend bell icon:

  - loads `/api/notifications`
  - shows unread count
  - lets user mark single notification read
  - mark all as read
  - select multiple
  - delete selected

  ---

  ## 21. Exactly Where Data Lives

  ### PostgreSQL

  Stores:

  - users
  - documents metadata
  - chat history
  - chat sessions/messages
  - expert queries
  - grievances
  - grievance comments
  - feedback
  - notifications

  ### Filesystem

  Stores:

  - raw uploaded files in `app/uploads/`
  - FAISS index in `app/data/faiss.index`
  - FAISS metadata in `app/data/faiss_metadata.json`

  ### Browser localStorage

  Stores:

  - JWT token
  - logged-in user object
  - sidebar collapsed state

  ---

  ## 22. Important Practical Notes

  ### Uploaded document deletion

  There is currently no full document delete/re-index flow in the code.

  That means once document chunks are added to FAISS, there is no normal API that removes those vectors again.

  ### OCR quality matters

  If OCR extracts bad text, retrieval quality will also be bad.

  ### `reset` does not delete knowledge base

  It only deletes chats, not documents or embeddings.

  ### Both DB and FAISS are required

  Documents are not stored only in PostgreSQL.
  Searchable knowledge also depends on FAISS files.

  ---

  ## 23. End-to-End Example

  Suppose admin uploads 2 files:

  - `BirthCertificate.pdf`
  - `IncomeCertificate.jpg`

  ### After upload

  1. both files saved in `app/uploads`
  2. OCR extracts text
  3. text is chunked
  4. embeddings created
  5. both documents inserted into `documents` table
  6. all chunks inserted into FAISS

  ### User asks

  `Income certificate ke liye required documents kya hain?`

  Then:

  1. query embedding is created
  2. FAISS searches all indexed chunks
  3. best matches likely come from `IncomeCertificate.jpg`
  4. those chunks are inserted into prompt
  5. LLM generates grounded answer
  6. answer saved to `chat_history` and `chat_messages`
  7. frontend shows answer with sources

  If user asks:

  `Hello`

  Then likely:

  1. no meaningful chunk matches
  2. filtered matches become empty
  3. expert query may be created
  4. response becomes `I don't know`

  because the bot is document-grounded, not open-domain chat.

  ---

  ## 24. Short Summary

  If you want to remember the system in one line:

  ### Upload flow

  `File -> uploads folder -> OCR -> chunking -> embeddings -> PostgreSQL document row -> FAISS index`

  ### Chat flow

  `Question -> query embedding -> FAISS search -> top chunks -> LLM prompt -> grounded answer -> save chat -> return response`

  ---

  ## 25. Files You Should Read First

  If you want to understand the project quickly, read these in order:

  1. `app/main.py`
  2. `app/config.py`
  3. `app/models/entities.py`
  4. `app/services/document_service.py`
  5. `app/services/ocr_service.py`
  6. `app/utils/chunking.py`
  7. `app/services/vector_store.py`
  8. `app/services/ai_service.py`
  9. `app/services/chat_service.py`
  10. `app/routes/chat.py`
  11. `frontend/src/pages/UploadPage.jsx`
  12. `frontend/src/pages/ChatPage.jsx`
  13. `frontend/src/components/AppSidebar.jsx`
  14. `frontend/src/components/Layout.jsx`

  ---

  If you want, the next step can be:

  1. I can also make a **diagram version** of this flow in Mermaid inside another `.md` file.
  2. I can make a **very simple Hindi explanation** version.
  3. I can annotate this same document with exact API endpoints and sample request/response bodies.
