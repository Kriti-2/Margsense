from fastapi import APIRouter, Request

from app.config import get_settings
from app.middleware.rate_limit import limiter
from app.services.weather_service import get_weather_service

router = APIRouter(tags=["Weather"])


@router.get("/weather")
@limiter.limit(lambda: get_settings().rate_limit_public)
def get_weather(request: Request):
    """Get current Bengaluru weather conditions and risk escalation factors."""
    weather = get_weather_service().get_weather()
    return weather.to_dict()
