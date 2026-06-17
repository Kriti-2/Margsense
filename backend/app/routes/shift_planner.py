from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request

from app.auth import require_officer_auth
from app.config import get_settings
from app.data.loader import get_data_store
from app.middleware.rate_limit import limiter

router = APIRouter(tags=["Shift Planner"])


@router.get("/shift-planner")
@limiter.limit(lambda: get_settings().rate_limit_officer)
def get_shift_planner(request: Request, _user=Depends(require_officer_auth)):
    store = get_data_store()
    cached = store.get_shift_planner()
    return {**cached, "generated_at": datetime.utcnow().isoformat()}
