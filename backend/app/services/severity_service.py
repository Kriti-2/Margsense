from datetime import datetime

import pandas as pd

from app.models.severity_classifier import ViolationSeverityClassifier
from app.models.severity_schemas import ViolationSeverityInput
from app.utilities.constants import BENGALURU_ZONES


def build_severity_response(df: pd.DataFrame, limit: int = 50) -> dict:
    if df.empty:
        return {"generated_at": datetime.utcnow().isoformat(), "queue": [], "summary": {}, "total": 0}

    if "created_datetime" in df.columns and pd.api.types.is_datetime64_any_dtype(df["created_datetime"]):
        recent = df.sort_values("created_datetime", ascending=False).head(limit)
    else:
        recent = df.tail(limit)

    classifier = ViolationSeverityClassifier()
    queue = []

    for _, row in recent.iterrows():
        ts = row.get("created_datetime")
        hour = ts.hour if pd.notna(ts) else 12
        zone = row.get("zone", "Unknown")
        lane_width = BENGALURU_ZONES.get(zone, {}).get("lane_width_m", 7.0)

        result = classifier.classify(
            ViolationSeverityInput(
                violation_id=str(row.get("id", "")),
                zone=zone,
                vehicle_type=str(row.get("vehicle_type", "CAR")),
                lane_width_m=lane_width,
                hour=int(hour),
                near_intersection=bool(row.get("near_intersection", False)),
                latitude=float(row["latitude"]) if pd.notna(row.get("latitude")) else None,
                longitude=float(row["longitude"]) if pd.notna(row.get("longitude")) else None,
                violation_types=row.get("violation_types", []),
            )
        )
        queue.append(result.model_dump())

    severity_order = {"CRITICAL": 0, "MEDIUM": 1, "LOW": 2}
    queue.sort(key=lambda x: (severity_order.get(x["severity"], 3), -x["severity_score"]))

    summary = {
        "CRITICAL": sum(1 for q in queue if q["severity"] == "CRITICAL"),
        "MEDIUM": sum(1 for q in queue if q["severity"] == "MEDIUM"),
        "LOW": sum(1 for q in queue if q["severity"] == "LOW"),
    }

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "queue": queue,
        "summary": summary,
        "total": len(queue),
    }
