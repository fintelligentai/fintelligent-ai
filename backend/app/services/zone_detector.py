"""
Supply & Demand Zone Detection Algorithm
=========================================
Identifies institutional S&D zones using base-candle + impulse pattern logic.

Patterns detected:
  - RBD (Rally-Base-Drop)  → Supply zone
  - DBR (Drop-Base-Rally)  → Demand zone
  - RBR (Rally-Base-Rally) → Continuation demand (fresh buying)
  - DBD (Drop-Base-Drop)   → Continuation supply (fresh selling)

Zone quality is scored 0–100 based on:
  - Impulse strength (ATR ratio)
  - Base tightness (smaller base = stronger zone)
  - Freshness (untouched zones score higher)
  - Number of touches (each test weakens the zone)
"""

import uuid
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Literal

from app.models.zone import SDZone, ZoneDetectionResult
from app.core.config import settings
from app.services.data_fetcher import fetch_ohlcv


# ---------------------------------------------------------------------------
# Indicator helpers
# ---------------------------------------------------------------------------

def _compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["high"]
    low = df["low"]
    prev_close = df["close"].shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(period, min_periods=1).mean()


def _candle_body(row: pd.Series) -> float:
    return abs(row["close"] - row["open"])


def _candle_range(row: pd.Series) -> float:
    return row["high"] - row["low"]


def _is_bullish(row: pd.Series) -> bool:
    return row["close"] > row["open"]


def _is_bearish(row: pd.Series) -> bool:
    return row["close"] < row["open"]


# ---------------------------------------------------------------------------
# Base candle identification
# ---------------------------------------------------------------------------

def _find_base_candles(
    df: pd.DataFrame,
    atr: pd.Series,
    body_atr_ratio: float,
) -> pd.Series:
    """
    Returns a boolean Series. True where a candle qualifies as a 'base':
    - Body is small relative to ATR (indecision / consolidation)
    - Includes doji, inside bars, spinning tops
    """
    body = df.apply(_candle_body, axis=1)
    return body <= (atr * body_atr_ratio)


# ---------------------------------------------------------------------------
# Impulse move identification
# ---------------------------------------------------------------------------

def _move_size(df: pd.DataFrame, start_idx: int, end_idx: int) -> float:
    """Absolute price move from close[start] to close[end]."""
    return abs(df["close"].iloc[end_idx] - df["close"].iloc[start_idx])


def _is_bullish_impulse(df: pd.DataFrame, start: int, end: int, atr_val: float, ratio: float) -> bool:
    segment = df.iloc[start:end + 1]
    move = segment["close"].iloc[-1] - segment["close"].iloc[0]
    return move >= atr_val * ratio


def _is_bearish_impulse(df: pd.DataFrame, start: int, end: int, atr_val: float, ratio: float) -> bool:
    segment = df.iloc[start:end + 1]
    move = segment["close"].iloc[0] - segment["close"].iloc[-1]
    return move >= atr_val * ratio


# ---------------------------------------------------------------------------
# Zone construction
# ---------------------------------------------------------------------------

def _zone_boundaries(
    df: pd.DataFrame,
    base_start: int,
    base_end: int,
    zone_type: Literal["supply", "demand"],
) -> tuple[float, float]:
    """
    Returns (proximal, distal) price levels for the zone.

    Supply zone: formed at the top — proximal is the low of the base, distal is the high.
    Demand zone: formed at the bottom — proximal is the high of the base, distal is the low.
    """
    base = df.iloc[base_start: base_end + 1]
    zone_high = base["high"].max()
    zone_low = base["low"].min()

    if zone_type == "supply":
        return zone_low, zone_high   # proximal=low (price approaches from below), distal=high
    else:
        return zone_high, zone_low   # proximal=high (price approaches from above), distal=low


def _count_touches(
    df: pd.DataFrame,
    proximal: float,
    distal: float,
    zone_type: Literal["supply", "demand"],
    formed_at_idx: int,
    current_idx: int,
) -> tuple[int, bool]:
    """
    Counts how many times price entered the zone after formation.
    Also determines if the zone is still fresh (no entry since formation).
    """
    touches = 0
    zone_top = max(proximal, distal)
    zone_bottom = min(proximal, distal)
    future_candles = df.iloc[formed_at_idx + 1: current_idx + 1]

    for _, row in future_candles.iterrows():
        if row["low"] <= zone_top and row["high"] >= zone_bottom:
            touches += 1

    is_fresh = touches == 0
    return touches, is_fresh


def _is_zone_broken(
    df: pd.DataFrame,
    proximal: float,
    distal: float,
    zone_type: Literal["supply", "demand"],
    formed_at_idx: int,
) -> bool:
    """
    A zone is broken (invalidated) when price closes decisively beyond the distal level.
    """
    future = df.iloc[formed_at_idx + 1:]
    if zone_type == "supply":
        # Broken when a candle closes above the distal (zone high)
        return bool((future["close"] > distal).any())
    else:
        # Broken when a candle closes below the distal (zone low)
        return bool((future["close"] < distal).any())


