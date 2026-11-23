import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import sqlite3
from typing import Dict, List, Any, Tuple
from datetime import datetime
from backend.services.explanation import generate_consumer_explanation

class ConsumerBaselineEngine:
    def __init__(self):
        # Cache for consumer specific baselines: {consumer_id: {(hour, is_weekend): (mean_kwh, std_kwh)}}
        self.baselines: Dict[str, Dict[Tuple[int, bool], Tuple[float, float]]] = {}
        self.consumer_means: Dict[str, float] = {}
        self.category_defaults = {
            "Residential": 1.4,
            "Commercial": 8.5,
            "Industrial": 45.0
        }

    def compute_baselines(self, conn: sqlite3.Connection):
        """
        Learns consumer-specific normal historical consumption patterns
        stratified by consumer_id, hour_of_day, and weekday/weekend.
        """
        query = """
        SELECT r.consumer_id, c.category, c.connected_load_capacity, r.timestamp, r.energy_kwh
        FROM Electricity_Readings r
        JOIN Consumers c ON r.consumer_id = c.consumer_id
        ORDER BY r.timestamp ASC
        """
        df = pd.read_sql_query(query, conn)
        if df.empty:
            return

        df['dt'] = pd.to_datetime(df['timestamp'])
        df['hour'] = df['dt'].dt.hour
        df['is_weekend'] = df['dt'].dt.dayofweek >= 5

        # Group by consumer, hour, weekend
        grouped = df.groupby(['consumer_id', 'hour', 'is_weekend'])['energy_kwh'].agg(['mean', 'std']).reset_index()

        self.baselines.clear()
        for _, row in grouped.iterrows():
            cid = str(row['consumer_id'])
            h = int(row['hour'])
            w = bool(row['is_weekend'])
            mean_val = float(row['mean'])
            std_val = float(row['std']) if not np.isnan(row['std']) and row['std'] > 0 else (mean_val * 0.15)
            
            if cid not in self.baselines:
                self.baselines[cid] = {}
            self.baselines[cid][(h, w)] = (mean_val, std_val)

        # Store overall consumer means
        c_means = df.groupby('consumer_id')['energy_kwh'].mean().to_dict()
        self.consumer_means = {str(k): float(v) for k, v in c_means.items()}

    def get_expected_kwh(self, consumer_id: str, category: str, hour: int, is_weekend: bool) -> float:
        """
        Returns expected consumption baseline for an individual consumer at a given time window.
        """
        if consumer_id in self.baselines and (hour, is_weekend) in self.baselines[consumer_id]:
            return max(0.05, self.baselines[consumer_id][(hour, is_weekend)][0])
        elif consumer_id in self.consumer_means:
            return max(0.05, self.consumer_means[consumer_id])
        return self.category_defaults.get(category, 2.0)

# Global baseline engine instance
baseline_engine = ConsumerBaselineEngine()

