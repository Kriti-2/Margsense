from datetime import datetime

from fastapi import APIRouter, Request

from app.config import get_settings
from app.data.loader import get_data_store
from app.middleware.rate_limit import limiter

router = APIRouter(tags=["Corridors"])


@router.get("/corridors")
@limiter.limit(lambda: get_settings().rate_limit_public)
def get_corridors(request: Request):
    store = get_data_store()
    cached = store.get_corridors()
    return {**cached, "generated_at": datetime.utcnow().isoformat()}
