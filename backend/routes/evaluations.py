from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

# Try absolute imports (assuming backend is in PYTHONPATH), fallback to relative imports
try:
    from database import get_db
    from models import Service, Evaluation
    from services.evaluator import run_evaluation
except ImportError:
    from ..database import get_db
    from ..models import Service, Evaluation
    from ..services.evaluator import run_evaluation

router = APIRouter(
    prefix="/evaluations",
    tags=["Evaluations"]
)

@router.post("/run/{service_id}")
def run_service_evaluation(service_id: int, db: Session = Depends(get_db)):
    """Fetch service by id or 404, call run_evaluation(service, db), return the evaluation result."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    evaluation = run_evaluation(service, db)
    return evaluation

@router.get("/latest/{service_id}")
def get_latest_evaluation(service_id: int, db: Session = Depends(get_db)):
    """Return the single most recent evaluation row for that service ordered by timestamp desc, or 404."""
    evaluation = db.query(Evaluation).filter(Evaluation.service_id == service_id).order_by(Evaluation.timestamp.desc()).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="No evaluations found for this service")
    
    return evaluation

@router.get("/{service_id}")
def get_service_evaluations(service_id: int, db: Session = Depends(get_db)):
    """Return ALL evaluation rows for that service ordered by timestamp desc."""
    evaluations = db.query(Evaluation).filter(Evaluation.service_id == service_id).order_by(Evaluation.timestamp.desc()).all()
    return evaluations
