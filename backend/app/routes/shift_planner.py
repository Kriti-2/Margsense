from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from app.auth import require_officer_auth
from app.config import get_settings
from app.data.loader import get_data_store
from app.middleware.rate_limit import limiter
from app.services.realtime_engine import get_realtime_engine
from app.services.realtime_hub import get_realtime_hub

router = APIRouter(tags=["Shift Planner"])


class DispatchRequest(BaseModel):
    officer_id: str
    target_lat: float
    target_lng: float
    zone: str
    incident_id: str | None = None
    vehicle_type: str | None = "CAR"


class AutoDispatchToggleRequest(BaseModel):
    enabled: bool


@router.get("/shift-planner")
@limiter.limit(lambda: get_settings().rate_limit_officer)
def get_shift_planner(request: Request, _user=Depends(require_officer_auth)):
    store = get_data_store()
    cached = store.get_shift_planner()
    return {**cached, "generated_at": datetime.utcnow().isoformat()}


@router.get("/shift-planner/officers")
@limiter.limit(lambda: get_settings().rate_limit_officer)
def get_shift_officers(request: Request, _user=Depends(require_officer_auth)):
    engine = get_realtime_engine()
    return {
        "officers": engine._officers,
        "dispatch_logs": engine._dispatch_logs[-50:],
        "auto_dispatch": engine._auto_dispatch,
    }


@router.post("/shift-planner/dispatch")
@limiter.limit(lambda: get_settings().rate_limit_officer)
async def dispatch_officer(
    request: Request,
    payload: DispatchRequest,
    _user=Depends(require_officer_auth),
):
    engine = get_realtime_engine()
    hub = get_realtime_hub()

    # Find officer
    officer = None
    for o in engine._officers:
        if o["id"] == payload.officer_id:
            officer = o
            break

    if not officer:
        return {"success": False, "error": f"Officer with ID {payload.officer_id} not found."}

    from datetime import timezone
    ts_str = datetime.now().strftime("%H:%M:%S")
    officer["status"] = "DISPATCHED"
    officer["target_lat"] = payload.target_lat
    officer["target_lng"] = payload.target_lng
    officer["assigned_incident_id"] = payload.incident_id
    officer["zone"] = payload.zone
    officer["incident_type"] = payload.vehicle_type or "CAR"

    msg = f"[{ts_str}] DISPATCH: {officer['name']} dispatched to {payload.zone} for incident {payload.incident_id or 'Patrol Request'}."
    engine._dispatch_logs.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": msg,
    })

    # Broadcast updated state immediately
    tick = engine.tick()
    await hub.broadcast(tick)

    return {"success": True, "officer": officer}


@router.post("/shift-planner/toggle-auto-dispatch")
@limiter.limit(lambda: get_settings().rate_limit_officer)
async def toggle_auto_dispatch(
    request: Request,
    payload: AutoDispatchToggleRequest,
    _user=Depends(require_officer_auth),
):
    engine = get_realtime_engine()
    hub = get_realtime_hub()

    engine._auto_dispatch = payload.enabled
    from datetime import timezone
    ts_str = datetime.now().strftime("%H:%M:%S")
    status_label = "ENABLED" if payload.enabled else "DISABLED"
    engine._dispatch_logs.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"[{ts_str}] SYSTEM: Auto-dispatch system is now {status_label}.",
    })

    # Broadcast updated state immediately
    tick = engine.tick()
    await hub.broadcast(tick)

    return {"success": True, "auto_dispatch": engine._auto_dispatch}
