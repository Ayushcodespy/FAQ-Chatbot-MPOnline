from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import get_settings


settings = get_settings()

engine_options = {"pool_pre_ping": True}
if settings.database_url.startswith("postgresql"):
    # Prevent a stalled remote database connection from delaying web-service startup
    # until the hosting platform's port scan times out.
    engine_options["connect_args"] = {"connect_timeout": 10}

engine = create_engine(settings.database_url, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
