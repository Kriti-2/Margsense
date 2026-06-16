from datetime import datetime

from fastapi import APIRouter

from app.data.loader import get_data_store

router = APIRouter(tags=["Shift Planner"])


@router.get("/shift-planner")
def get_shift_planner():
    store = get_data_store()
    cached = store.get_shift_planner()
    return {**cached, "generated_at": datetime.utcnow().isoformat()}
