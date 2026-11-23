def generate_consumer_explanation(
    consumer_id: str,
    category: str,
    connected_load: float,
    actual_kwh: float,
    expected_kwh: float,
    deviation_pct: float,
    activity_type: str,
    hour: int,
    is_weekend: bool,
    transformer_discrepancy_pct: float = 0.0
) -> str:
    """
    Generates dynamic, human-readable explanations from actual readings,
    category baselines, and historical deviation metrics.
    """
    timing_str = f"during {'weekend' if is_weekend else 'weekday'} hour {hour:02d}:00"
    load_context = f"(sanctioned connected load: {connected_load:.1f} kW)"
    
    if activity_type == "Possible Meter Tampering" or "Tampering" in activity_type:
        return (
            f"Consumer {consumer_id} ({category}) exhibited abnormal electrical indicators {timing_str} "
            f"with erratic power draw {actual_kwh:.2f} kWh versus expected baseline of {expected_kwh:.2f} kWh "
            f"{load_context}. Characteristics match potential meter bypass or phase shunting. Physical verification warranted."
        )
    
    elif deviation_pct > 60:
        return (
            f"Consumer {consumer_id} recorded an unusual consumption surge of {actual_kwh:.2f} kWh {timing_str}, "
            f"exceeding normal baseline of {expected_kwh:.2f} kWh by {deviation_pct:.1f}% {load_context}. "
            f"Exceeds typical {category} consumption profile and historical load curve."
        )
        
    elif deviation_pct < -50:
        return (
            f"Consumer {consumer_id} recorded a steep unexpected reduction to {actual_kwh:.2f} kWh {timing_str}, "
            f"which is {abs(deviation_pct):.1f}% below the historical normal pattern of {expected_kwh:.2f} kWh. "
            f"Despite active connected capacity {load_context}, consumption collapsed abnormally, suggesting possible meter bypass or unmetered tapping."
        )
        
    elif "Load Variation" in activity_type:
        return (
            f"Consumer {consumer_id} experienced high-frequency load fluctuations ({actual_kwh:.2f} kWh vs baseline {expected_kwh:.2f} kWh) "
            f"inconsistent with historical {category} operating schedules {timing_str}."
        )
        
    else:
        return (
            f"Consumption of {actual_kwh:.2f} kWh deviates by {deviation_pct:+.1f}% from historical expectation of {expected_kwh:.2f} kWh "
            f"{timing_str}. Flagged for review by the Isolation Forest model."
        )

def generate_transformer_explanation(
    transformer_id: str,
    discrepancy_kwh: float,
    discrepancy_pct: float,
    suspicious_consumer_count: int,
    total_consumer_count: int
) -> str:
    """
    Generates dynamic engineering explanations for transformer-level energy discrepancy.
    """
    if discrepancy_pct > 12:
        return (
            f"Transformer {transformer_id} exhibits a critical unaccounted energy discrepancy of {discrepancy_pct:.1f}% "
            f"({discrepancy_kwh:.2f} kWh unaccounted). In addition, {suspicious_consumer_count} of {total_consumer_count} "
            f"downstream consumers have active anomaly flags. Priority physical audit and feeder line inspection recommended."
        )
    elif discrepancy_pct > 7:
        return (
            f"Transformer {transformer_id} shows an elevated energy gap of {discrepancy_pct:.1f}% ({discrepancy_kwh:.2f} kWh). "
            f"{suspicious_consumer_count} connected consumers have recorded irregular consumption. "
            f"Discrepancy exceeds standard technical line loss parameters (~3-5%)."
        )
    else:
        return (
            f"Transformer {transformer_id} operating within acceptable technical tolerance ({discrepancy_pct:.1f}% discrepancy, "
            f"{discrepancy_kwh:.2f} kWh). Downstream consumer load patterns are stable."
        )
