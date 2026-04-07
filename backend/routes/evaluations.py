from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

try:
    from database import get_db
    from models import Service, Evaluation
    from services.evaluator import run_evaluation, GOLDEN_DATASETS, DATASET_LABELS
except ImportError:
    from ..database import get_db
    from ..models import Service, Evaluation
    from ..services.evaluator import run_evaluation, GOLDEN_DATASETS, DATASET_LABELS

router = APIRouter(
    prefix="/evaluations",
    tags=["Evaluations"]
)


@router.post("/run/{service_id}")
def run_service_evaluation(
    service_id: int,
    dataset_type: str = Query(default="alpacaeval"),
    db: Session = Depends(get_db),
):
    """Run evaluation using the specified golden dataset type."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    evaluation = run_evaluation(service_id, db, dataset_type=dataset_type)
    return evaluation


@router.post("/run-all/{service_id}")
def run_all_evaluations(service_id: int, db: Session = Depends(get_db)):
    """Run evaluations for ALL 6 golden dataset types and return all results."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    results = []
    for dtype in GOLDEN_DATASETS.keys():
        try:
            ev = run_evaluation(service_id, db, dataset_type=dtype)
            results.append({"dataset_type": dtype, "id": ev.id, "quality_score": ev.quality_score})
        except Exception as e:
            results.append({"dataset_type": dtype, "error": str(e)})
    return results


@router.get("/dataset-types")
def list_dataset_types():
    """Return available golden dataset types with human-readable labels."""
    return [
        {"key": k, "label": DATASET_LABELS[k]}
        for k in GOLDEN_DATASETS.keys()
    ]


@router.get("/latest/{service_id}")
def get_latest_evaluation(
    service_id: int,
    dataset_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Return the most recent evaluation, optionally filtered by dataset_type."""
    q = db.query(Evaluation).filter(Evaluation.service_id == service_id)
    if dataset_type:
        q = q.filter(Evaluation.dataset_type == dataset_type)
    evaluation = q.order_by(Evaluation.timestamp.desc()).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="No evaluations found for this service")
    return evaluation


@router.get("/{service_id}")
def get_service_evaluations(
    service_id: int,
    dataset_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Return ALL evaluations, optionally filtered by dataset_type."""
    q = db.query(Evaluation).filter(Evaluation.service_id == service_id)
    if dataset_type:
        q = q.filter(Evaluation.dataset_type == dataset_type)
    return q.order_by(Evaluation.timestamp.desc()).all()
