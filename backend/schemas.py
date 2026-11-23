from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# Consumer Schemas
class ConsumerBase(BaseModel):
    consumer_id: str
    name: str
    meter_id: str
    category: str  # Residential, Commercial, Industrial
    location: str
    connected_load_capacity: float  # kW
    feeder_id: str
    transformer_id: str
    registration_date: Optional[str] = None

class ConsumerCreate(ConsumerBase):
    pass

class ConsumerUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    connected_load_capacity: Optional[float] = None
    feeder_id: Optional[str] = None
    transformer_id: Optional[str] = None

class ConsumerResponse(ConsumerBase):
    created_at: str
    suspicious_count: Optional[int] = 0
    total_consumption_kwh: Optional[float] = 0.0
    latest_reading_kwh: Optional[float] = 0.0
    risk_level: Optional[str] = "Low"

# Feeder & Transformer Schemas
class FeederCreate(BaseModel):
    feeder_id: str
    name: str
    location: str
    capacity_kva: float
    status: Optional[str] = "Operational"

class TransformerCreate(BaseModel):
    transformer_id: str
    feeder_id: str
    name: str
    location: str
    capacity_kva: float
    status: Optional[str] = "Operational"

# Alert Schemas
class AlertUpdateStatus(BaseModel):
    investigation_status: str  # Pending Investigation, Under Investigation, Resolved, False Alarm
    remarks: str
    updated_by: Optional[str] = "Operator"

class TheftAlertResponse(BaseModel):
    id: int
    alert_code: str
    consumer_id: str
    feeder_id: str
    transformer_id: str
    timestamp: str
    activity_type: str
    actual_kwh: float
    expected_kwh: float
    anomaly_score: float
    risk_score: float
    risk_level: str
    explanation: str
    investigation_status: str
    notes: Optional[str] = None
    updated_at: str

# Settings Schemas
class SettingUpdate(BaseModel):
    key: str
    value: str

# Simulation Schemas
class SimulationStepRequest(BaseModel):
    hours_to_advance: Optional[int] = 1

class SimulateSuspiciousRequest(BaseModel):
    consumer_id: Optional[str] = None
    scenario: str  # "Sudden_Spike", "Sudden_Drop_Meter_Bypass", "Suspicious_Load_Variation", "Low_Power_Factor_Tampering"

# CSV Upload Response Schema
class UploadResponse(BaseModel):
    message: str
    filename: str
    total_rows: int
    valid_rows: int
    errors: List[str]
    detected_columns: List[str]
