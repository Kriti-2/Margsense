from datetime import datetime

from fastapi import APIRouter, Request

from app.config import get_settings
from app.data.loader import get_data_store
from app.middleware.rate_limit import limiter

router = APIRouter(tags=["Analytics"])


@router.get("/analytics")
@limiter.limit(lambda: get_settings().rate_limit_public)
def get_analytics(request: Request):
    store = get_data_store()
    cached = store.get_analytics()
    cached = {**cached, "generated_at": datetime.utcnow().isoformat()}
    return cached
