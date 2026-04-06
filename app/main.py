from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.routes.analytics import router as analytics_router
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.documents import router as documents_router
from app.routes.expert import router as expert_router
from app.routes.feedback import router as feedback_router
from app.routes.grievance import router as grievance_router
from app.routes.notifications import router as notifications_router
from app.services.auth_service import ensure_bootstrap_admin


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_bootstrap_admin(
            db,
            settings.bootstrap_admin_username,
            settings.bootstrap_admin_email,
            settings.bootstrap_admin_password,
        )
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(chat_router, prefix=settings.api_prefix)
app.include_router(documents_router, prefix=settings.api_prefix)
app.include_router(expert_router, prefix=settings.api_prefix)
app.include_router(grievance_router, prefix=settings.api_prefix)
app.include_router(notifications_router, prefix=settings.api_prefix)
app.include_router(feedback_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)


@app.get("/")
def healthcheck() -> dict:
    return {
        "name": settings.app_name,
        "status": "ok",
        "docs": "/docs",
    }
