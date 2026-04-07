from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.evaluations import router as evaluations_router

from routes.services import router as services_router

from database import Base, engine, SessionLocal
from models import Service
from services.evaluator import run_evaluation, GOLDEN_DATASETS
from apscheduler.schedulers.background import BackgroundScheduler
import sqlite3, os

from routes.incidents import router as incidents_router
from routes.maintenance import router as maintenance_router

from routes.users import router as users_router
from routes.governance import router as governance_router
from routes.drift_judge import router as drift_judge_router

app = FastAPI(title="AI Operations Control Room")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



def run_all_evaluations():
    db = SessionLocal()
    try:
        services = db.query(Service).all()
        for service in services:
            run_evaluation(service.id, db, dataset_type="alpacaeval")
    finally:
        db.close()

@app.on_event("startup")
def create_tables():
    """Create all database tables and run idempotent migrations on startup."""
    Base.metadata.create_all(bind=engine)

    # Idempotent migration: add dataset_type column if missing
    db_path = os.path.join(os.path.dirname(__file__), "app.db")
    try:
        conn = sqlite3.connect(db_path)
        cols = {r[1] for r in conn.execute("PRAGMA table_info(evaluations)").fetchall()}
        if "dataset_type" not in cols:
            conn.execute("ALTER TABLE evaluations ADD COLUMN dataset_type TEXT")
            conn.commit()
            print("[migration] Added column: dataset_type")
        conn.close()
    except Exception as e:
        print(f"[migration] Warning: {e}")

    scheduler = BackgroundScheduler()
    scheduler.add_job(run_all_evaluations, trigger="interval", minutes=60)
    scheduler.start()


@app.get("/")
def health_check():
    return {"status": "running"}

app.include_router(services_router, prefix="/api")
app.include_router(evaluations_router, prefix="/api")

app.include_router(incidents_router, prefix="/api")
app.include_router(maintenance_router, prefix="/api")

app.include_router(users_router, prefix="/api")
app.include_router(governance_router, prefix="/api")
app.include_router(drift_judge_router, prefix="/api")