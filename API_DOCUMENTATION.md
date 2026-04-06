# API Documentation

Base URL: `http://localhost:8000/api`

## Authentication

### `POST /auth/register`

```json
{
  "username": "admin1",
  "email": "admin@example.com",
  "password": "StrongPassword123",
  "role": "user"
}
```

### `POST /auth/login`

```json
{
  "username": "admin1",
  "password": "StrongPassword123"
}
```

## Documents

### `POST /upload`

Multipart form upload with field `file`. Requires role `admin`.

## Chat

### `POST /chat`

```json
{
  "question": "How can I apply for MPOnline services?",
  "language": "en",
  "session_id": 1
}
```

### `GET /history`

Returns the authenticated user's chat history.

### `POST /chat/sessions`

Creates a new chat session.

```json
{
  "title": "New chat"
}
```

### `GET /chat/sessions`

Returns all chat sessions for the logged-in user.

### `GET /chat/sessions/{id}/messages`

Returns all messages for a specific chat session.

### `POST /reset`

Clears the authenticated user's entire chat workspace.

## Expert Escalation

### `POST /ask-expert`

```json
{
  "question": "The document does not cover this edge case.",
  "reason": "manual_request"
}
```

### `GET /expert-queries`

Requires role `admin` or `expert`.

### `PATCH /expert-queries/{id}/resolve`

```json
{
  "expert_response": "Please use the district office escalation path.",
  "status": "resolved"
}
```

## Grievance

### `POST /grievance`

```json
{
  "complaint": "The chatbot could not answer my issue."
}
```

### `GET /grievance/{id}`

Returns grievance status by id.

### `GET /grievances`

Returns all grievances for `admin` and `expert` users.

### `GET /grievances/mine`

Returns all grievances submitted by the currently logged-in user.

### `PATCH /grievance/{id}`

Allows `admin` and `expert` users to update grievance status.

```json
{
  "status": "resolved"
}
```

## Feedback

### `POST /feedback`

```json
{
  "question": "What documents are required?",
  "answer": "Identity documents are required as listed in the uploaded guide.",
  "rating": 4
}
```

## Analytics

All analytics endpoints require role `admin` or `expert`.

### `GET /analytics/questions`

### `GET /analytics/failures`

### `GET /analytics/usage`
