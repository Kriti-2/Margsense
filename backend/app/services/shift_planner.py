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

            assignments.append(
                ShiftAssignment(
                    zone=zone,
                    officers_recommended=officers,
                    priority=priority,
                    shift=shift,
                    expected_violations=pred.predicted_violations,
                    economic_impact_inr=round(economic_impact, 2),
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

    classifier = ViolationSeverityClassifier()
    severity_results: list[ViolationSeverityResult] = []
    if not df.empty:
        sample = df.head(100)
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
                    )
                )
            )

    planner = ShiftPlannerService()
    assignments = planner.plan(predictions, economic_losses, severity_results)
    total_officers = sum(a.officers_recommended for a in assignments)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "assignments": [a.model_dump() for a in assignments],
        "summary": {
            "total_officers_recommended": total_officers,
            "critical_zones": sum(1 for a in assignments if a.priority == "CRITICAL"),
            "high_priority_zones": sum(1 for a in assignments if a.priority == "HIGH"),
            "total_expected_violations": sum(a.expected_violations for a in assignments),
            "total_economic_impact_inr": round(sum(a.economic_impact_inr for a in assignments), 2),
        },
    }
