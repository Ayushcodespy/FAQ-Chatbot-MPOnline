# Frontend Documentation

React/Vite frontend for the MPOnline FAQ Chatbot.

## How The Frontend Connects To Backend

API connectivity is centralized in:

```text
frontend/src/services/api.js
```

The API base URL is:

```text
VITE_API_BASE_URL=http://localhost:8000/api
```

If `VITE_API_BASE_URL` is missing, the frontend uses:

```text
http://localhost:8000/api
```

`api.js` also adds the JWT token automatically:

```text
localStorage.auth_token -> Authorization: Bearer <token>
```

## App Route Map

Frontend routing is defined in:

```text
frontend/src/App.jsx
```

| Browser route | Page file | Access | Main purpose |
| --- | --- | --- | --- |
| `/` | `src/pages/LandingPage.jsx` | Public | Landing page, public chatbot, login CTA, grievance CTA, footer |
| `/login` | `src/pages/LoginPage.jsx` | Public | Password login, OTP login, OTP registration |
| `/chat` | `src/pages/ChatPage.jsx` | Authenticated | Saved RAG chat sessions |
| `/grievances` | `src/pages/GrievancePage.jsx` | Authenticated | User grievance submission and admin/expert grievance management |
| `/dashboard` | `src/pages/DashboardPage.jsx` | Admin/expert | Analytics cards, charts, grievance overview |
| `/upload` | `src/pages/UploadPage.jsx` | Admin | Upload/list/remove knowledge-base files |
| `/experts` | `src/pages/ExpertPanelPage.jsx` | Admin/expert | Resolve escalated chatbot questions |

Unknown routes redirect to:

- logged-in admin/expert: `/dashboard`
- logged-in normal user: `/chat`
- guest: `/`

## Shared Components

| File | Purpose |
| --- | --- |
| `src/components/ProtectedRoute.jsx` | Blocks protected pages when there is no user or wrong role |
| `src/components/Layout.jsx` | Authenticated shell with sidebar, topbar, profile, notifications, logout |
| `src/components/AppSidebar.jsx` | Navigation, new chat, recent chat list, session delete, session feedback |
| `src/components/GrievanceThread.jsx` | Comment thread UI used inside grievance detail modal |
| `src/context/AuthContext.jsx` | Provides `user`, `setSession`, and `logout` across the app |
| `src/services/api.js` | Axios client and localStorage auth helpers |
| `src/styles/global.css` | Complete app styling |

## Page Details And API Usage

### `LandingPage.jsx`

Route: `/`

Purpose:

- Public marketing/help page.
- Floating chatbot is collapsed by default.
- Public user can ask chatbot questions without login.
- Grievance CTA redirects guests to `/login`; logged-in users go to `/grievances`.
- Footer links to Home, Topics, How It Works, and Grievance.

API calls:

```text
POST /public/chat
```

Request:

```json
{
  "question": "How do I apply for an Income Certificate?",
  "language": "en"
}
```

### `LoginPage.jsx`

Route: `/login`

Purpose:

- Login with password.
- Login with OTP.
- Register with email verification OTP.
- After auth, admin/expert go to `/dashboard`; normal users go to `/chat`.

API calls:

```text
POST /auth/login/password
POST /auth/login/request-otp
POST /auth/login/verify-otp
POST /auth/register/request-otp
POST /auth/register/verify-otp
```

### `ChatPage.jsx`

Route: `/chat`

Purpose:

- Authenticated RAG chat.
- Loads saved sessions.
- Opens selected session from `?session=<id>`.
- Draft mode from `?draft=1` starts an empty unsaved chat.
- First message creates/saves a session.
- User can escalate to expert or submit feedback.

API calls:

```text
GET /chat/sessions
GET /chat/sessions/{session_id}/messages
POST /chat
POST /ask-expert
POST /feedback
```

### `UploadPage.jsx`

Route: `/upload`

Access: admin only

Purpose:

- Upload one or multiple files.
- Set a title for each uploaded file.
- Show current knowledge-base documents.
- Remove selected document.

API calls:

```text
GET /documents
POST /upload
DELETE /documents/{document_id}
```

Multipart upload fields:

```text
title: string
file: PDF/image file
```

### `DashboardPage.jsx`

Route: `/dashboard`

Access: admin/expert

Purpose:

- Overview cards first.
- Feedback and grievance charts.
- Support queue snapshot.
- Recent question analytics.

API calls:

```text
GET /analytics/questions
GET /analytics/failures
GET /analytics/usage
GET /grievances
```

### `GrievancePage.jsx`

Route: `/grievances`

Purpose:

- Normal user sees complaint submission form and own grievance list.
- Admin/expert sees support queue with filters.
- View button opens full detail modal.
- Modal shows complaint, status, user details for support users, comments, replies, and status update controls.

API calls:

```text
GET /grievances/mine
GET /grievances
POST /grievance
PATCH /grievance/{grievance_id}
POST /grievance/{grievance_id}/comments
```

### `ExpertPanelPage.jsx`

Route: `/experts`

Access: admin/expert

Purpose:

- Shows automatic/manual escalations.
- Admin/expert writes final expert response.
- Marking resolved notifies the original user.

API calls:

```text
GET /expert-queries
PATCH /expert-queries/{query_id}/resolve
```

## Auth And Logout

Session data is saved in browser localStorage:

```text
auth_token
auth_user
```

Logout clears both values and redirects to landing page `/`.

## Chatbot Floating Icon

Place your PNG here:

```text
frontend/public/chatbot/chatbot-icon.png
```

The app loads it from:

```text
/chatbot/chatbot-icon.png
```

If the PNG is missing, the fallback `MP` mark remains visible.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Production build:

```bash
npm run build
```
