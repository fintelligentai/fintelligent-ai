from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


class TradeSignal(BaseModel):
    signal_type: Literal["BUY", "SELL"]
    zone_id: str
    asset: str
    timeframe: str
    formation_pattern: str

    entry: float
    stop_loss: float
    take_profit: float          # default 2:1 RR
    risk_pips: float            # distance from entry to SL in price units
    reward_pips: float          # distance from entry to TP in price units

    signal_strength: float = Field(..., ge=0.0, le=100.0,
        description="0–100 score: zone quality × proximity to current price")
    strength_label: Literal["Weak", "Moderate", "Strong", "Very Strong"]

    zone_proximal: float
    zone_distal: float
    distance_to_entry: float    # absolute distance from current price to entry
    distance_pct: float         # % distance from current price to entry
    trend_aligned: Literal["aligned", "counter", "neutral"] = "neutral"


class MACross(BaseModel):
    signal: Literal["golden_cross", "death_cross", "none"]
    ma_fast: float          # 50-period MA value
    ma_slow: float          # 200-period MA value
    bars_since_cross: int   # how many bars ago the cross occurred (0 = just crossed)


class TrendBias(BaseModel):
    bias: Literal["bullish", "bearish", "neutral"]
    ma_50: float
    ma_200: float
    current_price: float


class SignalResult(BaseModel):
    asset: str
    timeframe: str
    computed_at: datetime
    current_price: float
    atr_14: float
    rr_ratio: float
    buy_signals: list[TradeSignal]
    sell_signals: list[TradeSignal]
    ma_cross: Optional[MACross] = None
    trend_bias: Optional[TrendBias] = None
