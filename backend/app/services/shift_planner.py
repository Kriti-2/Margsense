from datetime import datetime

import pandas as pd

from app.models.congestion_fingerprint import CongestionFingerprintEngine
from app.models.economic import ZoneCongestionMetrics
from app.models.forecast_schemas import ForecastResponse
from app.models.responses import ShiftAssignment
from app.models.economic import EconomicLossResult
from app.models.severity_classifier import ViolationSeverityClassifier
from app.models.severity_schemas import SeverityLevel, ViolationSeverityInput, ViolationSeverityResult
from app.services.economic_calculator import EconomicCalculator
from app.utilities.constants import BENGALURU_ZONES


class ShiftPlannerService:
    """Recommend officer deployment based on risk, severity, and economic impact."""

    def plan(
        self,
        predictions: ForecastResponse,
        economic_losses: list[EconomicLossResult],
        severity_queue: list[ViolationSeverityResult],
    ) -> list[ShiftAssignment]:
        loss_by_zone = {e.zone: e.daily_loss for e in economic_losses}
        critical_by_zone: dict[str, int] = {}
        for item in severity_queue:
            if item.severity == SeverityLevel.CRITICAL:
                critical_by_zone[item.zone] = critical_by_zone.get(item.zone, 0) + 1

        assignments: list[ShiftAssignment] = []
        for pred in predictions.top_risk_zones:
            zone = pred.zone
            economic_impact = loss_by_zone.get(zone, pred.predicted_violations * 850)
            critical_count = critical_by_zone.get(zone, 0)

            officers = 1
            if pred.risk_score >= 80 or critical_count >= 3:
                officers = 4
                priority = "CRITICAL"
            elif pred.risk_score >= 60 or critical_count >= 1:
                officers = 3
                priority = "HIGH"
            elif pred.risk_score >= 40:
                officers = 2
                priority = "MEDIUM"
            else:
                priority = "LOW"

            shift = "Morning" if pred.peak_hour < 12 else "Evening"

            officer_cost = officers * 1500.0
            reduction_pct = min(0.60, officers * 0.15)
            gross_savings = economic_impact * reduction_pct
            estimated_savings = max(0.0, gross_savings - officer_cost)

            assignments.append(
                ShiftAssignment(
                    zone=zone,
                    officers_recommended=officers,
                    priority=priority,
                    shift=shift,
                    expected_violations=pred.predicted_violations,
                    economic_impact_inr=round(economic_impact, 2),
                    estimated_savings_inr=round(estimated_savings, 2),
                    officer_cost_inr=round(officer_cost, 2),
                )
            )

        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        assignments.sort(key=lambda a: priority_order[a.priority])
        return assignments


def build_shift_planner_response(df: pd.DataFrame, predictions: ForecastResponse) -> dict:
    engine = CongestionFingerprintEngine()
    congestion = engine.compute_all_corridors()
    econ = EconomicCalculator()
    zone_metrics = [
        ZoneCongestionMetrics(
            zone=fp.corridor,
            vehicles_affected=max(int(fp.speed_drop_pct * 12), 15),
            delay_minutes=round(fp.speed_drop_pct * 0.4, 1),
        )
        for fp in congestion
    ]
    economic_losses = econ.calculate_all_zones(zone_metrics)

    # Fetch weather severity boost for classification
    weather_severity_boost = 0.0
    try:
        from app.services.weather_service import get_weather_service

        weather_severity_boost = get_weather_service().get_weather().severity_boost
    except Exception:
        pass

    classifier = ViolationSeverityClassifier()
    severity_results: list[ViolationSeverityResult] = []
    if not df.empty:
        if "created_datetime" in df.columns:
            df = df.copy()
            df["created_datetime"] = pd.to_datetime(df["created_datetime"], utc=True, errors="coerce")
            # Sort descending to inspect the latest violations
            sample = df.sort_values("created_datetime", ascending=False).head(100)
        else:
            sample = df.tail(100)
        for _, row in sample.iterrows():
            ts = row.get("created_datetime")
            hour = pd.to_datetime(ts).hour if pd.notna(ts) else 12
            zone = row.get("zone", "Unknown")
            severity_results.append(
                classifier.classify(
                    ViolationSeverityInput(
                        violation_id=str(row.get("id", "")),
                        zone=zone,
                        vehicle_type=str(row.get("vehicle_type", "CAR")),
                        lane_width_m=BENGALURU_ZONES.get(zone, {}).get("lane_width_m", 7.0),
                        hour=int(hour),
                        near_intersection=bool(row.get("near_intersection", False)),
                        violation_types=row.get("violation_types", []),
                    ),
                    weather_severity_boost=weather_severity_boost,
                )
            )

    planner = ShiftPlannerService()
    assignments = planner.plan(predictions, economic_losses, severity_results)
    total_officers = sum(a.officers_recommended for a in assignments)

    total_estimated_savings = round(sum(a.estimated_savings_inr for a in assignments), 2)
    total_officer_cost = round(sum(a.officer_cost_inr for a in assignments), 2)
    total_economic_impact = round(sum(a.economic_impact_inr for a in assignments), 2)
    roi_percentage = round(
        (total_estimated_savings / total_officer_cost * 100) if total_officer_cost > 0 else 0, 1
    )
    roi_ratio = round(
        total_estimated_savings / total_officer_cost if total_officer_cost > 0 else 0, 2
    )

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "assignments": [a.model_dump() for a in assignments],
        "summary": {
            "total_officers_recommended": total_officers,
            "critical_zones": sum(1 for a in assignments if a.priority == "CRITICAL"),
            "high_priority_zones": sum(1 for a in assignments if a.priority == "HIGH"),
            "total_expected_violations": sum(a.expected_violations for a in assignments),
            "total_economic_impact_inr": total_economic_impact,
            "total_estimated_savings_inr": total_estimated_savings,
            "total_officer_cost_inr": total_officer_cost,
            "roi_percentage": roi_percentage,
            "roi_ratio": roi_ratio,
        },
    }