class IsolationForestAnomalyDetector:
    def __init__(self, contamination: float = 0.08):
        self.contamination = contamination
        self.model = IsolationForest(
            n_estimators=120,
            contamination=self.contamination,
            random_state=42,
            bootstrap=True
        )
        self.is_fitted = False

    def train_and_evaluate(self, conn: sqlite3.Connection) -> Dict[str, Any]:
        """
        Trains Isolation Forest using engineered features that evaluate
        consumption against individual baselines rather than a fixed global threshold.
        """
        baseline_engine.compute_baselines(conn)

        query = """
        SELECT r.id, r.timestamp, r.consumer_id, r.meter_id, r.energy_kwh, r.power_factor,
               c.category, c.connected_load_capacity, c.feeder_id, c.transformer_id
        FROM Electricity_Readings r
        JOIN Consumers c ON r.consumer_id = c.consumer_id
        ORDER BY r.timestamp ASC
        """
        df = pd.read_sql_query(query, conn)
        if len(df) < 20:
            return {"status": "insufficient_data", "count": len(df)}

        df['dt'] = pd.to_datetime(df['timestamp'])
        df['hour'] = df['dt'].dt.hour
        df['day_of_week'] = df['dt'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'] >= 5

        # Compute consumer-specific expected baseline for each row
        expected_list = []
        deviation_pct_list = []
        ratio_to_load_list = []

        for _, row in df.iterrows():
            exp = baseline_engine.get_expected_kwh(
                row['consumer_id'], row['category'], row['hour'], row['is_weekend']
            )
            act = float(row['energy_kwh'])
            dev_pct = ((act - exp) / exp) * 100.0 if exp > 0 else 0.0
            load_cap = float(row['connected_load_capacity']) if row['connected_load_capacity'] else 5.0
            ratio_load = act / load_cap if load_cap > 0 else 0.5

            expected_list.append(exp)
            deviation_pct_list.append(dev_pct)
            ratio_to_load_list.append(ratio_load)

        df['expected_kwh'] = expected_list
        df['deviation_pct'] = deviation_pct_list
        df['ratio_to_load'] = ratio_to_load_list
        df['power_factor'] = df['power_factor'].fillna(0.92)

        # Features: energy_kwh, hour, is_weekend, ratio_to_expected, ratio_to_load, power_factor
        X = df[['energy_kwh', 'hour', 'is_weekend', 'deviation_pct', 'ratio_to_load', 'power_factor']].copy()
        X['is_weekend'] = X['is_weekend'].astype(int)

        self.model.fit(X)
        self.is_fitted = True

        # Predictions: -1 for anomaly, 1 for normal
        raw_preds = self.model.predict(X)
        # raw decision function: lower = more abnormal
        raw_scores = self.model.decision_function(X)

        # Normalize score to 0..1 where 1 is highest anomaly probability
        # typically decision_function ranges from -0.3 to +0.3
        norm_scores = 1.0 / (1.0 + np.exp(raw_scores * 10.0))

        # Store detections back into Anomaly_Detections table
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Anomaly_Detections WHERE model_name = 'Isolation Forest';")

        detected_count = 0
        records = []
        for i, row in df.iterrows():
            is_anomaly = 1 if raw_preds[i] == -1 else 0
            score = float(norm_scores[i])
            act = float(row['energy_kwh'])
            exp = float(row['expected_kwh'])
            dev = float(row['deviation_pct'])

            # Determine specific detection category
            if is_anomaly:
                detected_count += 1
                if dev > 80:
                    det_type = "Sudden Consumption Surge"
                elif dev < -60:
                    det_type = "Unusual Consumption Drop"
                elif row['power_factor'] < 0.70:
                    det_type = "Suspicious Load Factor Anomaly"
                elif (row['hour'] < 6 or row['hour'] > 22) and act > (exp * 2):
                    det_type = "Off-Hours Abnormal Load"
                else:
                    det_type = "Historical Pattern Deviation"
            else:
                det_type = "Normal Pattern"

            expl = generate_consumer_explanation(
                consumer_id=row['consumer_id'],
                category=row['category'],
                connected_load=float(row['connected_load_capacity']),
                actual_kwh=act,
                expected_kwh=exp,
                deviation_pct=dev,
                activity_type=det_type,
                hour=int(row['hour']),
                is_weekend=bool(row['is_weekend'])
            )

            records.append((
                int(row['id']),
                str(row['consumer_id']),
                str(row['timestamp']),
                act,
                round(exp, 2),
                round(dev, 2),
                round(score, 4),
                is_anomaly,
                det_type,
                expl,
                'Isolation Forest'
            ))

        cursor.executemany("""
        INSERT INTO Anomaly_Detections (
            reading_id, consumer_id, timestamp, actual_kwh, expected_kwh,
            deviation_pct, anomaly_score, is_anomaly, detection_result, explanation, model_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, records)
        conn.commit()

        return {
            "status": "success",
            "total_readings_analyzed": len(df),
            "anomalies_detected": detected_count,
            "anomaly_rate_pct": round(detected_count / len(df) * 100, 2),
            "model_type": "Isolation Forest (Scikit-Learn)",
            "contamination_parameter": self.contamination
        }
