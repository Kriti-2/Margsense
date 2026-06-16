from datetime import datetime

from fastapi import APIRouter, Query

from app.data.loader import get_data_store

router = APIRouter(tags=["Heatmap"])


@router.get("/heatmap")
def get_heatmap(limit: int = Query(default=1500, le=5000)):
    store = get_data_store()
    return store.get_heatmap(limit=limit)
