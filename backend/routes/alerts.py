from fastapi import APIRouter, HTTPException, Query
from backend.database import get_db
from backend.schemas import AlertUpdateStatus, TheftAlertResponse
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/api/alerts", tags=["Alerts and Investigations"])

@router.get("/", response_model=List[TheftAlertResponse])
def get_alerts(
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    consumer_id: Optional[str] = None,
    transformer_id: Optional[str] = None
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM Theft_Alerts WHERE 1=1"
        params = []

        if status:
            query += " AND investigation_status = ?"
            params.append(status)

        if risk_level:
            query += " AND risk_level = ?"
            params.append(risk_level)

        if consumer_id:
            query += " AND consumer_id = ?"
            params.append(consumer_id)

        if transformer_id:
            query += " AND transformer_id = ?"
            params.append(transformer_id)

        query += " ORDER BY risk_score DESC, timestamp DESC"
        cursor.execute(query, params)
        return [dict(r) for r in cursor.fetchall()]

@router.get("/{alert_id}")
def get_alert_detail(alert_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Theft_Alerts WHERE id = ?", (alert_id,))
        alert = cursor.fetchone()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        # Get consumer details
        cursor.execute("SELECT * FROM Consumers WHERE consumer_id = ?", (alert["consumer_id"],))
        consumer = cursor.fetchone()

        # Get audit trail from Investigation_Records
        cursor.execute("""
            SELECT * FROM Investigation_Records
            WHERE alert_id = ?
            ORDER BY timestamp DESC;
        """, (alert_id,))
        history = [dict(r) for r in cursor.fetchall()]

        return {
            "alert": dict(alert),
            "consumer": dict(consumer) if consumer else None,
            "investigation_history": history
        }

@router.patch("/{alert_id}/status")
def update_alert_status(alert_id: int, payload: AlertUpdateStatus):
    valid_statuses = ["Pending Investigation", "Under Investigation", "Resolved", "False Alarm"]
    if payload.investigation_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Choose from: {', '.join(valid_statuses)}"
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Theft_Alerts WHERE id = ?", (alert_id,))
        alert = cursor.fetchone()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")

        prev_status = alert["investigation_status"]
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Update Alert
        cursor.execute("""
            UPDATE Theft_Alerts
            SET investigation_status = ?, notes = ?, updated_at = ?
            WHERE id = ?;
        """, (payload.investigation_status, payload.remarks, now_str, alert_id))

        # Add to Investigation_Records audit log
        cursor.execute("""
            INSERT INTO Investigation_Records (
                alert_id, updated_by, previous_status, new_status, remarks, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?);
        """, (
            alert_id, payload.updated_by or "Operator", prev_status, payload.investigation_status, payload.remarks, now_str
        ))
        conn.commit()

        cursor.execute("SELECT * FROM Theft_Alerts WHERE id = ?", (alert_id,))
        return {
            "message": f"Alert status successfully updated to '{payload.investigation_status}'",
            "alert": dict(cursor.fetchone())
        }
