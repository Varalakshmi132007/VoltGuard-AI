from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import Response
from backend.database import get_db
from backend.services.report_generation import generate_report_data, export_report_to_csv

router = APIRouter(prefix="/api/reports", tags=["Reports"])

REPORT_TYPES = [
    "consumer_consumption",
    "daily_consumption",
    "weekly_consumption",
    "monthly_consumption",
    "suspicious_activity",
    "feeder_discrepancy",
    "transformer_discrepancy",
    "investigation_status"
]

@router.get("/data")
def get_report_data(report_type: str = Query(..., description="Type of report to fetch")):
    if report_type not in REPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report type. Supported: {', '.join(REPORT_TYPES)}"
        )

    with get_db() as conn:
        rows, headers = generate_report_data(conn, report_type)
        return {
            "report_type": report_type,
            "headers": headers,
            "total_records": len(rows),
            "data": rows
        }

@router.get("/export-csv")
def download_report_csv(report_type: str = Query(..., description="Type of report to export")):
    if report_type not in REPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report type. Supported: {', '.join(REPORT_TYPES)}"
        )

    with get_db() as conn:
        rows, headers = generate_report_data(conn, report_type)
        csv_content = export_report_to_csv(rows, headers)
        filename = f"voltguard_report_{report_type}.csv"

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
