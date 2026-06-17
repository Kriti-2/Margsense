from datetime import datetime

from fastapi import APIRouter, Depends

from app.auth.dependencies import require_user
from app.data.loader import get_data_store
from app.models.user import User
from app.services.realtime_engine import get_realtime_engine
from app.services.traffic_service import TrafficService
from app.utilities.constants import BENGALURU_ZONES

router = APIRouter(prefix="/public", tags=["Public"])


@router.get("/congestion-preview")
def congestion_preview(user: User = Depends(require_user)):
    """
    User-facing congestion intelligence — plan trips and avoid parking hotspots.
    Requires user or officer login.
    """
    store = get_data_store()
    engine = get_realtime_engine()
    recent = engine.recent_window(hours=24)
    traffic = TrafficService()
    speeds = traffic.get_zone_speeds(recent)

    zones = []
    for name, meta in BENGALURU_ZONES.items():
        speed = speeds.get(name, meta["baseline_speed_kmh"] * 0.7)
        baseline = meta["baseline_speed_kmh"]
        drop_pct = round(max(0, (baseline - speed) / baseline * 100), 1)
        zone_recent = len(recent[recent["zone"] == name]) if not recent.empty else 0

        if drop_pct >= 60 or zone_recent >= 15:
            advisory = "AVOID"
            color = "red"
        elif drop_pct >= 35 or zone_recent >= 8:
            advisory = "CAUTION"
            color = "orange"
        else:
            advisory = "CLEAR"
            color = "green"

        zones.append(
            {
                "zone": name,
                "latitude": meta["center"][0],
                "longitude": meta["center"][1],
                "current_speed_kmh": speed,
                "baseline_speed_kmh": baseline,
                "speed_drop_pct": drop_pct,
                "parking_violations_24h": zone_recent,
                "advisory": advisory,
                "color": color,
                "tip": _tip_for_zone(name, advisory, drop_pct),
            }
        )

    zones.sort(key=lambda z: z["speed_drop_pct"], reverse=True)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "greeting": f"Hello {user.full_name}",
        "summary": {
            "avoid_zones": sum(1 for z in zones if z["advisory"] == "AVOID"),
            "caution_zones": sum(1 for z in zones if z["advisory"] == "CAUTION"),
            "clear_zones": sum(1 for z in zones if z["advisory"] == "CLEAR"),
        },
        "zones": zones,
        "traffic_source": traffic.last_meta.get("source"),
    }


def _tip_for_zone(zone: str, advisory: str, drop_pct: float) -> str:
    if advisory == "AVOID":
        return f"High congestion ({drop_pct:.0f}% speed drop) in {zone}. Take alternate route or metro."
    if advisory == "CAUTION":
        return f"Moderate delays expected in {zone}. Allow 15+ extra minutes."
    return f"{zone} is flowing well. Good time to travel."
