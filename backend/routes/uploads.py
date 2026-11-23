from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from backend.database import get_db
import pandas as pd
import io
import re
from datetime import datetime
from typing import Dict, Any, List

router = APIRouter(prefix="/api/uploads", tags=["CSV Upload"])

SAMPLE_CSV_CONTENT = """timestamp,consumer_id,meter_id,category,feeder_id,transformer_id,voltage,current,power,energy_kwh,power_factor,connected_load_capacity
2026-11-20 08:00:00,CON-RES-101,MTR-RES-101,Residential,FDR-NORTH-01,TR-102,231.2,5.2,1.15,1.15,0.95,3.0
2026-11-20 09:00:00,CON-RES-101,MTR-RES-101,Residential,FDR-NORTH-01,TR-102,230.8,6.1,1.38,1.38,0.96,3.0
2026-11-20 08:00:00,CON-COM-201,MTR-COM-201,Commercial,FDR-NORTH-01,TR-102,414.5,12.8,7.80,7.80,0.93,12.0
2026-11-20 09:00:00,CON-COM-201,MTR-COM-201,Commercial,FDR-NORTH-01,TR-102,415.0,14.5,8.95,8.95,0.94,12.0
2026-11-20 08:00:00,CON-IND-301,MTR-IND-301,Industrial,FDR-NORTH-01,TR-101,416.0,65.2,42.50,42.50,0.91,75.0
"""

@router.get("/template")
def download_template():
    return Response(
        content=SAMPLE_CSV_CONTENT,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=voltguard_sample_readings_template.csv"}
    )

@router.post("/preview")
async def preview_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    preview_rows = df.head(10).to_dict(orient="records")
    columns = list(df.columns)
    
    # Assess capabilities based on available columns
    capabilities = []
    if "energy_kwh" in columns and "timestamp" in columns and "consumer_id" in columns:
        capabilities.append("Consumer-level Normal Consumption Baseline Learning")
        capabilities.append("Isolation Forest Anomaly Detection")
        capabilities.append("Temporal Consumption Trend Analysis")
    if "transformer_id" in columns and "energy_kwh" in columns:
        capabilities.append("Transformer Aggregation & Discrepancy Analysis")
    if "feeder_id" in columns and "energy_kwh" in columns:
        capabilities.append("Feeder Energy Accounting")
    if "power_factor" in columns:
        capabilities.append("Power Factor Tampering & Reactive Power Analysis")

    return {
        "filename": file.filename,
        "total_rows_detected": len(df),
        "columns": columns,
        "preview": preview_rows,
        "supported_analyses": capabilities,
        "missing_essential_columns": [col for col in ["timestamp", "consumer_id", "energy_kwh"] if col not in columns]
    }

