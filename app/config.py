from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    app_name: str = "MPOnline FAQ Chatbot"
    environment: str = "development"
    api_prefix: str = "/api"
    debug: bool = True

    database_url: str = Field(
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/faq_chatbot"
    )
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60 * 24
    jwt_algorithm: str = "HS256"
    bootstrap_admin_username: str | None = None
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None
    otp_expiry_minutes: int = 10

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "MPOnline FAQ Chatbot"
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False

    llm_provider: str = "openai"
    openai_api_key: str | None = None
    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    gemini_api_key: str | None = None
    gemini_chat_model: str = "gemini-1.5-flash"
    gemini_embedding_model: str = "models/embedding-001"

    vector_store_path: str = str(BASE_DIR / "app" / "data" / "faiss.index")
    vector_metadata_path: str = str(BASE_DIR / "app" / "data" / "faiss_metadata.json")
    upload_dir: str = str(BASE_DIR / "app" / "uploads")

    top_k_chunks: int = 4
    min_similarity_score: float = 0.45
    max_chunk_words: int = 180
    chunk_overlap_words: int = 40
    max_context_characters: int = 8000

    tesseract_cmd: str | None = None
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.vector_store_path).parent.mkdir(parents=True, exist_ok=True)
    return settings
