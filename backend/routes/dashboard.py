from fastapi import APIRouter, Depends
from backend.database import get_db
import sqlite3
from typing import Dict, Any, List

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/summary")
def get_dashboard_summary():
    with get_db() as conn:
        cursor = conn.cursor()

        # Total consumption
        cursor.execute("SELECT COALESCE(SUM(energy_kwh), 0.0) as total_kwh FROM Electricity_Readings;")
        total_kwh = round(float(cursor.fetchone()["total_kwh"]), 2)

        # Consumer counts by category
        cursor.execute("""
            SELECT category, COUNT(*) as cnt
            FROM Consumers
            GROUP BY category;
        """)
        cat_counts = {row["category"]: row["cnt"] for row in cursor.fetchall()}
        residential_count = cat_counts.get("Residential", 0)
        commercial_count = cat_counts.get("Commercial", 0)
        industrial_count = cat_counts.get("Industrial", 0)
        total_consumers = residential_count + commercial_count + industrial_count

        # Feeders & Transformers
        cursor.execute("SELECT COUNT(*) as cnt FROM Feeders;")
        total_feeders = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM Transformers;")
        total_transformers = cursor.fetchone()["cnt"]

        # Suspicious consumers (having active alerts)
        cursor.execute("""
            SELECT COUNT(DISTINCT consumer_id) as cnt
            FROM Theft_Alerts
            WHERE investigation_status != 'False Alarm';
        """)
        suspicious_consumers = cursor.fetchone()["cnt"]
        normal_consumers = max(0, total_consumers - suspicious_consumers)

        # Total anomalies detected
        cursor.execute("SELECT COUNT(*) as cnt FROM Anomaly_Detections WHERE is_anomaly = 1;")
        total_anomalies = cursor.fetchone()["cnt"]

        # Network unaccounted energy calculation:
        # Sum of feeder inputs - Sum of consumer metered energy
        cursor.execute("SELECT COALESCE(SUM(input_energy_kwh), 0.0) as total_fdr_in FROM Feeder_Readings;")
        total_fdr_in = float(cursor.fetchone()["total_fdr_in"])
        
        # Total consumer accounted energy
        cursor.execute("SELECT COALESCE(SUM(energy_kwh), 0.0) as total_consumer_kwh FROM Electricity_Readings;")
        total_consumer_kwh = float(cursor.fetchone()["total_consumer_kwh"])

        unaccounted_energy = round(max(0.0, total_fdr_in - total_consumer_kwh), 2)

        # Fetch configured tariff
        cursor.execute("SELECT value FROM System_Settings WHERE key = 'default_tariff_inr';")
        tariff_row = cursor.fetchone()
        tariff_rate = float(tariff_row["value"]) if tariff_row else 7.50
        financial_exposure = round(unaccounted_energy * tariff_rate, 2)

        # High risk transformers (discrepancy > 8%)
        # Calculate per-transformer discrepancy
        cursor.execute("""
            SELECT t.transformer_id,
                   COALESCE(SUM(tr.input_energy_kwh), 0.0) as tr_in,
                   (SELECT COALESCE(SUM(r.energy_kwh), 0.0)
                    FROM Electricity_Readings r
                    JOIN Consumers c ON r.consumer_id = c.consumer_id
                    WHERE c.transformer_id = t.transformer_id) as cons_kwh
            FROM Transformers t
            LEFT JOIN Transformer_Readings tr ON t.transformer_id = tr.transformer_id
            GROUP BY t.transformer_id;
        """)
        high_risk_tr_count = 0
        for tr_row in cursor.fetchall():
            tr_in = float(tr_row["tr_in"])
            cons_kwh = float(tr_row["cons_kwh"])
            if tr_in > 0:
                disc_pct = ((tr_in - cons_kwh) / tr_in) * 100.0
                if disc_pct > 8.0:
                    high_risk_tr_count += 1

        return {
            "total_consumption_kwh": total_kwh,
            "total_consumers": total_consumers,
            "residential_consumers": residential_count,
            "commercial_consumers": commercial_count,
            "industrial_consumers": industrial_count,
            "total_feeders": total_feeders,
            "total_transformers": total_transformers,
            "normal_consumers": normal_consumers,
            "suspicious_consumers": suspicious_consumers,
            "total_anomalies_detected": total_anomalies,
            "high_risk_transformers": high_risk_tr_count,
            "total_unaccounted_energy_kwh": unaccounted_energy,
            "estimated_financial_exposure_inr": financial_exposure,
            "assumed_tariff_inr": tariff_rate,
            "system_status": "Active Monitoring"
        }

