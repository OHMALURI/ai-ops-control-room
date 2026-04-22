import json as json_module
import queue as queue_module
import threading

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

try:
    from database import get_db, SessionLocal
    from models import Service, Evaluation
    from services.evaluator import (
        run_evaluation, GOLDEN_DATASETS, DATASET_LABELS,
        request_stop, _reset_stop_flag, EvaluationStopped,
    )
except ImportError:
    from ..database import get_db, SessionLocal
    from ..models import Service, Evaluation
    from ..services.evaluator import (
        run_evaluation, GOLDEN_DATASETS, DATASET_LABELS,
        request_stop, _reset_stop_flag, EvaluationStopped,
    )

router = APIRouter(prefix="/evaluations", tags=["Evaluations"])


# ─────────────────────────────────────────────────────────────────────────────
# SSE STREAMING  — runs single_turn then multi_turn, streams all progress
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/run-stream/{service_id}")
def run_evaluation_stream(service_id: int):
    """
    SSE endpoint — streams progress events for both single-turn and multi-turn
    evaluations running sequentially.
    """
    progress_queue: queue_module.Queue = queue_module.Queue()

    def run_in_thread():
        db = SessionLocal()
        try:
            _reset_stop_flag(service_id)

            def on_progress(event):
                progress_queue.put(event)

            for dtype in ("single_turn", "multi_turn"):
                progress_queue.put({
                    "step": f"section_{dtype}",
                    "label": DATASET_LABELS[dtype],
                    "status": "section",
                    "section": dtype,
                })
                run_evaluation(service_id, db, dataset_type=dtype, on_progress=on_progress)

            progress_queue.put({"step": "complete", "label": "All evaluations complete", "status": "complete"})

        except EvaluationStopped:
            progress_queue.put({"step": "stopped", "label": "Evaluation stopped by user", "status": "stopped"})
        except Exception as e:
            progress_queue.put({"step": "error", "label": str(e), "status": "error"})
        finally:
            db.close()

    thread = threading.Thread(target=run_in_thread, daemon=True)
    thread.start()

    def event_stream():
        while True:
            try:
                event = progress_queue.get(timeout=600)
                yield f"data: {json_module.dumps(event)}\n\n"
                if event.get("status") in ("complete", "error", "stopped"):
                    break
            except queue_module.Empty:
                yield 'data: {"step":"timeout","label":"Evaluation timed out","status":"error"}\n\n'
                break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# STOP
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/stop/{service_id}")
def stop_evaluation(service_id: int):
    """Signal the running evaluation for this service to stop."""
    request_stop(service_id)
    return {"message": "Stop signal sent"}


# ─────────────────────────────────────────────────────────────────────────────
# STANDARD ROUTES
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/run/{service_id}")
def run_service_evaluation(
    service_id: int,
    dataset_type: str = Query(default="single_turn"),
    db: Session = Depends(get_db),
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return run_evaluation(service_id, db, dataset_type=dataset_type)


@router.post("/run-all/{service_id}")
def run_all_evaluations(service_id: int, db: Session = Depends(get_db)):
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
    return [{"key": k, "label": DATASET_LABELS[k]} for k in GOLDEN_DATASETS.keys()]


@router.get("/latest/{service_id}")
def get_latest_evaluation(
    service_id: int,
    dataset_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
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
    q = db.query(Evaluation).filter(Evaluation.service_id == service_id)
    if dataset_type:
        q = q.filter(Evaluation.dataset_type == dataset_type)
    return q.order_by(Evaluation.timestamp.desc()).all()
