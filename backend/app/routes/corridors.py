from datetime import datetime

from fastapi import APIRouter

from app.data.loader import get_data_store

router = APIRouter(tags=["Corridors"])


@router.get("/corridors")
def get_corridors():
    store = get_data_store()
    cached = store.get_corridors()
    return {**cached, "generated_at": datetime.utcnow().isoformat()}
