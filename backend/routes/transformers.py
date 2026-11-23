from fastapi import APIRouter, HTTPException
from backend.database import get_db
from backend.services.energy_analysis import compute_transformer_discrepancy
from backend.services.risk_scoring import calculate_transformer_risk_score
from backend.services.explanation import generate_transformer_explanation
from typing import List, Dict, Any

router = APIRouter(prefix="/api/transformers", tags=["Transformer Monitoring"])

@router.get("/")
def get_all_transformers():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT transformer_id FROM Transformers ORDER BY transformer_id ASC;")
        tr_ids = [r["transformer_id"] for r in cursor.fetchall()]

        transformers_summary = []
        for tid in tr_ids:
            res = compute_transformer_discrepancy(conn, tid)
            # High risk consumer count
            cursor.execute("""
                SELECT COUNT(DISTINCT consumer_id) as cnt
                FROM Theft_Alerts
                WHERE transformer_id = ? AND risk_level IN ('High', 'Critical') AND investigation_status != 'False Alarm'
            """, (tid,))
            high_risk_c = cursor.fetchone()["cnt"]
            res["high_risk_consumers"] = high_risk_c

            # Priority score
            p_score, p_lvl = calculate_transformer_risk_score(
                res["discrepancy_pct"], res["suspicious_consumers"], res["total_consumers"]
            )
            res["priority_score"] = p_score
            res["priority_level"] = p_lvl

            # Engineering explanation
            res["explanation"] = generate_transformer_explanation(
                tid, res["discrepancy_kwh"], res["discrepancy_pct"], res["suspicious_consumers"], res["total_consumers"]
            )

            transformers_summary.append(res)

        # Sort by priority score descending
        transformers_summary.sort(key=lambda x: x["priority_score"], reverse=True)
        return transformers_summary

@router.get("/{transformer_id}")
def get_transformer_details(transformer_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        res = compute_transformer_discrepancy(conn, transformer_id)
        if not res:
            raise HTTPException(status_code=404, detail="Transformer not found")

        # Connected consumers list
        cursor.execute("""
            SELECT c.*,
                   COALESCE((SELECT COUNT(*) FROM Theft_Alerts a WHERE a.consumer_id = c.consumer_id AND a.investigation_status != 'False Alarm'), 0) as alert_count,
                   COALESCE((SELECT a.risk_level FROM Theft_Alerts a WHERE a.consumer_id = c.consumer_id ORDER BY a.risk_score DESC LIMIT 1), 'Low') as risk_level,
                   COALESCE((SELECT ROUND(SUM(r.energy_kwh), 2) FROM Electricity_Readings r WHERE r.consumer_id = c.consumer_id), 0.0) as total_kwh
            FROM Consumers c
            WHERE c.transformer_id = ?
            ORDER BY c.consumer_id ASC;
        """, (transformer_id,))
        connected_consumers = [dict(r) for r in cursor.fetchall()]

        # Daily historical performance
        cursor.execute("""
            SELECT substr(tr.timestamp, 1, 10) as date_label,
                   ROUND(SUM(tr.input_energy_kwh), 2) as input_kwh,
                   ROUND(COALESCE((
                       SELECT SUM(r.energy_kwh)
                       FROM Electricity_Readings r
                       JOIN Consumers c ON r.consumer_id = c.consumer_id
                       WHERE c.transformer_id = ? AND substr(r.timestamp, 1, 10) = substr(tr.timestamp, 1, 10)
                   ), 0.0), 2) as consumer_kwh
            FROM Transformer_Readings tr
            WHERE tr.transformer_id = ?
            GROUP BY date_label
            ORDER BY date_label ASC;
        """, (transformer_id, transformer_id))

        history = []
        for row in cursor.fetchall():
            in_k = float(row["input_kwh"])
            out_k = float(row["consumer_kwh"])
            gap = round(max(0.0, in_k - out_k), 2)
            pct = round((gap / in_k * 100.0), 2) if in_k > 0 else 0.0
            history.append({
                "date": row["date_label"],
                "input_kwh": in_k,
                "consumer_kwh": out_k,
                "discrepancy_kwh": gap,
                "discrepancy_pct": pct
            })

        return {
            "transformer_summary": res,
            "connected_consumers": connected_consumers,
            "daily_trend": history
        }
