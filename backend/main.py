from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.services import router as services_router

from database import Base, engine

app = FastAPI(title="AI Operations Control Room")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.on_event("startup")
def create_tables():
    """Create all database tables on server startup."""
    Base.metadata.create_all(bind=engine)


@app.get("/")
def health_check():
    return {"status": "running"}

app.include_router(services_router, prefix="/api")