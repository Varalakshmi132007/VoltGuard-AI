import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voltguard.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Feeders
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Feeders (
            feeder_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            capacity_kva REAL NOT NULL,
            status TEXT DEFAULT 'Operational'
        );
        """)

        # 2. Transformers
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Transformers (
            transformer_id TEXT PRIMARY KEY,
            feeder_id TEXT NOT NULL,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            capacity_kva REAL NOT NULL,
            status TEXT DEFAULT 'Operational',
            FOREIGN KEY (feeder_id) REFERENCES Feeders (feeder_id) ON DELETE CASCADE
        );
        """)

        # 3. Consumers
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Consumers (
            consumer_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            meter_id TEXT UNIQUE NOT NULL,
            category TEXT NOT NULL, -- Residential, Commercial, Industrial
            location TEXT NOT NULL,
            connected_load_capacity REAL NOT NULL, -- in kW
            feeder_id TEXT NOT NULL,
            transformer_id TEXT NOT NULL,
            registration_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (feeder_id) REFERENCES Feeders (feeder_id) ON DELETE CASCADE,
            FOREIGN KEY (transformer_id) REFERENCES Transformers (transformer_id) ON DELETE CASCADE
        );
        """)

        # 4. Electricity Readings
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Electricity_Readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            consumer_id TEXT NOT NULL,
            meter_id TEXT NOT NULL,
            voltage REAL,
            current REAL,
            power REAL,
            energy_kwh REAL NOT NULL,
            power_factor REAL,
            connected_load_capacity REAL,
            is_simulated INTEGER DEFAULT 0,
            FOREIGN KEY (consumer_id) REFERENCES Consumers (consumer_id) ON DELETE CASCADE
        );
        """)

        # 5. Feeder Readings
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Feeder_Readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feeder_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            input_energy_kwh REAL NOT NULL,
            is_simulated INTEGER DEFAULT 0,
            FOREIGN KEY (feeder_id) REFERENCES Feeders (feeder_id) ON DELETE CASCADE
        );
        """)

        # 6. Transformer Readings
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Transformer_Readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transformer_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            input_energy_kwh REAL NOT NULL,
            is_simulated INTEGER DEFAULT 0,
            FOREIGN KEY (transformer_id) REFERENCES Transformers (transformer_id) ON DELETE CASCADE
        );
        """)

        # 7. Anomaly Detections
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Anomaly_Detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reading_id INTEGER,
            consumer_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            actual_kwh REAL NOT NULL,
            expected_kwh REAL NOT NULL,
            deviation_pct REAL NOT NULL,
            anomaly_score REAL NOT NULL,
            is_anomaly INTEGER NOT NULL,
            detection_result TEXT NOT NULL,
            explanation TEXT NOT NULL,
            model_name TEXT DEFAULT 'Isolation Forest',
            FOREIGN KEY (consumer_id) REFERENCES Consumers (consumer_id) ON DELETE CASCADE,
            FOREIGN KEY (reading_id) REFERENCES Electricity_Readings (id) ON DELETE SET NULL
        );
        """)

        # 8. Theft Alerts
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Theft_Alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_code TEXT UNIQUE NOT NULL,
            consumer_id TEXT NOT NULL,
            feeder_id TEXT NOT NULL,
            transformer_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            actual_kwh REAL NOT NULL,
            expected_kwh REAL NOT NULL,
            anomaly_score REAL NOT NULL,
            risk_score REAL NOT NULL,
            risk_level TEXT NOT NULL,
            explanation TEXT NOT NULL,
            investigation_status TEXT DEFAULT 'Pending Investigation',
            notes TEXT,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (consumer_id) REFERENCES Consumers (consumer_id) ON DELETE CASCADE,
            FOREIGN KEY (feeder_id) REFERENCES Feeders (feeder_id) ON DELETE CASCADE,
            FOREIGN KEY (transformer_id) REFERENCES Transformers (transformer_id) ON DELETE CASCADE
        );
        """)

        # 9. Model Performance
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Model_Performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_name TEXT NOT NULL,
            evaluation_date TEXT NOT NULL,
            dataset_type TEXT NOT NULL,
            accuracy REAL NOT NULL,
            precision REAL NOT NULL,
            recall REAL NOT NULL,
            f1_score REAL NOT NULL,
            false_positive_rate REAL NOT NULL,
            confusion_matrix_json TEXT NOT NULL,
            classification_report_json TEXT
        );
        """)

        # 10. Uploaded Datasets
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Uploaded_Datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            upload_timestamp TEXT NOT NULL,
            row_count INTEGER NOT NULL,
            valid_rows INTEGER NOT NULL,
            status TEXT NOT NULL,
            notes TEXT
        );
        """)

        # 11. Investigation Records
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS Investigation_Records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_id INTEGER NOT NULL,
            updated_by TEXT NOT NULL,
            previous_status TEXT NOT NULL,
            new_status TEXT NOT NULL,
            remarks TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (alert_id) REFERENCES Theft_Alerts (id) ON DELETE CASCADE
        );
        """)

        # 12. System Settings
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS System_Settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT
        );
        """)

        # Seed default settings if not exists
        default_settings = [
            ('default_tariff_inr', '7.50', 'Assumed electricity tariff in INR per kWh for financial exposure estimation'),
            ('anomaly_contamination', '0.08', 'Expected contamination rate for Isolation Forest model'),
            ('critical_risk_threshold', '80.0', 'Threshold score for Critical Risk ranking (0-100)'),
            ('high_risk_threshold', '60.0', 'Threshold score for High Risk ranking (0-100)'),
            ('medium_risk_threshold', '30.0', 'Threshold score for Medium Risk ranking (0-100)')
        ]
        cursor.executemany("""
        INSERT OR IGNORE INTO System_Settings (key, value, description)
        VALUES (?, ?, ?);
        """, default_settings)

        # Performance indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_cid_ts ON Electricity_Readings (consumer_id, timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_ts ON Electricity_Readings (timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_feeder_readings_ts ON Feeder_Readings (feeder_id, timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tr_readings_ts ON Transformer_Readings (transformer_id, timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_status ON Theft_Alerts (investigation_status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_cid ON Theft_Alerts (consumer_id);")
