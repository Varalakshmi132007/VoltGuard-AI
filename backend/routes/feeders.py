from fastapi import APIRouter, HTTPException
from backend.database import get_db
from backend.services.energy_analysis import compute_feeder_discrepancy
from typing import List, Dict, Any

router = APIRouter(prefix="/api/feeders", tags=["Feeder Monitoring"])

@router.get("/")
def get_all_feeders():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT feeder_id FROM Feeders ORDER BY feeder_id ASC;")
        feeder_ids = [r["feeder_id"] for r in cursor.fetchall()]

        feeders_summary = []
        for fid in feeder_ids:
            res = compute_feeder_discrepancy(conn, fid)
            feeders_summary.append(res)

        return feeders_summary

@router.get("/{feeder_id}")
def get_feeder_details(feeder_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        res = compute_feeder_discrepancy(conn, feeder_id)
        if not res:
            raise HTTPException(status_code=404, detail="Feeder not found")

        # Connected transformers
        cursor.execute("""
            SELECT transformer_id, name, location, capacity_kva, status
            FROM Transformers
            WHERE feeder_id = ?
            ORDER BY transformer_id ASC;
        """, (feeder_id,))
        connected_transformers = [dict(r) for r in cursor.fetchall()]

        # Historical trend (daily breakdown)
        cursor.execute("""
            SELECT substr(fr.timestamp, 1, 10) as date_label,
                   ROUND(SUM(fr.input_energy_kwh), 2) as input_kwh,
                   ROUND(COALESCE((
                       SELECT SUM(tr.input_energy_kwh)
                       FROM Transformer_Readings tr
                       JOIN Transformers t ON tr.transformer_id = t.transformer_id
                       WHERE t.feeder_id = ? AND substr(tr.timestamp, 1, 10) = substr(fr.timestamp, 1, 10)
                   ), 0.0), 2) as accounted_kwh
            FROM Feeder_Readings fr
            WHERE fr.feeder_id = ?
            GROUP BY date_label
            ORDER BY date_label ASC;
        """, (feeder_id, feeder_id))
        
        history = []
        for row in cursor.fetchall():
            in_k = float(row["input_kwh"])
            acc_k = float(row["accounted_kwh"])
            gap = round(max(0.0, in_k - acc_k), 2)
            pct = round((gap / in_k * 100.0), 2) if in_k > 0 else 0.0
            history.append({
                "date": row["date_label"],
                "input_kwh": in_k,
                "accounted_kwh": acc_k,
                "discrepancy_kwh": gap,
                "discrepancy_pct": pct
            })

        return {
            "feeder_summary": res,
            "connected_transformers": connected_transformers,
            "daily_trend": history
        }
