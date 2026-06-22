import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.config import get_settings
from app.data.loader import get_data_store
from app.models.congestion_fingerprint import CongestionFingerprintEngine, CongestionInput
from app.services.analytics_service import build_analytics_response
from app.services.corridors_service import build_corridors_response
from app.services.live_buffer import get_live_buffer
from app.services.severity_service import build_severity_response
from app.services.traffic_service import TrafficService
from app.utilities.time_context import filter_recent, get_reference_time, violations_last_hour_count

logger = logging.getLogger(__name__)

_traffic_service = TrafficService()


def get_traffic_service() -> TrafficService:
    return _traffic_service


class RealtimeEngine:
    """Orchestrates live data refresh: replay, traffic, corridor status."""

    def __init__(self):
        self._settings = get_settings()
        self._last_tick: dict[str, Any] = {}
        self._auto_dispatch = False
        self._dispatch_logs = [
            {"timestamp": datetime.now(timezone.utc).isoformat(), "message": "Command center initialized. Telemetry channels online."}
        ]
        self._officers = [
            {
                "id": "OFF-01",
                "name": "Officer Ramesh Kumar",
                "status": "IDLE",
                "zone": "Koramangala",
                "lat": 12.9352,
                "lng": 77.6245,
                "target_lat": None,
                "target_lng": None,
                "assigned_incident_id": None,
                "incident_type": None,
                "ticks_on_scene": 0
            },
            {
                "id": "OFF-02",
                "name": "Officer Priya Singh",
                "status": "PATROLLING",
                "zone": "Indiranagar",
                "lat": 12.9784,
                "lng": 77.6408,
                "target_lat": None,
                "target_lng": None,
                "assigned_incident_id": None,
                "incident_type": None,
                "ticks_on_scene": 0
            },
            {
                "id": "OFF-03",
                "name": "Officer S. Ananth",
                "status": "IDLE",
                "zone": "MG Road",
                "lat": 12.9750,
                "lng": 77.6063,
                "target_lat": None,
                "target_lng": None,
                "assigned_incident_id": None,
                "incident_type": None,
                "ticks_on_scene": 0
            },
            {
                "id": "OFF-04",
                "name": "Officer Sandeep Patel",
                "status": "PATROLLING",
                "zone": "HSR Layout",
                "lat": 12.9116,
                "lng": 77.6473,
                "target_lat": None,
                "target_lng": None,
                "assigned_incident_id": None,
                "incident_type": None,
                "ticks_on_scene": 0
            },
            {
                "id": "OFF-05",
                "name": "Officer K. Preethi",
                "status": "IDLE",
                "zone": "Whitefield",
                "lat": 12.9698,
                "lng": 77.7500,
                "target_lat": None,
                "target_lng": None,
                "assigned_incident_id": None,
                "incident_type": None,
                "ticks_on_scene": 0
            }
        ]

    def _simulate_officers(self):
        import math
        buffer = get_live_buffer()
        ts_str = datetime.now().strftime("%H:%M:%S")
        step = 0.0015

        for officer in self._officers:
            status = officer["status"]
            if status == "DISPATCHED" and officer["target_lat"] is not None and officer["target_lng"] is not None:
                d_lat = officer["target_lat"] - officer["lat"]
                d_lng = officer["target_lng"] - officer["lng"]
                dist = math.sqrt(d_lat**2 + d_lng**2)
                
                if dist < 0.0012:
                    officer["lat"] = officer["target_lat"]
                    officer["lng"] = officer["target_lng"]
                    officer["status"] = "ON_SCENE"
                    officer["ticks_on_scene"] = 2
                    self._dispatch_logs.append({
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "message": f"[{ts_str}] TELEMETRY: {officer['name']} arrived at scene in {officer['zone']}."
                    })
                else:
                    ratio = step / dist if dist > step else 1.0
                    officer["lat"] += d_lat * ratio
                    officer["lng"] += d_lng * ratio
            
            elif status == "ON_SCENE":
                officer["ticks_on_scene"] -= 1
                if officer["ticks_on_scene"] <= 0:
                    incident_id = officer["assigned_incident_id"]
                    if incident_id:
                        resolved = buffer.resolve(incident_id)
                        msg = f"[{ts_str}] SYSTEM: Violation {incident_id} cleared by {officer['name']}." if resolved else f"[{ts_str}] SYSTEM: Violation {incident_id} cleared (no longer in queue)."
                        self._dispatch_logs.append({
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "message": msg
                        })
                    else:
                        self._dispatch_logs.append({
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "message": f"[{ts_str}] SYSTEM: Patrol target in {officer['zone']} cleared by {officer['name']}."
                        })
                    
                    officer["status"] = "PATROLLING"
                    officer["target_lat"] = None
                    officer["target_lng"] = None
                    officer["assigned_incident_id"] = None
                    officer["incident_type"] = None
                    
            elif status == "PATROLLING":
                from app.utilities.constants import BENGALURU_ZONES
                import random
                zone_info = BENGALURU_ZONES.get(officer["zone"])
                if zone_info:
                    center = zone_info["center"]
                    target_lat = center[0] + random.uniform(-0.005, 0.005)
                    target_lng = center[1] + random.uniform(-0.005, 0.005)
                    
                    d_lat = target_lat - officer["lat"]
                    d_lng = target_lng - officer["lng"]
                    dist = math.sqrt(d_lat**2 + d_lng**2)
                    if dist > 0.0001:
                        ratio = (step * 0.5) / dist
                        officer["lat"] += d_lat * ratio
                        officer["lng"] += d_lng * ratio

    def _check_auto_dispatch(self, recent_violations):
        if not self._auto_dispatch:
            return
        
        assigned_incidents = {
            o["assigned_incident_id"] for o in self._officers if o["assigned_incident_id"]
        }
        ts_str = datetime.now().strftime("%H:%M:%S")
        
        for _, row in recent_violations.iterrows():
            v_id = str(row.get("id"))
            if v_id in assigned_incidents:
                continue
                
            v_lat = row.get("latitude")
            v_lng = row.get("longitude")
            v_zone = row.get("zone", "Unknown")
            v_vehicle = row.get("vehicle_type", "CAR")
            
            if pd.isna(v_lat) or pd.isna(v_lng):
                continue
                
            best_officer = None
            min_dist = float("inf")
            
            for officer in self._officers:
                if officer["status"] not in ("IDLE", "PATROLLING"):
                    continue
                
                import math
                lat1, lon1, lat2, lon2 = officer["lat"], officer["lng"], v_lat, v_lng
                R = 6371000
                phi1 = math.radians(lat1)
                phi2 = math.radians(lat2)
                dphi = math.radians(lat2 - lat1)
                dlambda = math.radians(lon2 - lon1)
                a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
                dist = 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))
                
                if dist < min_dist:
                    min_dist = dist
                    best_officer = officer
            
            if best_officer:
                best_officer["status"] = "DISPATCHED"
                best_officer["target_lat"] = float(v_lat)
                best_officer["target_lng"] = float(v_lng)
                best_officer["assigned_incident_id"] = v_id
                best_officer["zone"] = v_zone
                best_officer["incident_type"] = v_vehicle
                
                self._dispatch_logs.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": f"[{ts_str}] AUTO-DISPATCH: Assigned {best_officer['name']} to resolve {v_vehicle} violation {v_id} in {v_zone} ({min_dist:.0f}m away)."
                })
                assigned_incidents.add(v_id)

    def get_fallback_tick(self) -> dict[str, Any]:
        ts = datetime.now(timezone.utc)
        return {
            "type": "live_tick_fallback",
            "timestamp": ts.isoformat(),
            "live_mode": self._settings.live_mode,
            "data_sources": {
                "violations": "bengaluru_police_dataset (loading...)",
                "traffic": {"source": "fallback", "updated_at": None, "zones": 0},
                "replay": {"buffer_size": 0},
            },
            "reference_time": ts.isoformat(),
            "kpis": {
                "violations_last_hour": 0,
                "violations_last_24h": 0,
                "live_buffer_size": 0,
            },
            "zone_intensity": {},
            "congestion_fingerprints": [],
            "corridors": {"corridors": [], "generated_at": ts.isoformat()},
            "analytics": {},
            "severity_summary": {},
            "severity_queue": [],
            "new_violations": [],
            "weather": {
                "condition": "Clear",
                "description": "clear sky",
                "temperature_c": 28.0,
                "humidity_pct": 60,
                "wind_speed_kmh": 10.0,
                "multiplier": 1.0,
                "severity_boost": 0.0,
                "alert_level": "NONE",
            }
        }

    def get_last_tick(self) -> dict[str, Any]:
        if not self._last_tick:
            if get_data_store()._df is None:
                return self.get_fallback_tick()
            return self.tick()
        return self._last_tick


    def combined_dataframe(self) -> pd.DataFrame:
        store = get_data_store()
        base = store.load()
        live = get_live_buffer().to_dataframe()
        if live.empty:
            return base
        if "violation_types" not in live.columns and "violation_type" in live.columns:
            live["violation_types"] = live["violation_type"]
        return pd.concat([base, live], ignore_index=True)

    def recent_window(self, hours: int = 24) -> pd.DataFrame:
        df = self.combined_dataframe()
        use_wall = self._settings.live_mode
        ref = get_reference_time(df, use_wall_clock=use_wall)
        historical = filter_recent(df, hours=hours, reference=ref)
        live_recent = get_live_buffer().recent_dataframe(hours=hours)
        if live_recent.empty:
            return historical
        return pd.concat([historical, live_recent], ignore_index=True).drop_duplicates(
            subset=["id"], keep="last"
        )

    def tick(self, manual_violation: dict | None = None) -> dict[str, Any]:
        """Run one live update cycle: replay violations, refresh traffic, rebuild live snapshots."""
        settings = get_settings()
        store = get_data_store()
        buffer = get_live_buffer()

        new_violations = []
        if settings.live_replay_enabled:
            new_violations = buffer.replay_tick(count=settings.live_replay_batch_size)

        if manual_violation:
            new_violations.append(manual_violation)

        recent = self.recent_window(hours=24)
        
        # Simulate officer patrol/response movements
        self._simulate_officers()
        
        # Run auto dispatch logic if active
        self._check_auto_dispatch(recent)

        speeds = _traffic_service.get_zone_speeds(recent)

        engine = CongestionFingerprintEngine()
        ts = datetime.now(timezone.utc)
        congestion = []
        zone_intensity = {}
        for zone, speed in speeds.items():
            fp = engine.compute(
                CongestionInput(corridor=zone, timestamp=ts, traffic_speed_kmh=speed)
            )
            congestion.append(fp.model_dump(mode="json"))
            zone_intensity[zone] = {
                "congestion_score": fp.congestion_score,
                "speed_drop_pct": fp.speed_drop_pct,
                "level": fp.congestion_level.value,
                "current_speed_kmh": fp.current_speed_kmh,
            }

        corridors = build_corridors_response(recent, recent_only=False)
        severity = build_severity_response(recent, limit=30)
        ref = get_reference_time(store.load(), use_wall_clock=settings.live_mode)

        analytics = build_analytics_response(
            store.load(),
            zone_speeds=speeds,
            recent_df=recent,
            reference=ref,
            live=True,
            traffic_meta=_traffic_service.last_meta,
        )

        payload = {
            "type": "live_tick",
            "timestamp": ts.isoformat(),
            "live_mode": settings.live_mode,
            "data_sources": {
                "violations": "bengaluru_police_dataset",
                "traffic": _traffic_service.last_meta,
                "replay": buffer.stats(),
            },
            "reference_time": ref.isoformat(),
            "kpis": {
                "violations_last_hour": violations_last_hour_count(recent, ref),
                "violations_last_24h": len(recent),
                "live_buffer_size": buffer.stats()["buffer_size"],
            },
            "zone_intensity": zone_intensity,
            "congestion_fingerprints": congestion,
            "corridors": corridors,
            "analytics": analytics,
            "severity_summary": severity.get("summary", {}),
            "severity_queue": severity.get("queue", [])[:8],
            "new_violations": [
                {
                    "id": v.get("id"),
                    "zone": v.get("zone"),
                    "vehicle_type": v.get("vehicle_type"),
                    "latitude": v.get("latitude"),
                    "longitude": v.get("longitude"),
                }
                for v in new_violations
            ],
            "officers": self._officers,
            "dispatch_logs": self._dispatch_logs[-50:],
            "auto_dispatch": self._auto_dispatch,
        }

        # Attach weather data to live tick
        try:
            from app.services.weather_service import get_weather_service

            payload["weather"] = get_weather_service().get_weather().to_dict()
        except Exception:
            payload["weather"] = None

        self._last_tick = payload
        store.refresh_live_caches(
            recent,
            zone_intensity,
            corridors,
            severity,
            zone_speeds=speeds,
            traffic_meta=_traffic_service.last_meta,
            reference=ref,
        )
        return payload

    def get_status(self) -> dict[str, Any]:
        store = get_data_store()
        df = store.load()
        settings = get_settings()
        ref = get_reference_time(df, use_wall_clock=settings.live_mode)
        return {
            "live_mode": settings.live_mode,
            "live_replay_enabled": settings.live_replay_enabled,
            "refresh_interval_seconds": settings.live_refresh_seconds,
            "reference_time": ref.isoformat(),
            "violations_loaded": len(df),
            "traffic": _traffic_service.last_meta,
            "buffer": get_live_buffer().stats(),
            "last_tick": self._last_tick.get("timestamp"),
            "data_sources": {
                "violations": "Flipkart Gridlock — Bengaluru Police (anonymized)",
                "traffic_api": _traffic_service.last_meta.get("source"),
                "ingest_endpoint": "/ingest/violation",
                "websocket": "/live/ws",
            },
        }


_engine: RealtimeEngine | None = None


def get_realtime_engine() -> RealtimeEngine:
    global _engine
    if _engine is None:
        _engine = RealtimeEngine()
    return _engine