@router.get("/charts")
def get_dashboard_charts():
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Hourly Electricity Consumption (last 24 hours of readings)
        cursor.execute("""
            SELECT substr(timestamp, 12, 5) as time_label,
                   ROUND(SUM(energy_kwh), 2) as consumption_kwh
            FROM Electricity_Readings
            WHERE timestamp >= (SELECT datetime(MAX(timestamp), '-24 hours') FROM Electricity_Readings)
            GROUP BY time_label
            ORDER BY MIN(timestamp) ASC;
        """)
        hourly_data = [dict(r) for r in cursor.fetchall()]

        # 2. Daily Electricity Consumption (grouped by date)
        cursor.execute("""
            SELECT substr(timestamp, 1, 10) as date_label,
                   ROUND(SUM(energy_kwh), 2) as total_kwh,
                   ROUND(AVG(energy_kwh), 2) as avg_kwh
            FROM Electricity_Readings
            GROUP BY date_label
            ORDER BY date_label ASC;
        """)
        daily_data = [dict(r) for r in cursor.fetchall()]

        # 3. Monthly Consumption Trends
        cursor.execute("""
            SELECT substr(timestamp, 1, 7) as month_label,
                   ROUND(SUM(energy_kwh), 2) as consumption_kwh
            FROM Electricity_Readings
            GROUP BY month_label
            ORDER BY month_label ASC;
        """)
        monthly_data = [dict(r) for r in cursor.fetchall()]

        # 4. Consumer Category Comparison
        cursor.execute("""
            SELECT c.category,
                   ROUND(SUM(r.energy_kwh), 2) as total_kwh,
                   COUNT(DISTINCT c.consumer_id) as consumer_count
            FROM Consumers c
            LEFT JOIN Electricity_Readings r ON c.consumer_id = r.consumer_id
            GROUP BY c.category;
        """)
        category_data = [dict(r) for r in cursor.fetchall()]

        # 5. Normal vs Abnormal Readings
        cursor.execute("""
            SELECT is_anomaly, COUNT(*) as count
            FROM Anomaly_Detections
            GROUP BY is_anomaly;
        """)
        counts = {r["is_anomaly"]: r["count"] for r in cursor.fetchall()}
        normal_vs_abnormal = [
            {"status": "Normal Readings", "count": counts.get(0, 0), "color": "#10B981"},
            {"status": "Abnormal Readings", "count": counts.get(1, 0), "color": "#EF4444"}
        ]

        # 6. Suspicious Activity Trends (daily anomaly count)
        cursor.execute("""
            SELECT substr(timestamp, 1, 10) as date_label,
                   COUNT(*) as anomaly_count
            FROM Anomaly_Detections
            WHERE is_anomaly = 1
            GROUP BY date_label
            ORDER BY date_label ASC;
        """)
        suspicious_trends = [dict(r) for r in cursor.fetchall()]

        # 7. Transformer-wise Energy Discrepancy
        cursor.execute("""
            SELECT t.transformer_id, t.name,
                   ROUND(COALESCE(SUM(tr.input_energy_kwh), 0.0), 2) as input_kwh,
                   ROUND(COALESCE((
                       SELECT SUM(r.energy_kwh) FROM Electricity_Readings r
                       JOIN Consumers c ON r.consumer_id = c.consumer_id
                       WHERE c.transformer_id = t.transformer_id
                   ), 0.0), 2) as consumer_kwh
            FROM Transformers t
            LEFT JOIN Transformer_Readings tr ON t.transformer_id = tr.transformer_id
            GROUP BY t.transformer_id;
        """)
        tr_discrepancy = []
        for r in cursor.fetchall():
            in_k = float(r["input_kwh"])
            out_k = float(r["consumer_kwh"])
            disc_k = round(max(0.0, in_k - out_k), 2)
            pct = round((disc_k / in_k * 100.0), 2) if in_k > 0 else 0.0
            tr_discrepancy.append({
                "transformer_id": r["transformer_id"],
                "name": r["name"],
                "input_kwh": in_k,
                "consumer_kwh": out_k,
                "discrepancy_kwh": disc_k,
                "discrepancy_pct": pct
            })

        # 8. Feeder-wise Energy Discrepancy
        cursor.execute("""
            SELECT f.feeder_id, f.name,
                   ROUND(COALESCE(SUM(fr.input_energy_kwh), 0.0), 2) as input_kwh,
                   ROUND(COALESCE((
                       SELECT SUM(tr.input_energy_kwh)
                       FROM Transformer_Readings tr
                       JOIN Transformers t ON tr.transformer_id = t.transformer_id
                       WHERE t.feeder_id = f.feeder_id
                   ), 0.0), 2) as accounted_kwh
            FROM Feeders f
            LEFT JOIN Feeder_Readings fr ON f.feeder_id = fr.feeder_id
            GROUP BY f.feeder_id;
        """)
        fdr_discrepancy = []
        for r in cursor.fetchall():
            in_k = float(r["input_kwh"])
            acc_k = float(r["accounted_kwh"])
            disc_k = round(max(0.0, in_k - acc_k), 2)
            pct = round((disc_k / in_k * 100.0), 2) if in_k > 0 else 0.0
            fdr_discrepancy.append({
                "feeder_id": r["feeder_id"],
                "name": r["name"],
                "input_kwh": in_k,
                "accounted_kwh": acc_k,
                "discrepancy_kwh": disc_k,
                "discrepancy_pct": pct
            })

        # 9. Risk Distribution (from Theft_Alerts)
        cursor.execute("""
            SELECT risk_level, COUNT(*) as count
            FROM Theft_Alerts
            GROUP BY risk_level;
        """)
        risk_map = {r["risk_level"]: r["count"] for r in cursor.fetchall()}
        risk_distribution = [
            {"level": "Low (0-30)", "count": risk_map.get("Low", 0), "color": "#10B981"},
            {"level": "Medium (31-60)", "count": risk_map.get("Medium", 0), "color": "#F59E0B"},
            {"level": "High (61-80)", "count": risk_map.get("High", 0), "color": "#F97316"},
            {"level": "Critical (81-100)", "count": risk_map.get("Critical", 0), "color": "#EF4444"}
        ]

        return {
            "hourly_consumption": hourly_data,
            "daily_consumption": daily_data,
            "monthly_trends": monthly_data,
            "category_comparison": category_data,
            "normal_vs_abnormal": normal_vs_abnormal,
            "suspicious_trends": suspicious_trends,
            "transformer_discrepancy": tr_discrepancy,
            "feeder_discrepancy": fdr_discrepancy,
            "risk_distribution": risk_distribution
        }
