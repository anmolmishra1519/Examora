from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import audit_logs, attempts, auth, courses, dashboard, exams, integrity, proctor, reports, results
from app.config import get_settings
from app.database import Base, engine
from app.models import models  # noqa: F401 - ensures models are registered on Base before create_all

settings = get_settings()

app = FastAPI(
    title="Examora API",
    description="Build. Conduct. Verify. — smart college examination platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Zero-config bootstrapping for local/demo use. For a real deployment,
    # generate and run Alembic migrations instead (see backend/alembic/).
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"product": "Examora", "tagline": "Build. Conduct. Verify.", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}


app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(exams.router)
app.include_router(exams.questions_router)
app.include_router(attempts.router)
app.include_router(proctor.router)
app.include_router(integrity.router)
app.include_router(results.router)
app.include_router(reports.router)
app.include_router(audit_logs.router)
app.include_router(dashboard.router)