def _strength_score(
    impulse_atr: float,
    base_count: int,
    touches: int,
    is_fresh: bool,
    is_active: bool,
) -> float:
    """
    Score 0–100 based on:
    - Impulse strength   (0–40 pts): stronger impulse = better zone
    - Base tightness     (0–25 pts): fewer base candles = sharper zone
    - Freshness bonus    (0–20 pts): untouched zones are most reliable
    - Touch penalty      (0–15 pts): each test weakens the zone
    """
    if not is_active:
        return 0.0

    # Impulse component: cap at 4× ATR for full score
    impulse_pts = min(impulse_atr / 4.0, 1.0) * 40.0

    # Base tightness: 1 candle = 25 pts, decays with more base candles
    base_pts = max(0.0, 25.0 - (base_count - 1) * 5.0)

    # Freshness
    freshness_pts = 20.0 if is_fresh else 0.0

    # Touch penalty: lose 5 pts per touch, capped at 15
    touch_penalty = min(touches * 5.0, 15.0)

    raw = impulse_pts + base_pts + freshness_pts - touch_penalty
    return round(max(0.0, min(100.0, raw)), 1)


# ---------------------------------------------------------------------------
# Main detection engine
# ---------------------------------------------------------------------------

PATTERN_TO_ZONE: dict[str, Literal["supply", "demand"]] = {
    "RBD": "supply",
    "DBD": "supply",
    "DBR": "demand",
    "RBR": "demand",
}


def detect_zones(
    df: pd.DataFrame,
    asset: str,
    timeframe: str = "1d",
    lookback: int | None = None,
) -> ZoneDetectionResult:
    """
    Core S&D zone detection algorithm.

    Scans `lookback` candles and identifies all valid supply and demand zones
    using the Rally-Base-Drop / Drop-Base-Rally family of patterns.

    Parameters
    ----------
    df       : OHLCV DataFrame with DatetimeIndex
    asset    : ticker string (e.g. 'BTC-USD')
    timeframe: e.g. '1d'
    lookback : number of candles to scan (defaults to settings value)
    """
    if lookback is None:
        lookback = settings.max_zone_lookback

    df = df.tail(lookback).copy().reset_index(drop=False)
    n = len(df)

    atr = _compute_atr(df)
    is_base = _find_base_candles(df, atr, settings.base_candle_body_atr_ratio)

    current_price = df["close"].iloc[-1]
    current_atr = float(atr.iloc[-1])

    raw_zones: list[SDZone] = []

    # Scan every potential base region
    i = 1  # start after first candle (need a prior candle to establish the "leg in")
    while i < n - 1:
        if not is_base.iloc[i]:
            i += 1
            continue

        # Collect consecutive base candles
        base_start = i
        while i < n - 1 and is_base.iloc[i]:
            i += 1
        base_end = i - 1
        base_count = base_end - base_start + 1

        # We need at least one candle before and after the base
        if base_start == 0 or base_end >= n - 1:
            continue

        atr_at_base = float(atr.iloc[base_end])
        if np.isnan(atr_at_base) or atr_at_base == 0:
            continue

        impulse_ratio = settings.impulse_move_atr_ratio

        # Determine the leg IN to the base (what happened before the base)
        leg_in_start = max(0, base_start - 5)  # look back up to 5 candles
        leg_in_bullish = _is_bullish_impulse(df, leg_in_start, base_start, atr_at_base, impulse_ratio)
        leg_in_bearish = _is_bearish_impulse(df, leg_in_start, base_start, atr_at_base, impulse_ratio)

        # Determine the leg OUT from the base (what happens after the base)
        leg_out_end = min(n - 1, base_end + 5)  # look forward up to 5 candles
        leg_out_bullish = _is_bullish_impulse(df, base_end, leg_out_end, atr_at_base, impulse_ratio)
        leg_out_bearish = _is_bearish_impulse(df, base_end, leg_out_end, atr_at_base, impulse_ratio)

        pattern: str | None = None
        if leg_in_bullish and leg_out_bearish:
            pattern = "RBD"   # Rally-Base-Drop → supply
        elif leg_in_bearish and leg_out_bullish:
            pattern = "DBR"   # Drop-Base-Rally → demand
        elif leg_in_bullish and leg_out_bullish:
            pattern = "RBR"   # Rally-Base-Rally → continuation demand
        elif leg_in_bearish and leg_out_bearish:
            pattern = "DBD"   # Drop-Base-Drop → continuation supply

        if pattern is None:
            continue

        zone_type = PATTERN_TO_ZONE[pattern]

        # Measure impulse size (use the stronger of leg-in / leg-out)
        leg_in_size = _move_size(df, leg_in_start, base_start) / atr_at_base
        leg_out_size = _move_size(df, base_end, leg_out_end) / atr_at_base
        impulse_atr = max(leg_in_size, leg_out_size)

        proximal, distal = _zone_boundaries(df, base_start, base_end, zone_type)

        # Check if zone is still active
        is_active = not _is_zone_broken(df, proximal, distal, zone_type, base_end)

        # Start counting touches AFTER the leg-out (formation candles don't count)
        touches, is_fresh = _count_touches(
            df, proximal, distal, zone_type, leg_out_end, n - 1
        )

        score = _strength_score(impulse_atr, base_count, touches, is_fresh, is_active)

        formed_timestamp = df.index[base_start]
        if hasattr(df.iloc[base_start], "name"):
            # DatetimeIndex was reset; get from the stored datetime column
            dt_col = [c for c in df.columns if "date" in c.lower() or c == "index"]
            if dt_col:
                formed_timestamp = df[dt_col[0]].iloc[base_start]

        # Convert to datetime
        if isinstance(formed_timestamp, (int, np.integer)):
            formed_dt = df["index"].iloc[base_start] if "index" in df.columns else datetime.now(timezone.utc)
        else:
            formed_dt = pd.Timestamp(formed_timestamp).to_pydatetime()
            if formed_dt.tzinfo is None:
                formed_dt = formed_dt.replace(tzinfo=timezone.utc)

        zone = SDZone(
            zone_id=str(uuid.uuid4()),
            asset=asset,
            timeframe=timeframe,
            zone_type=zone_type,
            proximal=round(proximal, 6),
            distal=round(distal, 6),
            formed_at=formed_dt,
            formation_pattern=pattern,
            strength_score=score,
            touch_count=touches,
            is_fresh=is_fresh,
            is_active=is_active,
            impulse_size_atr=round(impulse_atr, 2),
            base_candle_count=base_count,
        )
        raw_zones.append(zone)

    # Merge overlapping zones of the same type
    zones = _merge_overlapping_zones(raw_zones, settings.zone_merge_proximity_pct)

    # Filter to active zones only, sorted by strength
    active_zones = [z for z in zones if z.is_active]
    supply = sorted([z for z in active_zones if z.zone_type == "supply"], key=lambda z: -z.strength_score)
    demand = sorted([z for z in active_zones if z.zone_type == "demand"], key=lambda z: -z.strength_score)

    return ZoneDetectionResult(
        asset=asset,
        timeframe=timeframe,
        detected_at=datetime.now(timezone.utc),
        current_price=round(current_price, 6),
        atr_14=round(current_atr, 6),
        supply_zones=supply,
        demand_zones=demand,
        total_zones=len(supply) + len(demand),
    )


