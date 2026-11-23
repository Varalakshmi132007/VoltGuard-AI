from fastapi import APIRouter
from backend.database import get_db
from backend.schemas import SettingUpdate
from backend.services.sample_generator import seed_sample_database

router = APIRouter(prefix="/api/settings", tags=["System Settings"])

@router.get("/")
def get_all_settings():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT key, value, description FROM System_Settings;")
        rows = [dict(r) for r in cursor.fetchall()]
        return {r["key"]: {"value": r["value"], "description": r["description"]} for r in rows}

@router.post("/update")
def update_setting(payload: SettingUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO System_Settings (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """, (payload.key, payload.value))
        conn.commit()

        cursor.execute("SELECT key, value, description FROM System_Settings WHERE key = ?;", (payload.key,))
        return dict(cursor.fetchone())

@router.post("/reset-sample-data")
def reset_sample_data():
    """
    Clears all database tables and re-seeds with realistic power grid sample data.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        tables = [
            "Investigation_Records", "Theft_Alerts", "Anomaly_Detections",
            "Electricity_Readings", "Transformer_Readings", "Feeder_Readings",
            "Consumers", "Transformers", "Feeders", "Model_Performance", "Uploaded_Datasets"
        ]
        for tbl in tables:
            cursor.execute(f"DELETE FROM {tbl};")
        conn.commit()

        seed_sample_database(conn)
        return {"status": "success", "message": "Database successfully reset and re-seeded with realistic sample power grid data."}
