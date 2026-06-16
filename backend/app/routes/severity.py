from datetime import datetime

from fastapi import APIRouter, Query

from app.data.loader import get_data_store

router = APIRouter(tags=["Severity"])


@router.get("/severity-queue")
def get_severity_queue(limit: int = Query(default=30, le=200)):
    store = get_data_store()
    cached = store.get_severity_queue(limit=limit)
    return {**cached, "generated_at": datetime.utcnow().isoformat()}