def _merge_overlapping_zones(zones: list[SDZone], proximity_pct: float) -> list[SDZone]:
    """
    Merge zones of the same type whose ranges overlap or are within proximity_pct of each other.
    When merging, keep the zone with the higher strength score but expand its boundaries.
    """
    if not zones:
        return zones

    merged: list[SDZone] = []

    for zone_type in ("supply", "demand"):
        group = [z for z in zones if z.zone_type == zone_type]
        # Sort by proximal price
        group.sort(key=lambda z: min(z.proximal, z.distal))

        result: list[SDZone] = []
        for z in group:
            z_top = max(z.proximal, z.distal)
            z_bot = min(z.proximal, z.distal)

            if not result:
                result.append(z)
                continue

            prev = result[-1]
            prev_top = max(prev.proximal, prev.distal)
            prev_bot = min(prev.proximal, prev.distal)

            overlap_threshold = prev_top * proximity_pct
            gap = z_bot - prev_top

            if gap <= overlap_threshold:
                # Merge: expand to cover both, keep higher score zone's metadata
                new_top = max(prev_top, z_top)
                new_bot = min(prev_bot, z_bot)
                winner = z if z.strength_score > prev.strength_score else prev

                if zone_type == "supply":
                    new_proximal, new_distal = new_bot, new_top
                else:
                    new_proximal, new_distal = new_top, new_bot

                result[-1] = winner.model_copy(update={
                    "proximal": round(new_proximal, 6),
                    "distal": round(new_distal, 6),
                    "strength_score": max(z.strength_score, prev.strength_score),
                })
            else:
                result.append(z)

        merged.extend(result)

    return merged


# ---------------------------------------------------------------------------
# Public convenience function
# ---------------------------------------------------------------------------

def analyze_asset(asset: str, timeframe: str = "1d") -> ZoneDetectionResult:
    """Fetch data and run zone detection for an asset. Results cached for 15 minutes."""
    from app.services import cache

    cached = cache.get_zones(asset, timeframe)
    if cached is not None:
        return cached

    df = fetch_ohlcv(asset, timeframe)
    result = detect_zones(df, asset, timeframe)
    cache.set_zones(asset, timeframe, result)
    return result
