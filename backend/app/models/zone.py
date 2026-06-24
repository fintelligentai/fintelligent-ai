from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime


class SDZone(BaseModel):
    zone_id: str
    asset: str
    timeframe: str
    zone_type: Literal["supply", "demand"]

    # Price boundaries
    proximal: float = Field(..., description="Price level closest to current price")
    distal: float = Field(..., description="Price level furthest from current price")

    # Formation candle metadata
    formed_at: datetime
    formation_pattern: Literal["RBD", "DBR", "RBR", "DBD"]
    # RBD = Rally-Base-Drop (supply), DBR = Drop-Base-Rally (demand)
    # RBR = Rally-Base-Rally (continuation demand), DBD = Drop-Base-Drop (continuation supply)

    # Zone quality metrics
    strength_score: float = Field(..., ge=0.0, le=100.0)
    touch_count: int = Field(default=0, ge=0)
    is_fresh: bool = Field(default=True, description="Price has not yet entered this zone")
    is_active: bool = Field(default=True, description="Zone has not been decisively broken")

    # Impulse that created the zone
    impulse_size_atr: float = Field(..., description="Impulse move size in ATR units")
    base_candle_count: int = Field(..., ge=1)


class ZoneDetectionResult(BaseModel):
    asset: str
    timeframe: str
    detected_at: datetime
    current_price: float
    atr_14: float
    supply_zones: list[SDZone]
    demand_zones: list[SDZone]
    total_zones: int
