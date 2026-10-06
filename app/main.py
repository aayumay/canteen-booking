import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sentry_sdk
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sqlalchemy import text

from pathlib import Path
from fastapi.staticfiles import StaticFiles

from app.api.v1 import admin, announcements, auth, media, student, vendor
from app.core.config import get_settings
from app.crud.order_status_transition import seed_transitions
from app.db.session import SessionLocal, engine
from app.exceptions import add_exception_handlers, setup_logging

settings = get_settings()

# Ensure uploads directory exists and mount as static
uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(parents=True, exist_ok=True)

# Initialize structured logging
setup_logging()
logger = logging.getLogger("canteen.main")

# Sentry initialization
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=1.0,
        send_default_pii=False,
    )
    logger.info("Sentry initialized for environment: %s", settings.environment)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.models import Base
    from app.db.auto_migrate import sync_sqlite_columns
    Base.metadata.create_all(bind=engine)
    sync_sqlite_columns(engine)
    db = SessionLocal()
    try:
        seed_transitions(db)
    finally:
        db.close()
    yield


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.default_rate_limit],
)

app = FastAPI(title="Canteen Booking System", lifespan=lifespan)
app.state.limiter = limiter

# Rate limiting middleware
app.add_middleware(SlowAPIMiddleware)

# Custom exception handlers
add_exception_handlers(app)

# CORS Middleware
origins = settings.cors_origin_list
if "*" in origins:
    origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:8080",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(auth.router, prefix="/api/v1")
app.include_router(student.router, prefix="/api/v1")
app.include_router(vendor.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(announcements.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")


@app.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "detail": "Database connection failed"},
        )
