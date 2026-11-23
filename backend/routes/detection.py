from fastapi import APIRouter, Query
from backend.database import get_db
from backend.machine_learning.anomaly_detection import IsolationForestAnomalyDetector
from backend.services.risk_scoring import calculate_consumer_risk_score
from typing import List, Optional

router = APIRouter(prefix="/api/detection", tags=["AI Anomaly Detection"])

@router.post("/run-anomaly-detection")
def run_anomaly_detection(contamination: float = 0.08):
    """
    Executes consumer-specific normal consumption learning and Isolation Forest
    anomaly detection on all stored readings in SQLite.
    """
    with get_db() as conn:
        detector = IsolationForestAnomalyDetector(contamination=contamination)
        result = detector.train_and_evaluate(conn)
        return result

@router.get("/detections")
def get_detections(
    is_anomaly_only: bool = True,
    limit: int = 100,
    consumer_id: Optional[str] = None
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT a.*, c.name, c.category, c.feeder_id, c.transformer_id
            FROM Anomaly_Detections a
            JOIN Consumers c ON a.consumer_id = c.consumer_id
            WHERE 1=1
        """
        params = []
        if is_anomaly_only:
            query += " AND a.is_anomaly = 1"
        if consumer_id:
            query += " AND a.consumer_id = ?"
            params.append(consumer_id)

        query += " ORDER BY a.anomaly_score DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        return [dict(r) for r in cursor.fetchall()]

@router.get("/inspection-priorities")
def get_inspection_priorities():
    """
    Ranks consumers and transformers by risk priority (0 to 100).
    Uses transparent weighted scoring incorporating:
    - Isolation Forest Anomaly Score (35%)
    - Deviation Percentage (25%)
    - Recurrence Frequency (20%)
    - Transformer Discrepancy Context (20%)
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Query consumers with recent anomaly activity
        cursor.execute("""
            SELECT c.consumer_id, c.name, c.category, c.location, c.connected_load_capacity,
                   c.feeder_id, c.transformer_id,
                   COUNT(a.id) as anomaly_occurrences,
                   MAX(a.anomaly_score) as peak_anomaly_score,
                   AVG(a.anomaly_score) as avg_anomaly_score,
                   MAX(ABS(a.deviation_pct)) as max_deviation,
                   MAX(a.timestamp) as latest_abnormal_timestamp,
                   (SELECT a2.detection_result FROM Anomaly_Detections a2 WHERE a2.consumer_id = c.consumer_id AND a2.is_anomaly = 1 ORDER BY a2.anomaly_score DESC LIMIT 1) as primary_suspicion,
                   (SELECT a2.actual_kwh FROM Anomaly_Detections a2 WHERE a2.consumer_id = c.consumer_id AND a2.is_anomaly = 1 ORDER BY a2.anomaly_score DESC LIMIT 1) as actual_kwh,
                   (SELECT a2.expected_kwh FROM Anomaly_Detections a2 WHERE a2.consumer_id = c.consumer_id AND a2.is_anomaly = 1 ORDER BY a2.anomaly_score DESC LIMIT 1) as expected_kwh
            FROM Consumers c
            JOIN Anomaly_Detections a ON c.consumer_id = a.consumer_id
            WHERE a.is_anomaly = 1
            GROUP BY c.consumer_id
        """)
        consumer_rows = cursor.fetchall()

        # Fetch transformer discrepancies for context
        cursor.execute("""
            SELECT t.transformer_id,
                   ROUND(COALESCE(SUM(tr.input_energy_kwh), 0.0), 2) as tr_in,
                   (SELECT COALESCE(SUM(r.energy_kwh), 0.0)
                    FROM Electricity_Readings r
                    JOIN Consumers c ON r.consumer_id = c.consumer_id
                    WHERE c.transformer_id = t.transformer_id) as tr_cons
            FROM Transformers t
            LEFT JOIN Transformer_Readings tr ON t.transformer_id = tr.transformer_id
            GROUP BY t.transformer_id;
        """)
        tr_disc_map = {}
        for tr_r in cursor.fetchall():
            in_k = float(tr_r["tr_in"])
            cons_k = float(tr_r["tr_cons"])
            gap = max(0.0, in_k - cons_k)
            pct = (gap / in_k * 100.0) if in_k > 0 else 0.0
            tr_disc_map[tr_r["transformer_id"]] = pct

        prioritized_consumers = []
        for cr in consumer_rows:
            cid = cr["consumer_id"]
            tr_id = cr["transformer_id"]
            tr_disc = tr_disc_map.get(tr_id, 3.5)

            peak_score = float(cr["peak_anomaly_score"]) if cr["peak_anomaly_score"] else 0.5
            max_dev = float(cr["max_deviation"]) if cr["max_deviation"] else 0.0
            occ = int(cr["anomaly_occurrences"])

            risk_score, risk_lvl, breakdown = calculate_consumer_risk_score(
                anomaly_score=peak_score,
                deviation_pct=max_dev,
                repeated_abnormal_count=occ,
                transformer_discrepancy_pct=tr_disc
            )

            prioritized_consumers.append({
                "consumer_id": cid,
                "name": cr["name"],
                "category": cr["category"],
                "location": cr["location"],
                "connected_load_capacity": cr["connected_load_capacity"],
                "feeder_id": cr["feeder_id"],
                "transformer_id": tr_id,
                "transformer_discrepancy_pct": round(tr_disc, 1),
                "peak_anomaly_score": round(peak_score, 4),
                "max_deviation_pct": round(max_dev, 1),
                "anomaly_occurrences": occ,
                "actual_kwh": cr["actual_kwh"],
                "expected_kwh": cr["expected_kwh"],
                "primary_suspicion": cr["primary_suspicion"] or "Historical Pattern Deviation",
                "risk_score": risk_score,
                "risk_level": risk_lvl,
                "score_breakdown": breakdown,
                "latest_timestamp": cr["latest_abnormal_timestamp"]
            })

        # Sort consumers by risk score descending
        prioritized_consumers.sort(key=lambda x: x["risk_score"], reverse=True)

        return {
            "total_flagged_consumers": len(prioritized_consumers),
            "critical_count": sum(1 for c in prioritized_consumers if c["risk_level"] == "Critical"),
            "high_count": sum(1 for c in prioritized_consumers if c["risk_level"] == "High"),
            "medium_count": sum(1 for c in prioritized_consumers if c["risk_level"] == "Medium"),
            "low_count": sum(1 for c in prioritized_consumers if c["risk_level"] == "Low"),
            "prioritized_consumers": prioritized_consumers,
            "scoring_methodology": "Transparent 4-Factor Weighted Ranking: 35% Anomaly Score + 25% Deviation Magnitude + 20% Recurrence Frequency + 20% Transformer Context."
        }
