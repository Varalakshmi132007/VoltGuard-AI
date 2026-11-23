from typing import Dict, Any, Tuple

def calculate_consumer_risk_score(
    anomaly_score: float,           # 0.0 to 1.0 (higher = more anomalous)
    deviation_pct: float,           # percentage deviation from expected
    repeated_abnormal_count: int,   # count of abnormal events for consumer in past 7 days
    transformer_discrepancy_pct: float = 0.0 # downstream transformer energy gap %
) -> Tuple[float, str, Dict[str, Any]]:
    """
    Transparent weighted risk scoring algorithm producing 0-100 score:
    - Component 1: Anomaly Score Intensity (35% weight)
    - Component 2: Deviation Magnitude (25% weight)
    - Component 3: Recurrence Frequency (20% weight)
    - Component 4: Transformer Energy Context (20% weight)
    """
    # 1. Anomaly score component (35 pts max)
    # anomaly_score is typically between 0.4 and 0.95 for anomalies
    norm_anomaly = min(1.0, max(0.0, (anomaly_score - 0.4) / 0.5)) if anomaly_score > 0.4 else 0.1
    c1_score = norm_anomaly * 35.0

    # 2. Deviation magnitude component (25 pts max)
    # absolute deviation percentage capped at 150%
    abs_dev = abs(deviation_pct)
    norm_dev = min(1.0, abs_dev / 120.0)
    c2_score = norm_dev * 25.0

    # 3. Recurrence frequency component (20 pts max)
    # 1 flag -> 5 pts, 2 flags -> 10 pts, 3 flags -> 15 pts, 4+ flags -> 20 pts
    c3_score = min(20.0, repeated_abnormal_count * 5.0)

    # 4. Transformer discrepancy context (20 pts max)
    # normal line loss is 3-5%, gap above 15% gets max 20 pts
    norm_tr = min(1.0, max(0.0, (transformer_discrepancy_pct - 3.0) / 12.0))
    c4_score = norm_tr * 20.0

    total_risk = round(c1_score + c2_score + c3_score + c4_score, 1)
    total_risk = max(0.0, min(100.0, total_risk))

    if total_risk <= 30.0:
        level = "Low"
    elif total_risk <= 60.0:
        level = "Medium"
    elif total_risk <= 80.0:
        level = "High"
    else:
        level = "Critical"

    breakdown = {
        "anomaly_intensity_points": round(c1_score, 1),
        "deviation_magnitude_points": round(c2_score, 1),
        "recurrence_frequency_points": round(c3_score, 1),
        "transformer_context_points": round(c4_score, 1),
        "total_risk_score": total_risk,
        "risk_level": level,
        "calculation_formula": "Risk = (Norm_Anomaly × 35) + (Norm_Dev × 25) + (Recurrence × 20) + (TR_Discrepancy × 20)"
    }

    return total_risk, level, breakdown

def calculate_transformer_risk_score(
    discrepancy_pct: float,
    suspicious_consumer_count: int,
    total_consumer_count: int
) -> Tuple[float, str]:
    """
    Calculates investigation priority score for transformers (0 to 100).
    """
    # Discrepancy weight 60%, Suspicious consumer ratio 40%
    ratio = (suspicious_consumer_count / total_consumer_count) if total_consumer_count > 0 else 0.0
    
    score_discrepancy = min(60.0, max(0.0, discrepancy_pct * 3.5))
    score_ratio = min(40.0, ratio * 200.0)
    
    total = round(score_discrepancy + score_ratio, 1)
    total = max(0.0, min(100.0, total))
    
    if total <= 30.0:
        level = "Low"
    elif total <= 60.0:
        level = "Medium"
    elif total <= 80.0:
        level = "High"
    else:
        level = "Critical"
        
    return total, level
