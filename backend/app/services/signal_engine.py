"""
Signal engine — derives BUY/SELL trade setups from detected S&D zones.

Logic:
  Demand zone → BUY signal
    Entry     = zone proximal (top of demand, price approaches from above)
    Stop Loss = zone distal × (1 - sl_buffer_pct)  (just below the zone)
    TP        = entry + risk × rr_ratio

  Supply zone → SELL signal
    Entry     = zone proximal (bottom of supply, price approaches from below)
    Stop Loss = zone distal × (1 + sl_buffer_pct)  (just above the zone)
    TP        = entry - risk × rr_ratio

Signal strength (0–100):
  Base = zone.strength_score
  Proximity bonus: zones within 2 ATR of current price score up to +15
  Penalty: zones further than 5 ATR score down by up to -20
  Freshness: already baked into zone strength_score
"""

from datetime import datetime, timezone
import pandas as pd
from app.models.zone import ZoneDetectionResult, SDZone
from app.models.signal import TradeSignal, SignalResult, MACross, TrendBias

SL_BUFFER_PCT = 0.003   # 0.3% buffer beyond distal for stop loss
MA_FAST       = 50
MA_SLOW       = 200


def compute_ma_cross(df: pd.DataFrame) -> MACross | None:
    """
    Detects golden cross (50 MA crosses above 200 MA) or
    death cross (50 MA crosses below 200 MA) on the given OHLCV dataframe.
    Returns None if there is insufficient data.
    """
    if len(df) < MA_SLOW + 1:
        return None

    close   = df["close"]
    fast    = close.rolling(MA_FAST).mean()
    slow    = close.rolling(MA_SLOW).mean()

    # Current state
    ma_fast_now  = float(fast.iloc[-1])
    ma_slow_now  = float(slow.iloc[-1])

    if pd.isna(ma_fast_now) or pd.isna(ma_slow_now):
        return None

    golden = ma_fast_now > ma_slow_now  # fast above slow = golden cross regime

    # Find how many bars since the last cross (fast crossed slow)
    above = (fast > slow).dropna()
    if len(above) < 2:
        bars_since = 0
    else:
        # Walk backwards to find where regime changed
        current_state = above.iloc[-1]
        bars_since = 0
        for k in range(len(above) - 2, -1, -1):
            if above.iloc[k] != current_state:
                break
            bars_since += 1

    return MACross(
        signal="golden_cross" if golden else "death_cross",
        ma_fast=round(ma_fast_now, 6),
        ma_slow=round(ma_slow_now, 6),
        bars_since_cross=bars_since,
    )


def compute_trend_bias(df: pd.DataFrame) -> TrendBias | None:
    """
    Determines trend bias from price position relative to 50MA and 200MA.
    - Above both  → Bullish
    - Below both  → Bearish
    - Between     → Neutral
    """
    if len(df) < MA_SLOW:
        return None

    close = df["close"]
    ma50  = close.rolling(MA_FAST).mean()
    ma200 = close.rolling(MA_SLOW).mean()

    ma50_now  = float(ma50.iloc[-1])
    ma200_now = float(ma200.iloc[-1])
    price     = float(close.iloc[-1])

    if pd.isna(ma50_now) or pd.isna(ma200_now):
        return None

    if price > ma50_now and price > ma200_now:
        bias = "bullish"
    elif price < ma50_now and price < ma200_now:
        bias = "bearish"
    else:
        bias = "neutral"

    return TrendBias(
        bias=bias,
        ma_50=round(ma50_now, 6),
        ma_200=round(ma200_now, 6),
        current_price=round(price, 6),
    )


def _strength_label(score: float) -> str:
    if score >= 75:
        return "Very Strong"
    if score >= 55:
        return "Strong"
    if score >= 35:
        return "Moderate"
    return "Weak"


def _proximity_adjusted_strength(
    zone_strength: float,
    distance_to_entry: float,
    atr: float,
) -> float:
    if atr == 0:
        return zone_strength

    distance_atr = distance_to_entry / atr

    if distance_atr <= 1.0:
        proximity_bonus = 15.0
    elif distance_atr <= 2.0:
        proximity_bonus = 8.0
    elif distance_atr <= 3.0:
        proximity_bonus = 0.0
    elif distance_atr <= 5.0:
        proximity_bonus = -10.0
    else:
        proximity_bonus = -20.0

    return round(max(0.0, min(100.0, zone_strength + proximity_bonus)), 1)


def _build_signal(
    zone: SDZone,
    current_price: float,
    atr: float,
    rr_ratio: float,
    bias: str = "neutral",
) -> TradeSignal:
    is_demand = zone.zone_type == "demand"
    signal_type = "BUY" if is_demand else "SELL"

    entry = zone.proximal
    distance_to_entry = abs(current_price - entry)
    distance_pct = round((distance_to_entry / current_price) * 100, 3)

    if is_demand:
        sl = zone.distal * (1 - SL_BUFFER_PCT)
        risk = entry - sl
        tp = entry + risk * rr_ratio
    else:
        sl = zone.distal * (1 + SL_BUFFER_PCT)
        risk = sl - entry
        tp = entry - risk * rr_ratio

    signal_strength = _proximity_adjusted_strength(
        zone.strength_score, distance_to_entry, atr
    )

    if bias == "neutral":
        trend_aligned = "neutral"
    elif (signal_type == "BUY" and bias == "bullish") or (signal_type == "SELL" and bias == "bearish"):
        trend_aligned = "aligned"
    else:
        trend_aligned = "counter"

    return TradeSignal(
        signal_type=signal_type,
        zone_id=zone.zone_id,
        asset=zone.asset,
        timeframe=zone.timeframe,
        formation_pattern=zone.formation_pattern,
        entry=round(entry, 6),
        stop_loss=round(sl, 6),
        take_profit=round(tp, 6),
        risk_pips=round(abs(risk), 6),
        reward_pips=round(abs(risk * rr_ratio), 6),
        signal_strength=signal_strength,
        strength_label=_strength_label(signal_strength),
        zone_proximal=zone.proximal,
        zone_distal=zone.distal,
        distance_to_entry=round(distance_to_entry, 6),
        distance_pct=distance_pct,
        trend_aligned=trend_aligned,
    )


def compute_signals(
    zones: ZoneDetectionResult,
    rr_ratio: float = 2.0,
    df: pd.DataFrame | None = None,
) -> SignalResult:
    """
    Derive trade signals from zone detection results.
    Returns BUY signals (from demand zones) and SELL signals (from supply zones),
    sorted by signal strength descending.
    """
    current_price = zones.current_price
    atr = zones.atr_14

    ma_cross    = compute_ma_cross(df)    if df is not None else None
    trend_bias  = compute_trend_bias(df)  if df is not None else None
    bias_str    = trend_bias.bias if trend_bias else "neutral"

    buy_signals = [
        _build_signal(z, current_price, atr, rr_ratio, bias_str)
        for z in zones.demand_zones
        if z.is_active
    ]
    sell_signals = [
        _build_signal(z, current_price, atr, rr_ratio, bias_str)
        for z in zones.supply_zones
        if z.is_active
    ]

    buy_signals.sort(key=lambda s: -s.signal_strength)
    sell_signals.sort(key=lambda s: -s.signal_strength)

    return SignalResult(
        asset=zones.asset,
        timeframe=zones.timeframe,
        computed_at=datetime.now(timezone.utc),
        current_price=current_price,
        atr_14=atr,
        rr_ratio=rr_ratio,
        buy_signals=buy_signals,
        sell_signals=sell_signals,
        ma_cross=ma_cross,
        trend_bias=trend_bias,
    )
