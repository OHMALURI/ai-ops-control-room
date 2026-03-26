from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.evaluations import router as evaluations_router

from routes.services import router as services_router

from database import Base, engine, SessionLocal
from models import Service
from services.evaluator import run_evaluation
from apscheduler.schedulers.background import BackgroundScheduler

from routes.incidents import router as incidents_router
from routes.maintenance import router as maintenance_router

from routes.users import router as users_router
from routes.governance import router as governance_router

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
            run_evaluation(service, db)
    finally:
        db.close()

@app.on_event("startup")
def create_tables():
    """Create all database tables on server startup."""
    Base.metadata.create_all(bind=engine)
    
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