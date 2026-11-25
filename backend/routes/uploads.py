import sqlite3
import io
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response

from backend.database import get_db

router = APIRouter(prefix="/api/uploads", tags=["CSV Upload"])


SAMPLE_CSV_CONTENT = """timestamp,consumer_id,meter_id,category,feeder_id,transformer_id,voltage,current,power,energy_kwh,power_factor,connected_load_capacity
2026-11-20 08:00:00,CON-RES-101,MTR-RES-101,Residential,FDR-NORTH-01,TR-102,231.2,5.2,1.15,1.15,0.95,3.0
2026-11-20 09:00:00,CON-RES-101,MTR-RES-101,Residential,FDR-NORTH-01,TR-102,230.8,6.1,1.38,1.38,0.96,3.0
2026-11-20 08:00:00,CON-COM-201,MTR-COM-201,Commercial,FDR-NORTH-01,TR-102,414.5,12.8,7.80,7.80,0.93,12.0
2026-11-20 09:00:00,CON-COM-201,MTR-COM-201,Commercial,FDR-NORTH-01,TR-102,415.0,14.5,8.95,8.95,0.94,12.0
2026-11-20 08:00:00,CON-IND-301,MTR-IND-301,Industrial,FDR-NORTH-01,TR-101,416.0,65.2,42.50,42.50,0.91,75.0
"""


def read_csv_file(content):
    try:
        df = pd.read_csv(io.BytesIO(content))
        df.columns = df.columns.astype(str).str.strip().str.lower()

        # Support alternate dataset column names
        aliases = {
            "voltage_v": "voltage",
            "current_a": "current"
        }

        for old, new in aliases.items():
            if old in df.columns and new not in df.columns:
                df[new] = df[old]

        return df

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV: {str(e)}"
        )


def get_text(row, column, default):
    value = row.get(column, default)

    if pd.isna(value) or str(value).strip() == "":
        return str(default)

    return str(value).strip()


def get_number(row, column, default=None):
    value = row.get(column, default)

    if pd.isna(value):
        return default

    try:
        return float(value)
    except (ValueError, TypeError):
        return default


@router.get("/template")
def download_template():
    return Response(
        content=SAMPLE_CSV_CONTENT,
        media_type="text/csv",
        headers={
            "Content-Disposition":
            "attachment; filename=voltguard_sample_readings_template.csv"
        }
    )


@router.post("/preview")
async def preview_csv(file: UploadFile = File(...)):

    if not file.filename.lower().endswith((".csv", ".txt")):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported."
        )

    content = await file.read()
    df = read_csv_file(content)

    columns = list(df.columns)
    capabilities = []

    if all(c in columns for c in [
        "timestamp", "consumer_id", "energy_kwh"
    ]):
        capabilities.extend([
            "Consumer-level Normal Consumption Baseline Learning",
            "Isolation Forest Anomaly Detection",
            "Temporal Consumption Trend Analysis"
        ])

    if "transformer_id" in columns and "energy_kwh" in columns:
        capabilities.append(
            "Transformer Aggregation & Discrepancy Analysis"
        )

    if "feeder_id" in columns and "energy_kwh" in columns:
        capabilities.append("Feeder Energy Accounting")

    if "power_factor" in columns:
        capabilities.append(
            "Power Factor Tampering & Reactive Power Analysis"
        )

    return {
        "filename": file.filename,
        "total_rows_detected": len(df),
        "columns": columns,
        "preview": df.head(10).fillna("").to_dict(orient="records"),
        "supported_analyses": capabilities,
        "missing_essential_columns": [
            c for c in [
                "timestamp", "consumer_id", "energy_kwh"
            ] if c not in columns
        ]
    }


