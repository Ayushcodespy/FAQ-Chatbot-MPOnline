"""
Report-friendly API smoke and integration tests for MPOnline FAQ Chatbot.

Start backend first:
    uvicorn app.main:app --reload

Run basic tests:
    .\\venv\\Scripts\\python.exe test.py

Run authenticated tests:
    $env:TEST_USER_EMAIL="user@example.com"
    $env:TEST_USER_PASSWORD="user-password"
    $env:TEST_ADMIN_EMAIL="admin@example.com"
    $env:TEST_ADMIN_PASSWORD="admin-password"
    .\\venv\\Scripts\\python.exe test.py

Run full report tests that create sample feedback/grievance records:
    $env:RUN_MUTATION_TESTS="1"
    .\\venv\\Scripts\\python.exe test.py
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api").rstrip("/")
HEALTH_URL = os.getenv("HEALTH_URL", "http://localhost:8000/").rstrip("/")
OPENAPI_URL = f"{HEALTH_URL}/openapi.json"

TEST_USER_EMAIL = os.getenv("TEST_USER_EMAIL")
TEST_USER_PASSWORD = os.getenv("TEST_USER_PASSWORD")
TEST_ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL")
TEST_ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD")
RUN_MUTATION_TESTS = os.getenv("RUN_MUTATION_TESTS") == "1"

_USER_TOKEN: str | None = None
_ADMIN_TOKEN: str | None = None
_TEST_GRIEVANCE_ID: int | None = None


@dataclass
class ApiResponse:
    status: int
    body: Any


class TestSkip(Exception):
    pass


def api_url(path: str) -> str:
    return urljoin(f"{API_BASE_URL}/", path.lstrip("/"))


def request_json(
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    token: str | None = None,
) -> ApiResponse:
    body = None
    headers = {"Accept": "application/json"}

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = Request(url, data=body, headers=headers, method=method)

    try:
        with urlopen(request, timeout=25) as response:
            return ApiResponse(response.status, parse_body(response.read()))
    except HTTPError as error:
        return ApiResponse(error.code, parse_body(error.read()))
    except URLError as error:
        raise AssertionError(f"Could not connect to {url}: {error.reason}") from error


def parse_body(raw_body: bytes) -> Any:
    if not raw_body:
        return None

    text = raw_body.decode("utf-8", errors="replace")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def assert_status(response: ApiResponse, expected: int | tuple[int, ...]) -> None:
    expected_values = expected if isinstance(expected, tuple) else (expected,)
    if response.status not in expected_values:
        raise AssertionError(
            f"Expected status {expected_values}, got {response.status}. Body: {response.body}"
        )


def assert_has_keys(data: Any, keys: list[str]) -> None:
    if not isinstance(data, dict):
        raise AssertionError(f"Expected JSON object, got {type(data).__name__}: {data}")

    missing = [key for key in keys if key not in data]
    if missing:
        raise AssertionError(f"Missing keys {missing}. Body: {data}")


def assert_is_list(data: Any) -> None:
    if not isinstance(data, list):
        raise AssertionError(f"Expected JSON list, got {type(data).__name__}: {data}")


def login(email: str | None, password: str | None, expected_role: str, label: str) -> str:
    if not email or not password:
        raise TestSkip(f"Set {label}_EMAIL and {label}_PASSWORD to run this test.")

    response = request_json(
        "POST",
        api_url("/auth/login"),
        {"email": email, "password": password},
    )
    assert_status(response, 200)
    assert_has_keys(response.body, ["access_token", "user"])
    assert_has_keys(response.body["user"], ["email", "role"])

    actual_role = response.body["user"]["role"]
    if actual_role != expected_role:
        raise AssertionError(f"Expected {expected_role} role, got {actual_role}")

    return response.body["access_token"]


def get_user_token() -> str:
    global _USER_TOKEN
    if not _USER_TOKEN:
        _USER_TOKEN = login(TEST_USER_EMAIL, TEST_USER_PASSWORD, "user", "TEST_USER")
    return _USER_TOKEN


def get_admin_token() -> str:
    global _ADMIN_TOKEN
    if not _ADMIN_TOKEN:
        _ADMIN_TOKEN = login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, "admin", "TEST_ADMIN")
    return _ADMIN_TOKEN


def create_test_grievance() -> int:
    global _TEST_GRIEVANCE_ID
    if _TEST_GRIEVANCE_ID:
        return _TEST_GRIEVANCE_ID

    response = request_json(
        "POST",
        api_url("/grievance"),
        {"complaint": "Software testing sample grievance created by test.py."},
        token=get_user_token(),
    )
    assert_status(response, 200)
    assert_has_keys(response.body, ["id", "complaint", "status", "comments"])
    _TEST_GRIEVANCE_ID = response.body["id"]
    return _TEST_GRIEVANCE_ID


def require_mutation_tests() -> None:
    if not RUN_MUTATION_TESTS:
        raise TestSkip("Set RUN_MUTATION_TESTS=1 to run DB-writing report tests.")


def test_backend_health() -> None:
    response = request_json("GET", f"{HEALTH_URL}/")
    assert_status(response, 200)
    assert_has_keys(response.body, ["name", "status"])
    assert response.body["status"] == "ok"


def test_openapi_schema_available() -> None:
    response = request_json("GET", OPENAPI_URL)
    assert_status(response, 200)
    assert_has_keys(response.body, ["openapi", "paths"])


def test_public_chat_validation() -> None:
    response = request_json("POST", api_url("/public/chat"), {"question": "a", "language": "en"})
    assert_status(response, 422)


def test_protected_chat_sessions_require_login() -> None:
    response = request_json("GET", api_url("/chat/sessions"))
    assert_status(response, (401, 403))


def test_protected_notifications_require_login() -> None:
    response = request_json("GET", api_url("/notifications"))
    assert_status(response, (401, 403))


def test_invalid_login_is_rejected() -> None:
    response = request_json(
        "POST",
        api_url("/auth/login"),
        {"email": "wrong-user@example.com", "password": "wrong-password"},
    )
    assert_status(response, (400, 401, 422))


def test_user_login_returns_token() -> None:
    token = get_user_token()
    assert isinstance(token, str) and len(token) > 10


def test_admin_login_returns_token() -> None:
    token = get_admin_token()
    assert isinstance(token, str) and len(token) > 10


def test_user_chat_sessions_list() -> None:
    response = request_json("GET", api_url("/chat/sessions"), token=get_user_token())
    assert_status(response, 200)
    assert_is_list(response.body)


def test_user_notifications_list() -> None:
    response = request_json("GET", api_url("/notifications"), token=get_user_token())
    assert_status(response, 200)
    assert_is_list(response.body)


def test_user_grievances_list() -> None:
    response = request_json("GET", api_url("/grievances/mine"), token=get_user_token())
    assert_status(response, 200)
    assert_is_list(response.body)


def test_user_cannot_access_analytics() -> None:
    response = request_json("GET", api_url("/analytics/usage"), token=get_user_token())
    assert_status(response, 403)


def test_user_cannot_access_document_admin_api() -> None:
    response = request_json("GET", api_url("/documents"), token=get_user_token())
    assert_status(response, 403)


def test_user_cannot_access_expert_queue() -> None:
    response = request_json("GET", api_url("/expert-queries"), token=get_user_token())
    assert_status(response, 403)


def test_logged_in_chat_validation() -> None:
    response = request_json(
        "POST",
        api_url("/chat"),
        {"question": "a", "language": "en"},
        token=get_user_token(),
    )
    assert_status(response, 422)


def test_feedback_validation() -> None:
    response = request_json(
        "POST",
        api_url("/feedback"),
        {"question": "Q", "answer": "A", "rating": 6},
        token=get_user_token(),
    )
    assert_status(response, 422)


def test_grievance_validation() -> None:
    response = request_json(
        "POST",
        api_url("/grievance"),
        {"complaint": "bad"},
        token=get_user_token(),
    )
    assert_status(response, 422)


def test_admin_analytics_usage() -> None:
    response = request_json("GET", api_url("/analytics/usage"), token=get_admin_token())
    assert_status(response, 200)
    assert_has_keys(response.body, ["total_users", "total_documents", "total_feedback_entries"])


def test_admin_analytics_failures() -> None:
    response = request_json("GET", api_url("/analytics/failures"), token=get_admin_token())
    assert_status(response, 200)
    assert_has_keys(response.body, ["failed_answers", "expert_queue_size", "total_grievances"])


def test_admin_documents_list() -> None:
    response = request_json("GET", api_url("/documents"), token=get_admin_token())
    assert_status(response, 200)
    assert_is_list(response.body)


def test_admin_grievance_queue() -> None:
    response = request_json("GET", api_url("/grievances"), token=get_admin_token())
    assert_status(response, 200)
    assert_is_list(response.body)


def test_admin_expert_queue() -> None:
    response = request_json("GET", api_url("/expert-queries"), token=get_admin_token())
    assert_status(response, 200)
    assert_is_list(response.body)


def test_feedback_submission() -> None:
    require_mutation_tests()
    response = request_json(
        "POST",
        api_url("/feedback"),
        {
            "question": "Software testing sample question",
            "answer": "Software testing sample answer",
            "rating": 5,
        },
        token=get_user_token(),
    )
    assert_status(response, 200)
    assert_has_keys(response.body, ["id", "question", "answer", "rating"])
    assert response.body["rating"] == 5


def test_grievance_submission_and_lookup() -> None:
    require_mutation_tests()
    grievance_id = create_test_grievance()
    response = request_json("GET", api_url(f"/grievance/{grievance_id}"), token=get_user_token())
    assert_status(response, 200)
    assert_has_keys(response.body, ["id", "complaint", "status", "comments"])
    assert response.body["id"] == grievance_id


def test_user_grievance_comment() -> None:
    require_mutation_tests()
    grievance_id = create_test_grievance()
    response = request_json(
        "POST",
        api_url(f"/grievance/{grievance_id}/comments"),
        {"message": "User comment added by software test case."},
        token=get_user_token(),
    )
    assert_status(response, 200)
    assert_has_keys(response.body, ["id", "grievance_id", "message", "comment_type"])
    assert response.body["grievance_id"] == grievance_id


def test_admin_updates_grievance_status() -> None:
    require_mutation_tests()
    grievance_id = create_test_grievance()
    response = request_json(
        "PATCH",
        api_url(f"/grievance/{grievance_id}"),
        {"status": "in_review"},
        token=get_admin_token(),
    )
    assert_status(response, 200)
    assert_has_keys(response.body, ["id", "status", "comments"])
    assert response.body["status"] == "in_review"


TESTS: list[tuple[str, Callable[[], None]]] = [
    ("Backend health check", test_backend_health),
    ("OpenAPI schema available", test_openapi_schema_available),
    ("Public chat validation", test_public_chat_validation),
    ("Protected chat sessions require login", test_protected_chat_sessions_require_login),
    ("Protected notifications require login", test_protected_notifications_require_login),
    ("Invalid login is rejected", test_invalid_login_is_rejected),
    ("User login returns token", test_user_login_returns_token),
    ("Admin login returns token", test_admin_login_returns_token),
    ("User chat sessions list", test_user_chat_sessions_list),
    ("User notifications list", test_user_notifications_list),
    ("User grievances list", test_user_grievances_list),
    ("User blocked from analytics", test_user_cannot_access_analytics),
    ("User blocked from documents admin API", test_user_cannot_access_document_admin_api),
    ("User blocked from expert queue", test_user_cannot_access_expert_queue),
    ("Logged-in chat validation", test_logged_in_chat_validation),
    ("Feedback validation", test_feedback_validation),
    ("Grievance validation", test_grievance_validation),
    ("Admin analytics usage", test_admin_analytics_usage),
    ("Admin analytics failures", test_admin_analytics_failures),
    ("Admin documents list", test_admin_documents_list),
    ("Admin grievance queue", test_admin_grievance_queue),
    ("Admin expert queue", test_admin_expert_queue),
    ("Feedback submission", test_feedback_submission),
    ("Grievance submission and lookup", test_grievance_submission_and_lookup),
    ("User grievance comment", test_user_grievance_comment),
    ("Admin updates grievance status", test_admin_updates_grievance_status),
]


def main() -> int:
    passed = 0
    skipped = 0
    failed = 0

    print(f"Running API tests against: {API_BASE_URL}")
    print("-" * 72)

    for index, (test_name, test_function) in enumerate(TESTS, start=1):
        try:
            test_function()
        except TestSkip as skip:
            skipped += 1
            print(f"SKIP  TC-{index:02d}  {test_name}: {skip}")
        except Exception as error:
            failed += 1
            print(f"FAIL  TC-{index:02d}  {test_name}: {error}")
        else:
            passed += 1
            print(f"PASS  TC-{index:02d}  {test_name}")

    print("-" * 72)
    print(f"Summary: {passed} passed, {skipped} skipped, {failed} failed")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
