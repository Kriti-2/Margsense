from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth import require_officer_auth
from app.config import get_settings
from app.middleware.rate_limit import limiter
from app.tasks.heavy_jobs import get_task_result, prophet_forecast_task, warm_caches_task

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def _require_celery():
    if not get_settings().celery_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Celery is disabled. Set CELERY_ENABLED=true and run a worker.",
        )


@router.post("/warm-caches")
@limiter.limit(lambda: get_settings().rate_limit_officer)
def queue_warm_caches(request: Request, _user=Depends(require_officer_auth)):
    _require_celery()
    task = warm_caches_task.delay(use_prophet=False)
    return {"task_id": task.id, "status": "queued", "job": "warm_caches"}


@router.post("/prophet-forecast")
@limiter.limit(lambda: get_settings().rate_limit_officer)
def queue_prophet_forecast(request: Request, _user=Depends(require_officer_auth)):
    _require_celery()
    task = prophet_forecast_task.delay()
    return {"task_id": task.id, "status": "queued", "job": "prophet_forecast"}


@router.get("/{task_id}")
@limiter.limit(lambda: get_settings().rate_limit_officer)
def job_status(request: Request, task_id: str, _user=Depends(require_officer_auth)):
    _require_celery()
    return get_task_result(task_id)