@router.post("/process")
async def process_csv(file: UploadFile = File(...)):

    if not file.filename.lower().endswith((".csv", ".txt")):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported."
        )

    content = await file.read()
    df = read_csv_file(content)

    required_cols = [
        "timestamp",
        "consumer_id",
        "energy_kwh"
    ]

    missing = [c for c in required_cols if c not in df.columns]

    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing mandatory columns: {', '.join(missing)}"
        )

    initial_count = len(df)
    warnings = []

    df = df.dropna(subset=required_cols).copy()

    df["consumer_id"] = df["consumer_id"].astype(str).str.strip()

    df["timestamp"] = pd.to_datetime(
        df["timestamp"], errors="coerce"
    )

    df["energy_kwh"] = pd.to_numeric(
        df["energy_kwh"], errors="coerce"
    )

    df = df.dropna(
        subset=["timestamp", "energy_kwh"]
    )

    df = df[df["consumer_id"] != ""]

    if (df["energy_kwh"] < 0).any():
        raise HTTPException(
            status_code=400,
            detail="Energy consumption cannot be negative."
        )

    before_duplicates = len(df)

    df = df.drop_duplicates(
        subset=["timestamp", "consumer_id"],
        keep="last"
    )

    if len(df) < before_duplicates:
        warnings.append(
            f"Removed {before_duplicates - len(df)} duplicate readings."
        )

    if len(df) == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid readings found."
        )

    valid_rows = len(df)

    try:

        with get_db() as conn:

            cursor = conn.cursor()

            # STEP 1: Create feeder records

            feeder_records = {}

            for _, row in df.iterrows():

                fid = get_text(
                    row, "feeder_id", "FDR-DEFAULT"
                )

                feeder_records[fid] = (
                    fid,
                    f"Feeder {fid}",
                    "Imported Location",
                    500.0,
                    "Operational"
                )

            cursor.executemany("""
                INSERT OR IGNORE INTO Feeders (
                    feeder_id,
                    name,
                    location,
                    capacity_kva,
                    status
                ) VALUES (?, ?, ?, ?, ?)
            """, list(feeder_records.values()))

            # STEP 2: Create transformer records

            transformer_records = {}

            for _, row in df.iterrows():

                fid = get_text(
                    row, "feeder_id", "FDR-DEFAULT"
                )

                tid = get_text(
                    row, "transformer_id", "TR-DEFAULT"
                )

                if tid in transformer_records:
                    if transformer_records[tid][1] != fid:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"Transformer {tid} is mapped "
                                f"to multiple feeders."
                            )
                        )

                transformer_records[tid] = (
                    tid,
                    fid,
                    f"Transformer {tid}",
                    "Imported Location",
                    250.0,
                    "Operational"
                )

            cursor.executemany("""
                INSERT OR IGNORE INTO Transformers (
                    transformer_id,
                    feeder_id,
                    name,
                    location,
                    capacity_kva,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, list(transformer_records.values()))

            # STEP 3: Register consumers

            consumer_records = {}

            for _, row in df.iterrows():

                cid = get_text(row, "consumer_id", "")
                fid = get_text(
                    row, "feeder_id", "FDR-DEFAULT"
                )
                tid = get_text(
                    row, "transformer_id", "TR-DEFAULT"
                )

                category = get_text(
                    row, "category", "Residential"
                )

                meter = get_text(
                    row, "meter_id", f"MTR-{cid}"
                )

                load = get_number(
                    row, "connected_load_capacity", 5.0
                )

                consumer_records[cid] = (
                    cid,
                    f"Consumer {cid}",
                    meter,
                    category,
                    "Imported Location",
                    load,
                    fid,
                    tid,
                    datetime.now().strftime("%Y-%m-%d"),
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                )

            cursor.executemany("""
                INSERT OR IGNORE INTO Consumers (
                    consumer_id,
                    name,
                    meter_id,
                    category,
                    location,
                    connected_load_capacity,
                    feeder_id,
                    transformer_id,
                    registration_date,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, list(consumer_records.values()))

            # STEP 4: Check registered consumers

            consumer_ids = list(consumer_records.keys())

            placeholders = ",".join(
                ["?"] * len(consumer_ids)
            )

            registered = cursor.execute(
                f"""
                SELECT consumer_id
                FROM Consumers
                WHERE consumer_id IN ({placeholders})
                """,
                consumer_ids
            ).fetchall()

            registered_ids = {
                row["consumer_id"] for row in registered
            }

            missing_consumers = (
                set(consumer_ids) - registered_ids
            )

            if missing_consumers:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Could not register consumers: "
                        + ", ".join(sorted(missing_consumers))
                    )
                )

            # STEP 5: Insert electricity readings

            existing = cursor.execute("""
                SELECT consumer_id, timestamp
                FROM Electricity_Readings
            """).fetchall()

            existing_readings = {
                (r["consumer_id"], r["timestamp"])
                for r in existing
            }

            readings_records = []

            for _, row in df.iterrows():

                cid = get_text(row, "consumer_id", "")

                timestamp = row["timestamp"].strftime(
                    "%Y-%m-%d %H:%M:%S"
                )

                key = (cid, timestamp)

                if key in existing_readings:
                    continue

                meter = get_text(
                    row, "meter_id", f"MTR-{cid}"
                )

                readings_records.append((
                    timestamp,
                    cid,
                    meter,
                    get_number(row, "voltage"),
                    get_number(row, "current"),
                    get_number(row, "power"),
                    float(row["energy_kwh"]),
                    get_number(row, "power_factor", 0.92),
                    get_number(
                        row, "connected_load_capacity", 5.0
                    ),
                    0
                ))

                existing_readings.add(key)

            cursor.executemany("""
                INSERT INTO Electricity_Readings (
                    timestamp,
                    consumer_id,
                    meter_id,
                    voltage,
                    current,
                    power,
                    energy_kwh,
                    power_factor,
                    connected_load_capacity,
                    is_simulated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, readings_records)

            # STEP 6: Insert feeder input readings

            if "feeder_input_kwh" in df.columns:

                feeder_existing_rows = cursor.execute("""
                    SELECT feeder_id, timestamp
                    FROM Feeder_Readings
                """).fetchall()

                feeder_existing = {
                    (r["feeder_id"], r["timestamp"])
                    for r in feeder_existing_rows
                }

                feeder_readings = []

                for _, row in df.iterrows():

                    fid = get_text(
                        row, "feeder_id", "FDR-DEFAULT"
                    )

                    timestamp = row["timestamp"].strftime(
                        "%Y-%m-%d %H:%M:%S"
                    )

                    key = (fid, timestamp)

                    if key in feeder_existing:
                        continue

                    feeder_input = get_number(
                        row, "feeder_input_kwh"
                    )

                    if feeder_input is None:
                        continue

                    feeder_readings.append((
                        fid,
                        timestamp,
                        feeder_input,
                        0
                    ))

                    feeder_existing.add(key)

                cursor.executemany("""
                    INSERT INTO Feeder_Readings (
                        feeder_id,
                        timestamp,
                        input_energy_kwh,
                        is_simulated
                    ) VALUES (?, ?, ?, ?)
                """, feeder_readings)

            # STEP 7: Save upload history

            imported_count = len(readings_records)

            cursor.execute("""
                INSERT INTO Uploaded_Datasets (
                    filename,
                    upload_timestamp,
                    row_count,
                    valid_rows,
                    status,
                    notes
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                file.filename,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                initial_count,
                imported_count,
                "Success" if not warnings else "Success with Warnings",
                "; ".join(warnings) if warnings else "Clean upload."
            ))

        return {
            "status": "success",
            "message": "Dataset successfully ingested into SQLite.",
            "filename": file.filename,
            "total_rows_received": initial_count,
            "valid_rows": valid_rows,
            "new_readings_imported": imported_count,
            "duplicate_readings_skipped": valid_rows - imported_count,
            "validation_warnings": warnings
        }

    except HTTPException:
        raise

    except sqlite3.IntegrityError as e:
        print("VOLTGUARD SQLITE ERROR:", repr(e))

        raise HTTPException(
            status_code=400,
            detail=f"SQLite integrity error: {str(e)}"
        )

    except Exception as e:
        print("VOLTGUARD INGESTION ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail=f"Dataset ingestion failed: {str(e)}"
        )


@router.get("/history")
def get_upload_history():

    with get_db() as conn:

        cursor = conn.cursor()

        cursor.execute("""
            SELECT *
            FROM Uploaded_Datasets
            ORDER BY upload_timestamp DESC
        """)

        return [dict(row) for row in cursor.fetchall()]