from datetime import datetime

from fastapi import APIRouter

from app.data.loader import get_data_store

router = APIRouter(tags=["Recidivism"])


@router.get("/recidivism")
def get_recidivism():
    store = get_data_store()
    cached = store.get_recidivism()
    return {**cached, "generated_at": datetime.utcnow().isoformat()}
