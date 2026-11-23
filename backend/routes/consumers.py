from fastapi import APIRouter, HTTPException, Query
from backend.database import get_db
from backend.schemas import ConsumerCreate, ConsumerUpdate, ConsumerResponse
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/api/consumers", tags=["Consumer Management"])

@router.get("/", response_model=List[ConsumerResponse])
def get_consumers(
    search: Optional[str] = None,
    category: Optional[str] = None,
    feeder_id: Optional[str] = None,
    transformer_id: Optional[str] = None
):
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = """
            SELECT c.*,
                   COALESCE((SELECT COUNT(*) FROM Theft_Alerts a WHERE a.consumer_id = c.consumer_id AND a.investigation_status != 'False Alarm'), 0) as suspicious_count,
                   COALESCE((SELECT ROUND(SUM(r.energy_kwh), 2) FROM Electricity_Readings r WHERE r.consumer_id = c.consumer_id), 0.0) as total_consumption_kwh,
                   COALESCE((SELECT r.energy_kwh FROM Electricity_Readings r WHERE r.consumer_id = c.consumer_id ORDER BY r.timestamp DESC LIMIT 1), 0.0) as latest_reading_kwh,
                   COALESCE((SELECT a.risk_level FROM Theft_Alerts a WHERE a.consumer_id = c.consumer_id ORDER BY a.risk_score DESC LIMIT 1), 'Low') as risk_level
            FROM Consumers c
            WHERE 1=1
        """
        params = []

        if search:
            query += " AND (c.consumer_id LIKE ? OR c.name LIKE ? OR c.meter_id LIKE ? OR c.location LIKE ?)"
            s = f"%{search}%"
            params.extend([s, s, s, s])

        if category:
            query += " AND c.category = ?"
            params.append(category)

        if feeder_id:
            query += " AND c.feeder_id = ?"
            params.append(feeder_id)

        if transformer_id:
            query += " AND c.transformer_id = ?"
            params.append(transformer_id)

        query += " ORDER BY c.consumer_id ASC"
        cursor.execute(query, params)
        rows = [dict(r) for r in cursor.fetchall()]
        return rows

@router.get("/{consumer_id}")
def get_consumer_detail(consumer_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Consumers WHERE consumer_id = ?", (consumer_id,))
        consumer = cursor.fetchone()
        if not consumer:
            raise HTTPException(status_code=404, detail="Consumer not found")
        
        consumer_dict = dict(consumer)

        # Recent readings
        cursor.execute("""
            SELECT r.id, r.timestamp, r.energy_kwh, r.voltage, r.current, r.power_factor,
                   a.expected_kwh, a.deviation_pct, a.anomaly_score, a.is_anomaly, a.detection_result, a.explanation
            FROM Electricity_Readings r
            LEFT JOIN Anomaly_Detections a ON r.id = a.reading_id
            WHERE r.consumer_id = ?
            ORDER BY r.timestamp DESC
            LIMIT 72;
        """, (consumer_id,))
        readings = [dict(r) for r in cursor.fetchall()]

        # Active Alerts
        cursor.execute("""
            SELECT * FROM Theft_Alerts
            WHERE consumer_id = ?
            ORDER BY timestamp DESC;
        """, (consumer_id,))
        alerts = [dict(r) for r in cursor.fetchall()]

        # Calculate consumer risk profile
        cursor.execute("""
            SELECT MAX(risk_score) as max_risk, COUNT(*) as alert_count
            FROM Theft_Alerts
            WHERE consumer_id = ?;
        """, (consumer_id,))
        risk_row = cursor.fetchone()
        max_risk = risk_row["max_risk"] or 15.0

        return {
            "consumer": consumer_dict,
            "readings_history": readings[::-1], # chronological
            "alerts": alerts,
            "max_risk_score": max_risk
        }

@router.post("/", response_model=ConsumerResponse)
def create_consumer(consumer: ConsumerCreate):
    with get_db() as conn:
        cursor = conn.cursor()

        # Check existing ID or Meter
        cursor.execute("SELECT consumer_id FROM Consumers WHERE consumer_id = ? OR meter_id = ?", (consumer.consumer_id, consumer.meter_id))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Consumer ID or Meter ID already exists")

        # Verify Feeder and Transformer exist
        cursor.execute("SELECT feeder_id FROM Feeders WHERE feeder_id = ?", (consumer.feeder_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Feeder ID '{consumer.feeder_id}' does not exist")

        cursor.execute("SELECT transformer_id FROM Transformers WHERE transformer_id = ?", (consumer.transformer_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Transformer ID '{consumer.transformer_id}' does not exist")

        reg_date = consumer.registration_date or datetime.now().strftime("%Y-%m-%d")
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            INSERT INTO Consumers (
                consumer_id, name, meter_id, category, location,
                connected_load_capacity, feeder_id, transformer_id, registration_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            consumer.consumer_id, consumer.name, consumer.meter_id, consumer.category,
            consumer.location, consumer.connected_load_capacity, consumer.feeder_id,
            consumer.transformer_id, reg_date, created_at
        ))
        conn.commit()

        return {
            **consumer.model_dump(),
            "registration_date": reg_date,
            "created_at": created_at,
            "suspicious_count": 0,
            "total_consumption_kwh": 0.0,
            "latest_reading_kwh": 0.0,
            "risk_level": "Low"
        }

@router.put("/{consumer_id}", response_model=dict)
def update_consumer(consumer_id: str, updates: ConsumerUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Consumers WHERE consumer_id = ?", (consumer_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Consumer not found")

        fields = []
        values = []
        for k, v in updates.model_dump(exclude_unset=True).items():
            if v is not None:
                fields.append(f"{k} = ?")
                values.append(v)

        if not fields:
            return {"message": "No updates specified"}

        values.append(consumer_id)
        cursor.execute(f"UPDATE Consumers SET {', '.join(fields)} WHERE consumer_id = ?", values)
        conn.commit()

        cursor.execute("SELECT * FROM Consumers WHERE consumer_id = ?", (consumer_id,))
        return dict(cursor.fetchone())

@router.delete("/{consumer_id}")
def delete_consumer(consumer_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT consumer_id FROM Consumers WHERE consumer_id = ?", (consumer_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Consumer not found")

        cursor.execute("DELETE FROM Consumers WHERE consumer_id = ?", (consumer_id,))
        conn.commit()
        return {"message": f"Consumer {consumer_id} and associated records successfully deleted"}
