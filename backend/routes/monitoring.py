from fastapi import APIRouter
from backend.database import get_db
from backend.services.energy_analysis import compute_feeder_discrepancy, compute_transformer_discrepancy
from typing import Dict, Any, List

router = APIRouter(prefix="/api/monitoring", tags=["Energy Monitoring"])

@router.get("/financial-exposure")
def get_financial_exposure():
    with get_db() as conn:
        cursor = conn.cursor()

        # Get configured tariff
        cursor.execute("SELECT value FROM System_Settings WHERE key = 'default_tariff_inr';")
        tariff_row = cursor.fetchone()
        tariff = float(tariff_row["value"]) if tariff_row else 7.50

        # Feeder level summary
        cursor.execute("SELECT feeder_id FROM Feeders;")
        feeder_ids = [r["feeder_id"] for r in cursor.fetchall()]
        feeder_exposures = []
        total_feeder_unaccounted = 0.0

        for fid in feeder_ids:
            res = compute_feeder_discrepancy(conn, fid)
            unacc = max(0.0, res.get("unaccounted_energy_kwh", 0.0))
            total_feeder_unaccounted += unacc
            feeder_exposures.append({
                "feeder_id": fid,
                "name": res.get("name"),
                "unaccounted_kwh": unacc,
                "discrepancy_pct": res.get("discrepancy_pct", 0.0),
                "estimated_exposure_inr": round(unacc * tariff, 2),
                "status": res.get("status")
            })

        # Transformer level summary
        cursor.execute("SELECT transformer_id FROM Transformers;")
        tr_ids = [r["transformer_id"] for r in cursor.fetchall()]
        tr_exposures = []
        total_tr_unaccounted = 0.0

        for tid in tr_ids:
            res = compute_transformer_discrepancy(conn, tid)
            unacc = max(0.0, res.get("discrepancy_kwh", 0.0))
            total_tr_unaccounted += unacc
            tr_exposures.append({
                "transformer_id": tid,
                "feeder_id": res.get("feeder_id"),
                "name": res.get("name"),
                "unaccounted_kwh": unacc,
                "discrepancy_pct": res.get("discrepancy_pct", 0.0),
                "estimated_exposure_inr": round(unacc * tariff, 2),
                "priority_level": res.get("priority_level"),
                "suspicious_consumers": res.get("suspicious_consumers", 0)
            })

        # Sort transformers by estimated exposure descending
        tr_exposures.sort(key=lambda x: x["estimated_exposure_inr"], reverse=True)

        return {
            "assumed_tariff_inr_per_kwh": tariff,
            "total_unaccounted_energy_kwh": round(total_tr_unaccounted, 2),
            "total_financial_exposure_inr": round(total_tr_unaccounted * tariff, 2),
            "feeder_wise_exposure": feeder_exposures,
            "transformer_wise_exposure": tr_exposures,
            "notes": "Estimated financial exposure assumes constant configured tariff. Unaccounted energy reflects line losses, measurement variances, and potential unauthorized usage."
        }

@router.get("/network-overview")
def get_network_overview():
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT COALESCE(SUM(input_energy_kwh), 0.0) as total_fdr_in FROM Feeder_Readings;")
        total_fdr_input = float(cursor.fetchone()["total_fdr_in"])

        cursor.execute("SELECT COALESCE(SUM(input_energy_kwh), 0.0) as total_tr_in FROM Transformer_Readings;")
        total_tr_input = float(cursor.fetchone()["total_tr_in"])

        cursor.execute("SELECT COALESCE(SUM(energy_kwh), 0.0) as total_cons_kwh FROM Electricity_Readings;")
        total_cons_metered = float(cursor.fetchone()["total_cons_kwh"])

        transmission_loss_kwh = max(0.0, total_fdr_input - total_tr_input)
        distribution_loss_kwh = max(0.0, total_tr_input - total_cons_metered)
        total_loss_kwh = max(0.0, total_fdr_input - total_cons_metered)

        transmission_loss_pct = round((transmission_loss_kwh / total_fdr_input * 100), 2) if total_fdr_input > 0 else 0.0
        distribution_loss_pct = round((distribution_loss_kwh / total_tr_input * 100), 2) if total_tr_input > 0 else 0.0
        overall_loss_pct = round((total_loss_kwh / total_fdr_input * 100), 2) if total_fdr_input > 0 else 0.0

        return {
            "total_feeder_input_kwh": round(total_fdr_input, 2),
            "total_transformer_output_kwh": round(total_tr_input, 2),
            "total_consumer_metered_kwh": round(total_cons_metered, 2),
            "transmission_loss_kwh": round(transmission_loss_kwh, 2),
            "transmission_loss_pct": transmission_loss_pct,
            "distribution_unaccounted_kwh": round(distribution_loss_kwh, 2),
            "distribution_unaccounted_pct": distribution_loss_pct,
            "total_system_unaccounted_kwh": round(total_loss_kwh, 2),
            "overall_loss_pct": overall_loss_pct,
            "health_status": "Attention Required" if overall_loss_pct > 10.0 else "Stable"
        }
