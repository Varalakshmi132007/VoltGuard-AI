import sqlite3
from typing import Dict, Any, List

def compute_feeder_discrepancy(conn: sqlite3.Connection, feeder_id: str, start_time: str = None, end_time: str = None) -> Dict[str, Any]:
    """
    Computes feeder-level input vs accounted transformer energy over matching time periods.
    """
    cursor = conn.cursor()
    
    # Get Feeder Details
    cursor.execute("SELECT feeder_id, name, location, capacity_kva FROM Feeders WHERE feeder_id = ?", (feeder_id,))
    feeder = cursor.fetchone()
    if not feeder:
        return {}

    # Time filter clause
    where_fdr = "WHERE feeder_id = ?"
    where_tr = "WHERE t.feeder_id = ?"
    params_fdr = [feeder_id]
    params_tr = [feeder_id]

    if start_time and end_time:
        where_fdr += " AND timestamp BETWEEN ? AND ?"
        where_tr += " AND tr.timestamp BETWEEN ? AND ?"
        params_fdr.extend([start_time, end_time])
        params_tr.extend([start_time, end_time])

    # Feeder Input Energy
    cursor.execute(f"SELECT COALESCE(SUM(input_energy_kwh), 0.0) as total_input FROM Feeder_Readings {where_fdr}", params_fdr)
    feeder_input = float(cursor.fetchone()["total_input"])

    # Sum of Transformer Readings for this Feeder
    cursor.execute(f"""
        SELECT COALESCE(SUM(tr.input_energy_kwh), 0.0) as total_tr_output
        FROM Transformer_Readings tr
        JOIN Transformers t ON tr.transformer_id = t.transformer_id
        {where_tr}
    """, params_tr)
    transformer_accounted = float(cursor.fetchone()["total_tr_output"])

    unaccounted_energy = round(feeder_input - transformer_accounted, 2)
    discrepancy_pct = round((unaccounted_energy / feeder_input * 100), 2) if feeder_input > 0 else 0.0

    # Get connected transformers count
    cursor.execute("SELECT COUNT(*) as tr_count FROM Transformers WHERE feeder_id = ?", (feeder_id,))
    tr_count = cursor.fetchone()["tr_count"]

    # Technical losses baseline is ~3-5% for standard distribution
    is_suspicious = discrepancy_pct > 8.0

    return {
        "feeder_id": feeder["feeder_id"],
        "name": feeder["name"],
        "location": feeder["location"],
        "capacity_kva": feeder["capacity_kva"],
        "input_energy_kwh": round(feeder_input, 2),
        "total_accounted_energy_kwh": round(transformer_accounted, 2),
        "unaccounted_energy_kwh": unaccounted_energy,
        "discrepancy_pct": discrepancy_pct,
        "connected_transformers": tr_count,
        "is_suspicious": is_suspicious,
        "status": "High Discrepancy" if discrepancy_pct > 10 else ("Elevated" if discrepancy_pct > 6 else "Normal"),
        "notes": "Unaccounted energy includes technical transmission loss (~3-5%), measurement errors, and potential unmetered taps."
    }

def compute_transformer_discrepancy(conn: sqlite3.Connection, transformer_id: str, start_time: str = None, end_time: str = None) -> Dict[str, Any]:
    """
    Computes transformer input energy vs downstream consumer meter energy for matching intervals.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT transformer_id, feeder_id, name, location, capacity_kva FROM Transformers WHERE transformer_id = ?", (transformer_id,))
    tr = cursor.fetchone()
    if not tr:
        return {}

    where_tr = "WHERE transformer_id = ?"
    where_c = "WHERE c.transformer_id = ?"
    params_tr = [transformer_id]
    params_c = [transformer_id]

    if start_time and end_time:
        where_tr += " AND timestamp BETWEEN ? AND ?"
        where_c += " AND r.timestamp BETWEEN ? AND ?"
        params_tr.extend([start_time, end_time])
        params_c.extend([start_time, end_time])

    # Transformer Input Energy
    cursor.execute(f"SELECT COALESCE(SUM(input_energy_kwh), 0.0) as total_input FROM Transformer_Readings {where_tr}", params_tr)
    tr_input = float(cursor.fetchone()["total_input"])

    # Downstream Consumer Metered Energy
    cursor.execute(f"""
        SELECT COALESCE(SUM(r.energy_kwh), 0.0) as consumer_total
        FROM Electricity_Readings r
        JOIN Consumers c ON r.consumer_id = c.consumer_id
        {where_c}
    """, params_c)
    consumer_total = float(cursor.fetchone()["consumer_total"])

    discrepancy_kwh = round(tr_input - consumer_total, 2)
    discrepancy_pct = round((discrepancy_kwh / tr_input * 100), 2) if tr_input > 0 else 0.0

    # Count connected consumers
    cursor.execute("SELECT COUNT(*) as total_cons FROM Consumers WHERE transformer_id = ?", (transformer_id,))
    total_cons = cursor.fetchone()["total_cons"]

    # Count suspicious consumers (having unresolved or active alerts)
    cursor.execute("""
        SELECT COUNT(DISTINCT consumer_id) as susp_cons
        FROM Theft_Alerts
        WHERE transformer_id = ? AND investigation_status != 'False Alarm'
    """, (transformer_id,))
    susp_cons = cursor.fetchone()["susp_cons"]

    return {
        "transformer_id": tr["transformer_id"],
        "feeder_id": tr["feeder_id"],
        "name": tr["name"],
        "location": tr["location"],
        "capacity_kva": tr["capacity_kva"],
        "input_energy_kwh": round(tr_input, 2),
        "total_consumer_kwh": round(consumer_total, 2),
        "discrepancy_kwh": discrepancy_kwh,
        "discrepancy_pct": discrepancy_pct,
        "total_consumers": total_cons,
        "suspicious_consumers": susp_cons,
        "normal_consumers": max(0, total_cons - susp_cons),
        "priority_level": "Critical" if discrepancy_pct > 12.0 else ("High" if discrepancy_pct > 8.0 else ("Medium" if discrepancy_pct > 5.0 else "Low"))
    }
