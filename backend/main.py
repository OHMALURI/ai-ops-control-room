from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.evaluations import router as evaluations_router

from routes.services import router as services_router

from database import Base, engine, SessionLocal
from models import Service
from services.evaluator import run_evaluation
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
            run_evaluation(service.id, db, dataset_type="single_turn")
    finally:
        db.close()

@app.on_event("startup")
def create_tables():
    """Create all database tables and run idempotent migrations on startup."""
    Base.metadata.create_all(bind=engine)

    db_path = os.path.join(os.path.dirname(__file__), "app.db")
    try:
        conn = sqlite3.connect(db_path)

        # ── evaluations table migrations ──────────────────────────────────────
        eval_cols = {r[1] for r in conn.execute("PRAGMA table_info(evaluations)").fetchall()}

        eval_missing = {
            "dataset_type":        "TEXT",
            "drift_type":          "TEXT",
            "drift_reason":        "TEXT",
            "drift_triggered":     "INTEGER DEFAULT 0",
            "accuracy":            "REAL",
            "relevance_score":     "REAL",
            "factuality_score":    "REAL",
            "toxicity_score":      "REAL",
            "instruction_following": "REAL",
        }
        for col, col_type in eval_missing.items():
            if col not in eval_cols:
                conn.execute(f"ALTER TABLE evaluations ADD COLUMN {col} {col_type}")
                conn.commit()
                print(f"[migration] Added column: evaluations.{col}")

        # ── services table migrations ─────────────────────────────────────────
        svc_cols = {r[1] for r in conn.execute("PRAGMA table_info(services)").fetchall()}
        if "base_url" not in svc_cols:
            conn.execute("ALTER TABLE services ADD COLUMN base_url TEXT")
            conn.commit()
            print("[migration] Added column: services.base_url")

        # ── drop legacy tables ────────────────────────────────────────────────
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        if "evidently_reports" in tables:
            conn.execute("DROP TABLE evidently_reports")
            conn.commit()
            print("[migration] Dropped table: evidently_reports")

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