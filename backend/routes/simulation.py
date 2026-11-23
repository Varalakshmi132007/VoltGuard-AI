from fastapi import APIRouter
from backend.database import get_db
from backend.schemas import SimulationStepRequest, SimulateSuspiciousRequest
from datetime import datetime, timedelta
import numpy as np
import random
from backend.services.explanation import generate_consumer_explanation
from backend.services.risk_scoring import calculate_consumer_risk_score
from backend.machine_learning.anomaly_detection import IsolationForestAnomalyDetector

router = APIRouter(prefix="/api/simulation", tags=["Simulation Engine"])

@router.post("/step")
def advance_simulation_step(req: SimulationStepRequest):
    """
    Simulates the arrival of next-hour smart meter readings for all consumers,
    updates transformers and feeders, and runs real-time anomaly detection.
    [DEMO / SIMULATED DATA]
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Find latest timestamp in Electricity_Readings
        cursor.execute("SELECT MAX(timestamp) as latest_ts FROM Electricity_Readings;")
        row = cursor.fetchone()
        if row and row["latest_ts"]:
            last_dt = datetime.strptime(row["latest_ts"], "%Y-%m-%d %H:%M:%S")
        else:
            last_dt = datetime.now() - timedelta(hours=1)

        new_dt = last_dt + timedelta(hours=req.hours_to_advance or 1)
        new_ts_str = new_dt.strftime("%Y-%m-%d %H:%M:%S")
        hour = new_dt.hour
        is_weekend = (new_dt.weekday() >= 5)

        # Fetch all consumers
        cursor.execute("SELECT * FROM Consumers;")
        consumers = [dict(c) for c in cursor.fetchall()]

        readings_records = []
        tr_sums = {}

        for c in consumers:
            cid = c["consumer_id"]
            cat = c["category"]
            load_cap = float(c["connected_load_capacity"])
            tr_id = c["transformer_id"]

            if cat == "Residential":
                base = 0.8 + (1.2 if 6 <= hour <= 9 else (1.8 if 18 <= hour <= 22 else 0.4))
                if is_weekend:
                    base *= 1.2
                base = base * (load_cap / 4.0)
                energy = max(0.1, np.random.normal(base, base * 0.12))
                voltage = np.random.normal(230.0, 3.0)
                power_factor = np.random.uniform(0.91, 0.98)
            elif cat == "Commercial":
                base = load_cap * (0.65 if 9 <= hour <= 21 else 0.15)
                if is_weekend:
                    base *= 0.70
                energy = max(0.5, np.random.normal(base, base * 0.10))
                voltage = np.random.normal(415.0, 4.0)
                power_factor = np.random.uniform(0.89, 0.96)
            else: # Industrial
                base = load_cap * (0.60 if 8 <= hour <= 20 else 0.45)
                energy = max(2.0, np.random.normal(base, base * 0.08))
                voltage = np.random.normal(415.0, 5.0)
                power_factor = np.random.uniform(0.86, 0.94)

            current = round((energy * 1000.0) / (voltage * power_factor * (1.732 if cat != 'Residential' else 1.0)), 2)
            power = round(energy, 2)
            energy = round(energy, 2)
            voltage = round(voltage, 1)
            power_factor = round(power_factor, 2)

            readings_records.append((
                new_ts_str, cid, f"MTR-{cid}", voltage, current, power, energy, power_factor, load_cap, 1
            ))

            tr_sums[tr_id] = tr_sums.get(tr_id, 0.0) + energy

        # Insert new readings
        cursor.executemany("""
            INSERT INTO Electricity_Readings (
                timestamp, consumer_id, meter_id, voltage, current, power,
                energy_kwh, power_factor, connected_load_capacity, is_simulated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, readings_records)

        # Update transformer readings
        cursor.execute("SELECT transformer_id, feeder_id FROM Transformers;")
        transformers = cursor.fetchall()

        tr_records = []
        fdr_sums = {}
        for tr in transformers:
            tid = tr["transformer_id"]
            fid = tr["feeder_id"]
            loss_pct = 0.14 if tid == "TR-102" else 0.038
            c_sum = tr_sums.get(tid, 5.0)
            tr_input = round(c_sum * (1.0 + loss_pct) + np.random.uniform(0.1, 0.5), 2)
            tr_records.append((tid, new_ts_str, tr_input, 1))
            fdr_sums[fid] = fdr_sums.get(fid, 0.0) + tr_input

        cursor.executemany("""
            INSERT INTO Transformer_Readings (transformer_id, timestamp, input_energy_kwh, is_simulated)
            VALUES (?, ?, ?, ?);
        """, tr_records)

        # Update feeder readings
        cursor.execute("SELECT feeder_id FROM Feeders;")
        feeders = cursor.fetchall()
        fdr_records = []
        for f in feeders:
            fid = f["feeder_id"]
            tr_sum = fdr_sums.get(fid, 10.0)
            fdr_input = round(tr_sum * 1.035 + np.random.uniform(0.5, 1.5), 2)
            fdr_records.append((fid, new_ts_str, fdr_input, 1))

        cursor.executemany("""
            INSERT INTO Feeder_Readings (feeder_id, timestamp, input_energy_kwh, is_simulated)
            VALUES (?, ?, ?, ?);
        """, fdr_records)

        conn.commit()

        # Run fast anomaly detection on updated readings
        detector = IsolationForestAnomalyDetector()
        res = detector.train_and_evaluate(conn)

        return {
            "status": "simulation_advanced",
            "simulated_timestamp": new_ts_str,
            "readings_added": len(readings_records),
            "anomaly_detection_summary": res,
            "badge": "[DEMO / SIMULATED DATA]"
        }

