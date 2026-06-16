from datetime import datetime

import pandas as pd

from app.models.congestion_fingerprint import CongestionFingerprintEngine


def build_heatmap_response(df: pd.DataFrame, limit: int = 2000) -> dict:
    if len(df) > limit:
        sample = df.dropna(subset=["latitude", "longitude"]).sample(n=limit, random_state=42)
    else:
        sample = df.dropna(subset=["latitude", "longitude"])

    features = []
    for _, row in sample.iterrows():
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row["longitude"]), float(row["latitude"])],
                },
                "properties": {
                    "id": str(row.get("id", "")),
                    "zone": row.get("zone", "Unknown"),
                    "vehicle_type": str(row.get("vehicle_type", "UNKNOWN")),
                    "violation_types": row.get("violation_types", []),
                    "timestamp": str(row.get("created_datetime", "")),
                },
            }
        )

    engine = CongestionFingerprintEngine()
    congestion = engine.compute_all_corridors()
    zone_intensity = {
        fp.corridor: {
            "congestion_score": fp.congestion_score,
            "speed_drop_pct": fp.speed_drop_pct,
            "level": fp.congestion_level.value,
        }
        for fp in congestion
    }

    return {
        "type": "FeatureCollection",
        "generated_at": datetime.utcnow().isoformat(),
        "features": features,
        "zone_intensity": zone_intensity,
        "total_points": len(features),
    }