@router.post("/process")
async def process_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    errors = []
    required_cols = ["timestamp", "consumer_id", "energy_kwh"]
    for col in required_cols:
        if col not in df.columns:
            errors.append(f"Missing mandatory column: '{col}'")

    if errors:
        return {
            "status": "error",
            "message": "Validation failed",
            "errors": errors,
            "total_rows": len(df),
            "valid_rows": 0
        }

    # Data validation
    initial_count = len(df)
    
    # Check nulls in essentials
    df_clean = df.dropna(subset=required_cols).copy()
    null_rows = initial_count - len(df_clean)
    if null_rows > 0:
        errors.append(f"Dropped {null_rows} rows with missing timestamp, consumer_id, or energy_kwh")

    # Validate timestamps
    try:
        df_clean['parsed_ts'] = pd.to_datetime(df_clean['timestamp'], errors='coerce')
        invalid_ts_count = df_clean['parsed_ts'].isna().sum()
        if invalid_ts_count > 0:
            errors.append(f"Found {invalid_ts_count} rows with invalid timestamp format")
            df_clean = df_clean.dropna(subset=['parsed_ts'])
    except Exception as e:
        errors.append(f"Timestamp validation error: {str(e)}")

    # Ensure energy_kwh is numeric
    df_clean['energy_kwh'] = pd.to_numeric(df_clean['energy_kwh'], errors='coerce')
    invalid_kwh = df_clean['energy_kwh'].isna().sum()
    if invalid_kwh > 0:
        errors.append(f"Found {invalid_kwh} rows with non-numeric energy_kwh")
        df_clean = df_clean.dropna(subset=['energy_kwh'])

    # Drop duplicates
    dup_count = df_clean.duplicated(subset=['timestamp', 'consumer_id']).sum()
    if dup_count > 0:
        errors.append(f"Removed {dup_count} duplicate timestamp readings for the same consumer")
        df_clean = df_clean.drop_duplicates(subset=['timestamp', 'consumer_id'])

    valid_rows = len(df_clean)

    # Store into SQLite
    with get_db() as conn:
        cursor = conn.cursor()

        # Check existing consumers or create them if provided
        existing_consumers = set(r["consumer_id"] for r in cursor.execute("SELECT consumer_id FROM Consumers").fetchall())
        new_consumer_ids = set(df_clean['consumer_id'].astype(str)) - existing_consumers

        if new_consumer_ids:
            # Auto-register new consumers if needed
            new_c_records = []
            for cid in new_consumer_ids:
                row_sample = df_clean[df_clean['consumer_id'] == cid].iloc[0]
                cat = str(row_sample.get('category', 'Residential')) if pd.notna(row_sample.get('category')) else 'Residential'
                fdr = str(row_sample.get('feeder_id', 'FDR-NORTH-01')) if pd.notna(row_sample.get('feeder_id')) else 'FDR-NORTH-01'
                tr = str(row_sample.get('transformer_id', 'TR-101')) if pd.notna(row_sample.get('transformer_id')) else 'TR-101'
                load = float(row_sample.get('connected_load_capacity', 5.0)) if pd.notna(row_sample.get('connected_load_capacity')) else 5.0
                meter = str(row_sample.get('meter_id', f"MTR-{cid}")) if pd.notna(row_sample.get('meter_id')) else f"MTR-{cid}"

                new_c_records.append((
                    cid, f"Consumer {cid}", meter, cat, "Imported Location",
                    load, fdr, tr, datetime.now().strftime("%Y-%m-%d"), datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                ))

            cursor.executemany("""
                INSERT OR IGNORE INTO Consumers (
                    consumer_id, name, meter_id, category, location,
                    connected_load_capacity, feeder_id, transformer_id, registration_date, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, new_c_records)

        # Insert readings
        readings_records = []
        for _, row in df_clean.iterrows():
            cid = str(row['consumer_id'])
            meter = str(row.get('meter_id', f"MTR-{cid}"))
            v = float(row['voltage']) if 'voltage' in row and pd.notna(row['voltage']) else None
            c = float(row['current']) if 'current' in row and pd.notna(row['current']) else None
            p = float(row['power']) if 'power' in row and pd.notna(row['power']) else float(row['energy_kwh'])
            pf = float(row['power_factor']) if 'power_factor' in row and pd.notna(row['power_factor']) else 0.92
            load = float(row['connected_load_capacity']) if 'connected_load_capacity' in row and pd.notna(row['connected_load_capacity']) else 5.0

            readings_records.append((
                str(row['timestamp']), cid, meter, v, c, p, float(row['energy_kwh']), pf, load, 0
            ))

        cursor.executemany("""
            INSERT INTO Electricity_Readings (
                timestamp, consumer_id, meter_id, voltage, current, power,
                energy_kwh, power_factor, connected_load_capacity, is_simulated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, readings_records)

        # Log upload in Uploaded_Datasets
        upload_status = "Success" if not errors else "Success with Warnings"
        notes_str = "; ".join(errors) if errors else "Clean upload, all checks passed."
        cursor.execute("""
            INSERT INTO Uploaded_Datasets (
                filename, upload_timestamp, row_count, valid_rows, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?);
        """, (
            file.filename, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), initial_count, valid_rows, upload_status, notes_str
        ))
        conn.commit()

    return {
        "status": "success",
        "message": f"Successfully processed {valid_rows} valid electricity readings from '{file.filename}'.",
        "filename": file.filename,
        "total_rows_received": initial_count,
        "valid_rows_imported": valid_rows,
        "validation_warnings": errors
    }

@router.get("/history")
def get_upload_history():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Uploaded_Datasets ORDER BY upload_timestamp DESC;")
        return [dict(r) for r in cursor.fetchall()]
