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
        run_evaluation, request_stop, _reset_stop_flag, EvaluationStopped,
    )
    from auth import SECRET_KEY, ALGORITHM
except ImportError:
    from ..database import get_db, SessionLocal
    from ..models import Service, Evaluation
    from ..services.evaluator import (
        run_evaluation, request_stop, _reset_stop_flag, EvaluationStopped,
    )
    from ..auth import SECRET_KEY, ALGORITHM

def _user_id_from_token(token: Optional[str]) -> Optional[int]:
    if not token:
        return None
    try:
        from jose import jwt, JWTError
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
        return int(uid) if uid else None
    except Exception:
        return None

router = APIRouter(prefix="/evaluations", tags=["Evaluations"])


# ─────────────────────────────────────────────────────────────────────────────
# SSE STREAMING  — streams progress events for the evaluation run
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/run-stream/{service_id}")
def run_evaluation_stream(service_id: int, token: Optional[str] = Query(default=None)):
    """SSE endpoint — streams progress events while the evaluation runs."""
    user_id = _user_id_from_token(token)
    progress_queue: queue_module.Queue = queue_module.Queue()

    def run_in_thread():
        db = SessionLocal()
        try:
            _reset_stop_flag(service_id)

            def on_progress(event):
                progress_queue.put(event)

            run_evaluation(service_id, db, on_progress=on_progress, user_id=user_id)
            progress_queue.put({"step": "complete", "label": "Evaluation complete", "status": "complete"})

        except EvaluationStopped:
            progress_queue.put({"step": "stopped", "label": "Evaluation stopped by user", "status": "stopped"})
        except Exception as e:
            progress_queue.put({"step": "error", "label": str(e), "status": "error"})
            try:
                from datetime import datetime as _dt
                try:
                    from models import AuditLog, Service as _Service
                except ImportError:
                    from ..models import AuditLog, Service as _Service
                svc = db.query(_Service).filter(_Service.id == service_id).first()
                svc_name = svc.name if svc else f"service/{service_id}"
                db.add(AuditLog(
                    user_id=user_id,
                    action="evaluation.error",
                    resource=f"services/{service_id}",
                    details=f"Service: {svc_name} | Error: {str(e)[:300]}",
                    timestamp=_dt.utcnow(),
                ))
                db.commit()
            except Exception:
                pass
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
                yield 'data: {"step":"timeout","label":"Evaluation timed out (600s)","status":"error"}\n\n'
                try:
                    from datetime import datetime as _dt
                    _tdb = SessionLocal()
                    try:
                        from models import AuditLog, Service as _Service
                    except ImportError:
                        from ..models import AuditLog, Service as _Service
                    svc = _tdb.query(_Service).filter(_Service.id == service_id).first()
                    svc_name = svc.name if svc else f"service/{service_id}"
                    _tdb.add(AuditLog(
                        user_id=user_id,
                        action="evaluation.timeout",
                        resource=f"services/{service_id}",
                        details=f"Service: {svc_name} | Evaluation timed out after 600s",
                        timestamp=_dt.utcnow(),
                    ))
                    _tdb.commit()
                except Exception:
                    pass
                finally:
                    try: _tdb.close()
                    except Exception: pass
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
def run_service_evaluation(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return run_evaluation(service_id, db)


@router.get("/latest/{service_id}")
def get_latest_evaluation(service_id: int, db: Session = Depends(get_db)):
    evaluation = (
        db.query(Evaluation)
        .filter(Evaluation.service_id == service_id)
        .order_by(Evaluation.timestamp.desc())
        .first()
    )
    if not evaluation:
        raise HTTPException(status_code=404, detail="No evaluations found for this service")
    return evaluation


@router.get("/{service_id}")
def get_service_evaluations(service_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Evaluation)
        .filter(Evaluation.service_id == service_id)
        .order_by(Evaluation.timestamp.desc())
        .all()
    )
