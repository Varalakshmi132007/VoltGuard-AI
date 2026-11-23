import io
import csv
import sqlite3
from typing import List, Dict, Any, Tuple

def generate_report_data(conn: sqlite3.Connection, report_type: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Retrieves report data and headers based on report_type.
    """
    cursor = conn.cursor()

    if report_type == "consumer_consumption":
        cursor.execute("""
            SELECT c.consumer_id, c.name, c.category, c.connected_load_capacity, c.feeder_id, c.transformer_id,
                   COUNT(r.id) as total_readings,
                   ROUND(SUM(r.energy_kwh), 2) as total_kwh,
                   ROUND(AVG(r.energy_kwh), 2) as avg_hourly_kwh,
                   ROUND(MAX(r.energy_kwh), 2) as peak_kwh
            FROM Consumers c
            LEFT JOIN Electricity_Readings r ON c.consumer_id = r.consumer_id
            GROUP BY c.consumer_id
            ORDER BY total_kwh DESC
        """)
        rows = [dict(row) for row in cursor.fetchall()]
        headers = ["consumer_id", "name", "category", "connected_load_capacity", "feeder_id", "transformer_id", "total_readings", "total_kwh", "avg_hourly_kwh", "peak_kwh"]
        return rows, headers

    elif report_type == "daily_consumption":
        cursor.execute("""
            SELECT substr(timestamp, 1, 10) as date,
                   COUNT(id) as total_readings,
                   ROUND(SUM(energy_kwh), 2) as total_kwh,
                   ROUND(AVG(energy_kwh), 2) as avg_kwh,
                   ROUND(MAX(energy_kwh), 2) as max_kwh
            FROM Electricity_Readings
            GROUP BY date
            ORDER BY date DESC
        """)
        rows = [dict(row) for row in cursor.fetchall()]
        headers = ["date", "total_readings", "total_kwh", "avg_kwh", "max_kwh"]
        return rows, headers

    elif report_type == "weekly_consumption":
        cursor.execute("""
            SELECT strftime('%Y-W%W', timestamp) as week,
                   COUNT(id) as total_readings,
                   ROUND(SUM(energy_kwh), 2) as total_kwh,
                   ROUND(AVG(energy_kwh), 2) as avg_kwh
            FROM Electricity_Readings
            GROUP BY week
            ORDER BY week DESC
        """)
        rows = [dict(row) for row in cursor.fetchall()]
        headers = ["week", "total_readings", "total_kwh", "avg_kwh"]
        return rows, headers

    elif report_type == "monthly_consumption":
        cursor.execute("""
            SELECT substr(timestamp, 1, 7) as month,
                   COUNT(id) as total_readings,
                   ROUND(SUM(energy_kwh), 2) as total_kwh,
                   ROUND(AVG(energy_kwh), 2) as avg_kwh
            FROM Electricity_Readings
            GROUP BY month
            ORDER BY month DESC
        """)
        rows = [dict(row) for row in cursor.fetchall()]
        headers = ["month", "total_readings", "total_kwh", "avg_kwh"]
        return rows, headers

    elif report_type == "suspicious_activity":
        cursor.execute("""
            SELECT alert_code, consumer_id, feeder_id, transformer_id, timestamp,
                   activity_type, actual_kwh, expected_kwh, risk_score, risk_level, investigation_status
            FROM Theft_Alerts
            ORDER BY risk_score DESC
        """)
        rows = [dict(row) for row in cursor.fetchall()]
        headers = ["alert_code", "consumer_id", "feeder_id", "transformer_id", "timestamp", "activity_type", "actual_kwh", "expected_kwh", "risk_score", "risk_level", "investigation_status"]
        return rows, headers

    elif report_type == "feeder_discrepancy":
        cursor.execute("""
            SELECT f.feeder_id, f.name, f.capacity_kva,
                   ROUND(COALESCE(SUM(fr.input_energy_kwh), 0.0), 2) as total_input_kwh,
                   ROUND(COALESCE(SUM(tr.input_energy_kwh), 0.0), 2) as accounted_kwh,
                   ROUND(COALESCE(SUM(fr.input_energy_kwh), 0.0) - COALESCE(SUM(tr.input_energy_kwh), 0.0), 2) as discrepancy_kwh,
                   CASE WHEN SUM(fr.input_energy_kwh) > 0
                        THEN ROUND((SUM(fr.input_energy_kwh) - SUM(tr.input_energy_kwh)) / SUM(fr.input_energy_kwh) * 100.0, 2)
                        ELSE 0.0 END as discrepancy_pct
            FROM Feeders f
            LEFT JOIN Feeder_Readings fr ON f.feeder_id = fr.feeder_id
            LEFT JOIN Transformers t ON f.feeder_id = t.feeder_id
            LEFT JOIN Transformer_Readings tr ON t.transformer_id = tr.transformer_id AND fr.timestamp = tr.timestamp
            GROUP BY f.feeder_id
        """)
        rows = [dict(row) for row in cursor.fetchall()]
        headers = ["feeder_id", "name", "capacity_kva", "total_input_kwh", "accounted_kwh", "discrepancy_kwh", "discrepancy_pct"]
        return rows, headers

    elif report_type == "transformer_discrepancy":
        cursor.execute("""
            SELECT t.transformer_id, t.feeder_id, t.name, t.capacity_kva,
                   ROUND(COALESCE(SUM(tr.input_energy_kwh), 0.0), 2) as input_kwh,
                   ROUND(COALESCE((
                       SELECT SUM(r.energy_kwh) FROM Electricity_Readings r
                       JOIN Consumers c ON r.consumer_id = c.consumer_id
                       WHERE c.transformer_id = t.transformer_id
                   ), 0.0), 2) as consumer_metered_kwh
            FROM Transformers t
            LEFT JOIN Transformer_Readings tr ON t.transformer_id = tr.transformer_id
            GROUP BY t.transformer_id
        """)
        raw_rows = [dict(r) for r in cursor.fetchall()]
        result = []
        for r in raw_rows:
            in_kwh = r["input_kwh"]
            c_kwh = r["consumer_metered_kwh"]
            disc_kwh = round(in_kwh - c_kwh, 2)
            pct = round(disc_kwh / in_kwh * 100.0, 2) if in_kwh > 0 else 0.0
            r["discrepancy_kwh"] = disc_kwh
            r["discrepancy_pct"] = pct
            result.append(r)
        headers = ["transformer_id", "feeder_id", "name", "capacity_kva", "input_kwh", "consumer_metered_kwh", "discrepancy_kwh", "discrepancy_pct"]
        return result, headers

    elif report_type == "investigation_status":
        cursor.execute("""
            SELECT alert_code, consumer_id, transformer_id, activity_type,
                   risk_score, risk_level, investigation_status, updated_at, notes
            FROM Theft_Alerts
            ORDER BY updated_at DESC
        """)
        rows = [dict(row) for row in cursor.fetchall()]
        headers = ["alert_code", "consumer_id", "transformer_id", "activity_type", "risk_score", "risk_level", "investigation_status", "updated_at", "notes"]
        return rows, headers

    else:
        return [], []

def export_report_to_csv(rows: List[Dict[str, Any]], headers: List[str]) -> str:
    """
    Converts report rows to CSV formatted string.
    """
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()
