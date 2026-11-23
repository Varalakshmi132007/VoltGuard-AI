import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
import sqlite3
from datetime import datetime
from typing import Dict, Any

CLASSES = [
    "Normal",
    "Abnormal",
    "Suspicious Load Variation",
    "Possible Unauthorized Consumption",
    "Possible Meter Tampering"
]

def train_and_evaluate_random_forest(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Trains and evaluates Random Forest Classifier using chronologically partitioned
    synthetic labeled benchmark data. Real metrics (Accuracy, Precision, Recall, F1,
    False Positive Rate, and Confusion Matrix) are computed on the held-out test partition.
    Strictly marked as 'Synthetic Labeled Benchmark' to respect research ethics.
    """
    # Build synthetic labeled dataset with realistic electrical physics
    np.random.seed(42)
    n_samples = 1500
    
    # Chronological timestamps
    base_time = pd.Timestamp("2026-11-01 00:00:00")
    timestamps = [base_time + pd.Timedelta(hours=i) for i in range(n_samples)]
    
    data = []
    for i, ts in enumerate(timestamps):
        hour = ts.hour
        is_weekend = int(ts.dayofweek >= 5)
        category = np.random.choice(["Residential", "Commercial", "Industrial"], p=[0.6, 0.3, 0.1])
        
        if category == "Residential":
            base_load = 1.5 + (0.8 if 18 <= hour <= 22 or 6 <= hour <= 9 else 0.0) + (0.3 if is_weekend else 0.0)
            conn_load = 4.0
        elif category == "Commercial":
            base_load = 8.0 + (6.0 if 9 <= hour <= 20 and not is_weekend else 1.0)
            conn_load = 18.0
        else: # Industrial
            base_load = 40.0 + (10.0 if not is_weekend else 2.0)
            conn_load = 75.0

        # Scenario assignment:
        # 78% Normal, 7% Abnormal, 5% Suspicious Load, 6% Possible Unauthorized, 4% Possible Tampering
        roll = np.random.rand()
        if roll < 0.78:
            label = "Normal"
            energy_kwh = max(0.1, np.random.normal(base_load, base_load * 0.12))
            expected_kwh = base_load
            power_factor = np.random.uniform(0.88, 0.98)
            anomaly_score = np.random.uniform(0.05, 0.28)
        elif roll < 0.85:
            label = "Abnormal"
            # Legitimate large usage (e.g. guest/event)
            energy_kwh = base_load * np.random.uniform(1.6, 2.3)
            expected_kwh = base_load
            power_factor = np.random.uniform(0.85, 0.95)
            anomaly_score = np.random.uniform(0.35, 0.55)
        elif roll < 0.90:
            label = "Suspicious Load Variation"
            # Erratic rapid spikes during quiet hours
            energy_kwh = base_load * np.random.uniform(2.2, 3.8)
            expected_kwh = base_load
            power_factor = np.random.uniform(0.72, 0.85)
            anomaly_score = np.random.uniform(0.60, 0.78)
        elif roll < 0.96:
            label = "Possible Unauthorized Consumption"
            # Severe unexplained drop (bypass) or massive unmetered tap
            if np.random.rand() > 0.5:
                energy_kwh = base_load * np.random.uniform(0.08, 0.25) # Meter bypass: meter records very low
            else:
                energy_kwh = base_load * np.random.uniform(2.8, 4.5) # Direct tap on feeder line
            expected_kwh = base_load
            power_factor = np.random.uniform(0.65, 0.82)
            anomaly_score = np.random.uniform(0.75, 0.95)
        else:
            label = "Possible Meter Tampering"
            # Low power factor, erratic readings
            energy_kwh = base_load * np.random.uniform(0.15, 0.40)
            expected_kwh = base_load
            power_factor = np.random.uniform(0.40, 0.68) # Abnormal phase angle / CT shunting
            anomaly_score = np.random.uniform(0.80, 0.98)

        deviation_pct = ((energy_kwh - expected_kwh) / expected_kwh) * 100.0
        ratio_to_load = energy_kwh / conn_load

        data.append({
            "timestamp": ts,
            "energy_kwh": energy_kwh,
            "expected_kwh": expected_kwh,
            "deviation_pct": deviation_pct,
            "anomaly_score": anomaly_score,
            "power_factor": power_factor,
            "hour": hour,
            "is_weekend": is_weekend,
            "ratio_to_load": ratio_to_load,
            "label": label
        })

    df = pd.DataFrame(data)
    
    # Chronological Split: First 80% train, last 20% test (mimics time-series deployment)
    split_idx = int(n_samples * 0.8)
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]

    feature_cols = ['energy_kwh', 'expected_kwh', 'deviation_pct', 'anomaly_score', 'power_factor', 'hour', 'is_weekend', 'ratio_to_load']
    X_train = train_df[feature_cols]
    y_train = train_df['label']
    
    X_test = test_df[feature_cols]
    y_test = test_df['label']

    rf = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, class_weight='balanced')
    rf.fit(X_train, y_train)

    y_pred = rf.predict(X_test)

    # Real Evaluation Metrics
    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, average='weighted', zero_division=0))
    rec = float(recall_score(y_test, y_pred, average='weighted', zero_division=0))
    f1 = float(f1_score(y_test, y_pred, average='weighted', zero_division=0))

    cm = confusion_matrix(y_test, y_pred, labels=CLASSES)
    
    # Calculate False Positive Rate for Normal class
    # Normal is index 0
    tn = cm[1:, 1:].sum()
    fp = cm[0, 1:].sum()
    fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0

    eval_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cm_dict = {
        "labels": CLASSES,
        "matrix": cm.tolist()
    }
    
    report_dict = classification_report(y_test, y_pred, labels=CLASSES, output_dict=True, zero_division=0)

    # Persist in Model_Performance table
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO Model_Performance (
        model_name, evaluation_date, dataset_type, accuracy, precision, recall, f1_score,
        false_positive_rate, confusion_matrix_json, classification_report_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        "Random Forest Classifier (Multi-Class)",
        eval_date,
        "Synthetic Labeled Benchmark (Held-out Chronological Split)",
        round(acc, 4),
        round(prec, 4),
        round(rec, 4),
        round(f1, 4),
        round(fpr, 4),
        json.dumps(cm_dict),
        json.dumps(report_dict)
    ))
    conn.commit()

    return {
        "status": "success",
        "model_name": "Random Forest Classifier",
        "dataset_type": "Synthetic Labeled Benchmark (Chronological Split: 80% Train, 20% Held-out Test)",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "false_positive_rate": round(fpr, 4),
        "confusion_matrix": cm_dict,
        "evaluation_date": eval_date
    }