@router.post("/inject-suspicious")
def inject_suspicious_activity(req: SimulateSuspiciousRequest):
    """
    Specifically injects a chosen suspicious scenario into the database
    with realistic electrical signatures, flags it via anomaly detection,
    and produces an active theft alert.
    [DEMO / SIMULATED DATA]
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Target consumer
        if req.consumer_id:
            cursor.execute("SELECT * FROM Consumers WHERE consumer_id = ?", (req.consumer_id,))
            consumer = cursor.fetchone()
        else:
            # Pick a default consumer from TR-102
            cursor.execute("SELECT * FROM Consumers WHERE transformer_id = 'TR-102' ORDER BY RANDOM() LIMIT 1;")
            consumer = cursor.fetchone()

        if not consumer:
            cursor.execute("SELECT * FROM Consumers ORDER BY RANDOM() LIMIT 1;")
            consumer = cursor.fetchone()

        consumer = dict(consumer)
        cid = consumer["consumer_id"]
        cat = consumer["category"]
        load_cap = float(consumer["connected_load_capacity"])
        tr_id = consumer["transformer_id"]
        fdr_id = consumer["feeder_id"]

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Scenarios:
        # 1. "Sudden_Spike" (Unusual consumption increase)
        # 2. "Sudden_Drop_Meter_Bypass" (Unusual consumption reduction / meter bypass)
        # 3. "Suspicious_Load_Variation" (Unexpected load variations outside hours)
        # 4. "Low_Power_Factor_Tampering" (Phase angle / CT shunting tampering)
        scenario = req.scenario or "Sudden_Drop_Meter_Bypass"

        if scenario == "Sudden_Spike":
            expected_kwh = round(load_cap * 0.4, 2)
            actual_kwh = round(load_cap * 2.8, 2)
            power_factor = 0.78
            voltage = 228.0
            act_type = "Sudden Consumption Surge"
            risk_score = 82.5
            risk_lvl = "Critical"
        elif scenario == "Sudden_Drop_Meter_Bypass":
            expected_kwh = round(load_cap * 0.5, 2)
            actual_kwh = round(expected_kwh * 0.10, 2) # dropped 90%
            power_factor = 0.72
            voltage = 231.0
            act_type = "Unusual Consumption Drop (Suspected Bypass)"
            risk_score = 88.0
            risk_lvl = "Critical"
        elif scenario == "Low_Power_Factor_Tampering":
            expected_kwh = round(load_cap * 0.6, 2)
            actual_kwh = round(expected_kwh * 0.35, 2)
            power_factor = 0.48 # heavily degraded
            voltage = 215.0
            act_type = "Possible Meter Tampering (Phase Shunt)"
            risk_score = 92.0
            risk_lvl = "Critical"
        else: # Suspicious_Load_Variation
            expected_kwh = round(load_cap * 0.3, 2)
            actual_kwh = round(load_cap * 1.9, 2)
            power_factor = 0.75
            voltage = 230.0
            act_type = "Suspicious Off-Hours Load Variation"
            risk_score = 74.0
            risk_lvl = "High"

        current = round((actual_kwh * 1000.0) / (voltage * power_factor * (1.732 if cat != 'Residential' else 1.0)), 2)
        dev_pct = round(((actual_kwh - expected_kwh) / expected_kwh) * 100.0, 1)

        # 1. Insert Reading
        cursor.execute("""
            INSERT INTO Electricity_Readings (
                timestamp, consumer_id, meter_id, voltage, current, power,
                energy_kwh, power_factor, connected_load_capacity, is_simulated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            now_str, cid, f"MTR-{cid}", voltage, current, actual_kwh, actual_kwh, power_factor, load_cap, 1
        ))
        reading_id = cursor.lastrowid

        # 2. Insert Anomaly Detection
        expl = generate_consumer_explanation(
            consumer_id=cid,
            category=cat,
            connected_load=load_cap,
            actual_kwh=actual_kwh,
            expected_kwh=expected_kwh,
            deviation_pct=dev_pct,
            activity_type=act_type,
            hour=int(now_str[11:13]),
            is_weekend=False,
            transformer_discrepancy_pct=14.5
        )

        cursor.execute("""
            INSERT INTO Anomaly_Detections (
                reading_id, consumer_id, timestamp, actual_kwh, expected_kwh,
                deviation_pct, anomaly_score, is_anomaly, detection_result, explanation, model_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            reading_id, cid, now_str, actual_kwh, expected_kwh,
            dev_pct, 0.94, 1, act_type, expl, "Isolation Forest"
        ))

        # 3. Insert Theft Alert
        alert_code = f"ALT-SIM-{random.randint(1000, 9999)}"
        cursor.execute("""
            INSERT INTO Theft_Alerts (
                alert_code, consumer_id, feeder_id, transformer_id, timestamp,
                activity_type, actual_kwh, expected_kwh, anomaly_score, risk_score,
                risk_level, explanation, investigation_status, notes, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            alert_code, cid, fdr_id, tr_id, now_str, act_type, actual_kwh,
            expected_kwh, 0.94, risk_score, risk_lvl, expl, "Pending Investigation",
            f"Simulated demonstration anomaly injected for {cid}.", now_str
        ))
        alert_id = cursor.lastrowid

        # Also add audit log
        cursor.execute("""
            INSERT INTO Investigation_Records (
                alert_id, updated_by, previous_status, new_status, remarks, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?);
        """, (alert_id, "Simulation Engine", "None", "Pending Investigation", "Simulated event registered by user trigger.", now_str))

        # 4. Also increase transformer input reading to reflect unaccounted energy gap
        cursor.execute("""
            INSERT INTO Transformer_Readings (transformer_id, timestamp, input_energy_kwh, is_simulated)
            VALUES (?, ?, ?, ?);
        """, (tr_id, now_str, round(expected_kwh * 1.35 + 8.5, 2), 1))

        conn.commit()

        return {
            "status": "success",
            "message": f"Successfully injected simulated scenario '{scenario}' for consumer {cid}.",
            "alert_code": alert_code,
            "consumer_id": cid,
            "activity_type": act_type,
            "risk_score": risk_score,
            "risk_level": risk_lvl,
            "actual_kwh": actual_kwh,
            "expected_kwh": expected_kwh,
            "deviation_pct": dev_pct,
            "explanation": expl,
            "badge": "[DEMO / SIMULATED DATA]"
        }
