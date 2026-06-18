import pytest
from app.services.weather_service import get_weather_service, _classify_weather, WeatherData

def test_weather_endpoint(auth_client):
    response = auth_client.get("/weather")
    assert response.status_code == 200
    data = response.json()
    assert "condition" in data
    assert "multiplier" in data
    assert "severity_boost" in data
    assert "is_rain" in data

def test_classify_weather():
    # Thunderstorm (id 200)
    thunderstorm_escalation = _classify_weather(200)
    assert thunderstorm_escalation["multiplier"] == 1.7
    assert thunderstorm_escalation["severity_boost"] == 25
    assert thunderstorm_escalation["alert_level"] == "CRITICAL"

    # Light Rain (id 500)
    rain_escalation = _classify_weather(500)
    assert rain_escalation["multiplier"] == 1.3
    assert rain_escalation["severity_boost"] == 10
    assert rain_escalation["alert_level"] == "MEDIUM"

    # Heavy Rain (id 502)
    heavy_rain_escalation = _classify_weather(502)
    assert heavy_rain_escalation["multiplier"] == 1.5
    assert heavy_rain_escalation["severity_boost"] == 18
    assert heavy_rain_escalation["alert_level"] == "HIGH"

    # Clear (id 800)
    clear_escalation = _classify_weather(800)
    assert clear_escalation["multiplier"] == 1.0
    assert clear_escalation["severity_boost"] == 0
    assert clear_escalation["alert_level"] == "NONE"

def test_weather_service_fallback():
    service = get_weather_service()
    weather = service._neutral_weather()
    assert isinstance(weather, WeatherData)
    assert weather.multiplier == 1.0
    assert weather.severity_boost == 0.0
    assert weather.alert_level == "NONE"
    assert weather.source == "fallback"
