import json
from fastapi import APIRouter
from backend.database import get_db
from backend.machine_learning.classification import train_and_evaluate_random_forest

router = APIRouter(prefix="/api/analytics", tags=["ML Performance & Analytics"])

@router.get("/model-performance")
def get_model_performance():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Model_Performance ORDER BY id DESC LIMIT 1;")
        row = cursor.fetchone()

        if not row:
            # Run initial evaluation if none stored
            return train_and_evaluate_random_forest(conn)

        cm = json.loads(row["confusion_matrix_json"]) if row["confusion_matrix_json"] else {}
        cr = json.loads(row["classification_report_json"]) if row["classification_report_json"] else {}

        return {
            "model_name": row["model_name"],
            "evaluation_date": row["evaluation_date"],
            "dataset_type": row["dataset_type"],
            "accuracy": row["accuracy"],
            "precision": row["precision"],
            "recall": row["recall"],
            "f1_score": row["f1_score"],
            "false_positive_rate": row["false_positive_rate"],
            "confusion_matrix": cm,
            "classification_report": cr,
            "evaluation_note": "Evaluated strictly on held-out chronological test partition (20% of synthetic labeled benchmark dataset). Real confusion matrix and multi-class metrics computed using Scikit-Learn."
        }

@router.post("/re-evaluate-models")
def trigger_re_evaluation():
    with get_db() as conn:
        result = train_and_evaluate_random_forest(conn)
        return result
