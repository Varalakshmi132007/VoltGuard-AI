import sqlite3
import random
import numpy as np
from datetime import datetime, timedelta
from backend.services.explanation import generate_consumer_explanation
from backend.services.risk_scoring import calculate_consumer_risk_score
from backend.machine_learning.anomaly_detection import IsolationForestAnomalyDetector
from backend.machine_learning.classification import train_and_evaluate_random_forest

def seed_sample_database(conn: sqlite3.Connection):
    """
    Populates rich, realistic sample electricity infrastructure, consumer meters,
    hourly readings, transformer/feeder balance, and anomaly detection results.
    """
    cursor = conn.cursor()

    # Check if database is already seeded
    cursor.execute("SELECT COUNT(*) as cnt FROM Consumers;")
    if cursor.fetchone()["cnt"] > 0:
        return

    print("Seeding realistic sample power grid dataset...")

    # 1. Feeders
    feeders_data = [
        ("FDR-NORTH-01", "North Substation Feeder 1", "North Industrial & Residential Corridor", 5000.0, "Operational"),
        ("FDR-CENTRAL-02", "Central Metro Substation Feeder 2", "Downtown Commercial District", 4000.0, "Operational"),
        ("FDR-WEST-03", "West Suburban Feeder 3", "West Residential Zone & Parks", 3000.0, "Operational")
    ]
    cursor.executemany("""
    INSERT INTO Feeders (feeder_id, name, location, capacity_kva, status)
    VALUES (?, ?, ?, ?, ?);
    """, feeders_data)

    # 2. Transformers
    transformers_data = [
        ("TR-101", "FDR-NORTH-01", "Distribution TR North-A", "Sector 4 Industrial Park", 1200.0, "Operational"),
        ("TR-102", "FDR-NORTH-01", "Distribution TR North-B", "Sector 7 Mixed Residential", 800.0, "Operational"), # Suspicious hub
        ("TR-201", "FDR-CENTRAL-02", "Distribution TR Central-A", "Commercial Tech Hub", 1500.0, "Operational"),
        ("TR-202", "FDR-CENTRAL-02", "Distribution TR Central-B", "Market Mall Complex", 1000.0, "Operational"),
        ("TR-301", "FDR-WEST-03", "Distribution TR West-A", "Green Valley Residential Block", 600.0, "Operational"),
        ("TR-302", "FDR-WEST-03", "Distribution TR West-B", "Hilltop Villa Community", 500.0, "Operational")
    ]
    cursor.executemany("""
    INSERT INTO Transformers (transformer_id, feeder_id, name, location, capacity_kva, status)
    VALUES (?, ?, ?, ?, ?, ?);
    """, transformers_data)

    # 3. Consumers (28 Consumers across Residential, Commercial, Industrial)
    consumers_data = [
        # TR-101 (Industrial)
        ("CON-IND-301", "Alpha Precision Steel Works", "MTR-IND-301", "Industrial", "Plot 12, Ind Area", 75.0, "FDR-NORTH-01", "TR-101", "2024-01-10"),
        ("CON-IND-302", "Apex Polymer Moulding", "MTR-IND-302", "Industrial", "Plot 18, Ind Area", 60.0, "FDR-NORTH-01", "TR-101", "2024-02-15"),
        ("CON-IND-303", "Zenith Cold Logistics", "MTR-IND-303", "Industrial", "Plot 24, Ind Area", 90.0, "FDR-NORTH-01", "TR-101", "2024-03-01"),

        # TR-102 (Mixed Residential & Small Shops - High Suspicious Activity Hub!)
        ("CON-RES-101", "Aarav Sharma", "MTR-RES-101", "Residential", "A-102, Shanti Vihar", 3.0, "FDR-NORTH-01", "TR-102", "2024-01-12"),
        ("CON-RES-102", "Priya Venkatesh", "MTR-RES-102", "Residential", "A-103, Shanti Vihar", 4.0, "FDR-NORTH-01", "TR-102", "2024-01-15"),
        ("CON-RES-103", "Rajesh Gupta", "MTR-RES-103", "Residential", "B-201, Shanti Vihar", 5.0, "FDR-NORTH-01", "TR-102", "2024-02-01"),
        ("CON-RES-104", "Vikram Malhotra", "MTR-RES-104", "Residential", "B-204, Shanti Vihar", 4.0, "FDR-NORTH-01", "TR-102", "2024-02-10"), # Tampering/Bypass
        ("CON-RES-105", "Sneha Roy", "MTR-RES-105", "Residential", "C-301, Shanti Vihar", 3.5, "FDR-NORTH-01", "TR-102", "2024-03-05"),
        ("CON-RES-106", "Anand Kulkarni", "MTR-RES-106", "Residential", "C-302, Shanti Vihar", 4.0, "FDR-NORTH-01", "TR-102", "2024-03-12"),
        ("CON-RES-107", "Kavita Rao", "MTR-RES-107", "Residential", "D-401, Shanti Vihar", 2.5, "FDR-NORTH-01", "TR-102", "2024-04-02"),
        ("CON-RES-108", "Deepak Verma", "MTR-RES-108", "Residential", "D-405, Shanti Vihar", 3.0, "FDR-NORTH-01", "TR-102", "2024-04-18"), # Surge/Heavy tap
        ("CON-COM-201", "Metro Bakery & Provisions", "MTR-COM-201", "Commercial", "Shop 1, Sector 7 Mkt", 12.0, "FDR-NORTH-01", "TR-102", "2024-01-20"),

        # TR-201 (Commercial Tech Hub)
        ("CON-COM-202", "CyberGate IT Solutions", "MTR-COM-202", "Commercial", "Tower B, Level 3", 25.0, "FDR-CENTRAL-02", "TR-201", "2024-01-05"),
        ("CON-COM-203", "Nexus Data Servers", "MTR-COM-203", "Commercial", "Tower B, Level 4", 30.0, "FDR-CENTRAL-02", "TR-201", "2024-01-10"), # Low PF tampering
        ("CON-COM-204", "Bean & Leaf Cafe", "MTR-COM-204", "Commercial", "Ground Plaza, Tower B", 10.0, "FDR-CENTRAL-02", "TR-201", "2024-02-20"),
        ("CON-COM-205", "FitLife Fitness Center", "MTR-COM-205", "Commercial", "Basement Suite, Tower B", 15.0, "FDR-CENTRAL-02", "TR-201", "2024-03-01"),

        # TR-202 (Market Mall Complex)
        ("CON-COM-206", "Grand Mart Supermarket", "MTR-COM-206", "Commercial", "Mall Wing A", 22.0, "FDR-CENTRAL-02", "TR-202", "2024-01-25"),
        ("CON-COM-207", "CinePlex Theatres", "MTR-COM-207", "Commercial", "Mall Wing C", 28.0, "FDR-CENTRAL-02", "TR-202", "2024-02-05"),
        ("CON-RES-109", "Mall Caretaker Residence", "MTR-RES-109", "Residential", "Service Quarter 1", 2.0, "FDR-CENTRAL-02", "TR-202", "2024-02-10"),

        # TR-301 (West Suburban Residential)
        ("CON-RES-110", "Amitabh Sen", "MTR-RES-110", "Residential", "Plot 14, Green Valley", 5.0, "FDR-WEST-03", "TR-301", "2024-01-11"),
        ("CON-RES-111", "Farhan Akhtar", "MTR-RES-111", "Residential", "Plot 15, Green Valley", 4.5, "FDR-WEST-03", "TR-301", "2024-01-19"),
        ("CON-RES-112", "Sunita Nair (Vacant Home)", "MTR-RES-112", "Residential", "Plot 18, Green Valley", 3.0, "FDR-WEST-03", "TR-301", "2024-02-02"),
        ("CON-RES-113", "Manoj Tiwari", "MTR-RES-113", "Residential", "Plot 22, Green Valley", 4.0, "FDR-WEST-03", "TR-301", "2024-02-14"),

        # TR-302 (Hilltop Community)
        ("CON-RES-114", "Rohit Chawla", "MTR-RES-114", "Residential", "Villa 1, Hilltop", 6.0, "FDR-WEST-03", "TR-302", "2024-01-08"),
        ("CON-RES-115", "Divya Menon", "MTR-RES-115", "Residential", "Villa 4, Hilltop", 5.5, "FDR-WEST-03", "TR-302", "2024-01-22"),
        ("CON-RES-116", "Karan Johar", "MTR-RES-116", "Residential", "Villa 9, Hilltop", 6.5, "FDR-WEST-03", "TR-302", "2024-02-18"),
        ("CON-IND-304", "Hilltop Water Treatment Pump", "MTR-IND-304", "Industrial", "Utility Zone, Hilltop", 45.0, "FDR-WEST-03", "TR-302", "2024-01-15"),
        ("CON-IND-305", "Suburban Telecom Station", "MTR-IND-305", "Industrial", "Hilltop Tower Station", 35.0, "FDR-WEST-03", "TR-302", "2024-02-01")
    ]
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.executemany("""
    INSERT INTO Consumers (
        consumer_id, name, meter_id, category, location,
        connected_load_capacity, feeder_id, transformer_id, registration_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, [(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], created_at) for c in consumers_data])

    # 4. Generate 7 Days (168 Hours) of Hourly Readings
    now = datetime.now()
    start_dt = (now - timedelta(days=7)).replace(minute=0, second=0, microsecond=0)

    hours = 168
    timestamps = [start_dt + timedelta(hours=h) for h in range(hours)]

    consumer_readings_rows = []
    hourly_tr_totals = {tr[0]: [0.0] * hours for tr in transformers_data}
    hourly_fdr_totals = {fdr[0]: [0.0] * hours for fdr in feeders_data}

    # Consumer mapping: id -> (category, connected_load, tr_id, fdr_id)
    c_map = {c[0]: (c[3], c[5], c[7], c[6]) for c in consumers_data}

    for h_idx, ts in enumerate(timestamps):
        ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
        hour = ts.hour
        is_weekend = (ts.weekday() >= 5)

        for cid, (cat, load_cap, tr_id, fdr_id) in c_map.items():
            # Individual baseline patterns:
            if cat == "Residential":
                # Morning peak (6-9) and evening peak (18-22)
                base = 0.8
                if 6 <= hour <= 9:
                    base += 1.2
                elif 18 <= hour <= 22:
                    base += 1.8
                elif 0 <= hour <= 5:
                    base = 0.3
                else:
                    base = 0.7

                if is_weekend:
                    base *= 1.25

                # Individual scaling by sanctioned load
                base = base * (load_cap / 4.0)
                energy = max(0.1, np.random.normal(base, base * 0.12))
                voltage = np.random.normal(230.0, 3.5)
                power_factor = np.random.uniform(0.90, 0.98)

                # Special injected cases:
                if cid == "CON-RES-112":
                    # Vacant home
                    energy = max(0.04, np.random.normal(0.06, 0.01))
                elif cid == "CON-RES-104" and h_idx >= 96:
                    # Tampering: Meter bypass starting day 5 -> drops by 85%
                    energy = max(0.05, energy * 0.15)
                    power_factor = np.random.uniform(0.65, 0.78)
                elif cid == "CON-RES-108" and 100 <= h_idx <= 108:
                    # Massive surge / unauthorized heavy load (heater/workshop tapping)
                    energy = min(load_cap * 3.5, energy * 4.2)
                    power_factor = np.random.uniform(0.70, 0.82)

            elif cat == "Commercial":
                # Business hours 9am to 9pm
                if 9 <= hour <= 21:
                    base = load_cap * 0.65
                else:
                    base = load_cap * 0.15

                if is_weekend:
                    base *= 0.60 # Lower on weekends for offices, higher for malls

                if "Mall" in cid or "Theatres" in cid or "Supermarket" in cid:
                    if is_weekend:
                        base = load_cap * 0.75

                energy = max(0.5, np.random.normal(base, base * 0.10))
                voltage = np.random.normal(415.0, 5.0)
                power_factor = np.random.uniform(0.88, 0.96)

                # Special injected case:
                if cid == "CON-COM-203" and h_idx >= 110:
                    # Suspicious phase tampering & low power factor
                    power_factor = np.random.uniform(0.52, 0.62)
                    energy = energy * 0.45

            else: # Industrial
                # Shift-based (24/7 or continuous)
                base = load_cap * (0.60 if 8 <= hour <= 20 else 0.45)
                if is_weekend:
                    base *= 0.80

                # Special injected case:
                if cid == "CON-IND-302" and 48 <= h_idx <= 60:
                    # Legitimate weekend heavy overtime shift
                    base = load_cap * 0.85

                energy = max(2.0, np.random.normal(base, base * 0.08))
                voltage = np.random.normal(415.0, 6.0)
                power_factor = np.random.uniform(0.85, 0.94)

            current = round((energy * 1000.0) / (voltage * power_factor * (1.732 if cat != 'Residential' else 1.0)), 2)
            power = round(energy, 2)
            energy = round(energy, 2)
            voltage = round(voltage, 1)
            power_factor = round(power_factor, 2)

            consumer_readings_rows.append((
                ts_str, cid, f"MTR-{cid}", voltage, current, power, energy, power_factor, load_cap, 1
            ))

            hourly_tr_totals[tr_id][h_idx] += energy

    cursor.executemany("""
    INSERT INTO Electricity_Readings (
        timestamp, consumer_id, meter_id, voltage, current, power,
        energy_kwh, power_factor, connected_load_capacity, is_simulated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, consumer_readings_rows)

    # 5. Generate Transformer Readings with Technical & Injected Line Losses
    tr_readings_rows = []
    for tr_id, tr_hourly in hourly_tr_totals.items():
        # TR-102 has high suspicious discrepancy (theft/unmetered loss ~14%)
        # Other transformers have natural ~3.5% line loss
        loss_pct = 0.145 if tr_id == "TR-102" else 0.038

        for h_idx, ts in enumerate(timestamps):
            ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
            c_sum = tr_hourly[h_idx]
            # Input energy to transformer is sum of downstream meters plus losses
            tr_input = round(c_sum * (1.0 + loss_pct) + np.random.uniform(0.2, 0.8), 2)
            tr_readings_rows.append((tr_id, ts_str, tr_input, 1))

            # Add to parent feeder
            # Find parent feeder
            fdr_id = next(t[1] for t in transformers_data if t[0] == tr_id)
            hourly_fdr_totals[fdr_id][h_idx] += tr_input

    cursor.executemany("""
    INSERT INTO Transformer_Readings (transformer_id, timestamp, input_energy_kwh, is_simulated)
    VALUES (?, ?, ?, ?);
    """, tr_readings_rows)

    # 6. Generate Feeder Readings
    fdr_readings_rows = []
    for fdr_id, fdr_hourly in hourly_fdr_totals.items():
        trans_loss_pct = 0.035 # standard transmission line loss
        for h_idx, ts in enumerate(timestamps):
            ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
            tr_sum = fdr_hourly[h_idx]
            fdr_input = round(tr_sum * (1.0 + trans_loss_pct) + np.random.uniform(1.0, 3.0), 2)
            fdr_readings_rows.append((fdr_id, ts_str, fdr_input, 1))

    cursor.executemany("""
    INSERT INTO Feeder_Readings (feeder_id, timestamp, input_energy_kwh, is_simulated)
    VALUES (?, ?, ?, ?);
    """, fdr_readings_rows)

    conn.commit()

    # 7. Run Isolation Forest Anomaly Detection
    print("Running Isolation Forest anomaly detection on seeded data...")
    detector = IsolationForestAnomalyDetector(contamination=0.07)
    detector.train_and_evaluate(conn)

    # 8. Generate Realistic Theft Alerts from Detections
    print("Generating risk scores and investigation alerts...")
    cursor.execute("""
        SELECT a.id, a.reading_id, a.consumer_id, a.timestamp, a.actual_kwh,
               a.expected_kwh, a.deviation_pct, a.anomaly_score, a.detection_result,
               c.category, c.connected_load_capacity, c.feeder_id, c.transformer_id
        FROM Anomaly_Detections a
        JOIN Consumers c ON a.consumer_id = c.consumer_id
        WHERE a.is_anomaly = 1
        ORDER BY a.anomaly_score DESC
    """)
    anomalies = cursor.fetchall()

    alert_records = []
    alert_counter = 1
    recent_flag_counts = {}

    for row in anomalies:
        cid = row["consumer_id"]
        recent_flag_counts[cid] = recent_flag_counts.get(cid, 0) + 1
        tr_id = row["transformer_id"]
        tr_disc = 14.5 if tr_id == "TR-102" else 4.0

        risk_score, risk_level, _ = calculate_consumer_risk_score(
            anomaly_score=row["anomaly_score"],
            deviation_pct=row["deviation_pct"],
            repeated_abnormal_count=recent_flag_counts[cid],
            transformer_discrepancy_pct=tr_disc
        )

        # Only generate prominent alerts for Medium, High, and Critical risks
        if risk_score >= 35.0:
            alert_code = f"ALT-2026-{alert_counter:04d}"
            alert_counter += 1

            status = "Pending Investigation"
            if risk_level == "Critical":
                status = "Under Investigation" if alert_counter % 2 == 0 else "Pending Investigation"
            elif row["consumer_id"] == "CON-IND-302":
                status = "False Alarm" # legitimate overtime
            elif alert_counter % 5 == 0:
                status = "Resolved"

            alert_records.append((
                alert_code,
                row["consumer_id"],
                row["feeder_id"],
                row["transformer_id"],
                row["timestamp"],
                row["detection_result"],
                row["actual_kwh"],
                row["expected_kwh"],
                row["anomaly_score"],
                risk_score,
                risk_level,
                generate_consumer_explanation(
                    consumer_id=row["consumer_id"],
                    category=row["category"],
                    connected_load=row["connected_load_capacity"],
                    actual_kwh=row["actual_kwh"],
                    expected_kwh=row["expected_kwh"],
                    deviation_pct=row["deviation_pct"],
                    activity_type=row["detection_result"],
                    hour=int(row["timestamp"][11:13]),
                    is_weekend=False,
                    transformer_discrepancy_pct=tr_disc
                ),
                status,
                f"Generated by VoltGuard AI risk engine. Priority level: {risk_level}.",
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ))

    cursor.executemany("""
    INSERT INTO Theft_Alerts (
        alert_code, consumer_id, feeder_id, transformer_id, timestamp,
        activity_type, actual_kwh, expected_kwh, anomaly_score, risk_score,
        risk_level, explanation, investigation_status, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, alert_records)

    # 9. Train and Evaluate Random Forest on synthetic labeled dataset
    print("Training Random Forest Classifier on synthetic benchmark...")
    train_and_evaluate_random_forest(conn)

    conn.commit()
    print("Seeding complete! Database successfully populated with realistic power grid records.")
