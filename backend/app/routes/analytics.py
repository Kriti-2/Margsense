from datetime import datetime

from fastapi import APIRouter

from app.data.loader import get_data_store

router = APIRouter(tags=["Analytics"])


@router.get("/analytics")
def get_analytics():
    store = get_data_store()
    cached = store.get_analytics()
    # Refresh timestamp so clients see a recent response
    cached = {**cached, "generated_at": datetime.utcnow().isoformat()}
    return cached
