from fastapi import APIRouter

from app.data.loader import get_data_store

router = APIRouter(tags=["Predictions"])


@router.get("/predictions")
def get_predictions():
    store = get_data_store()
    result = store.get_forecast()
    return result.model_dump(mode="json")
