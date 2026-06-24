"""
Unit tests for the S&D zone detection algorithm.
Uses synthetic OHLCV data to validate pattern recognition deterministically.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta

from app.services.zone_detector import detect_zones, _compute_atr, _find_base_candles


def make_df(rows: list[dict]) -> pd.DataFrame:
    """Build a minimal OHLCV DataFrame from a list of row dicts."""
    df = pd.DataFrame(rows)
    df.index = pd.date_range("2024-01-01", periods=len(df), freq="D", tz="UTC")
    df["volume"] = 1_000_000
    return df[["open", "high", "low", "close", "volume"]]


def bullish_candle(base: float, size: float = 2.0) -> dict:
    return {"open": base, "high": base + size + 0.5, "low": base - 0.2, "close": base + size}


def bearish_candle(base: float, size: float = 2.0) -> dict:
    return {"open": base + size, "high": base + size + 0.2, "low": base - 0.5, "close": base}


def doji(base: float) -> dict:
    """Small body, qualifies as base candle."""
    return {"open": base, "high": base + 0.4, "low": base - 0.4, "close": base + 0.05}


def warmup_candles(anchor: float, n: int = 16) -> tuple[list[dict], float]:
    """Generate n neutral candles to seed ATR, returns rows and final price."""
    rows = []
    price = anchor
    for i in range(n):
        # Alternate small bullish/bearish to give ATR something realistic
        if i % 2 == 0:
            rows.append(bullish_candle(price, size=1.0))
            price += 1.0
        else:
            rows.append(bearish_candle(price, size=1.0))
            price -= 1.0
    return rows, price


def build_dbr_pattern(anchor: float = 100.0) -> pd.DataFrame:
    """
    Drop-Base-Rally pattern → should produce a demand zone.
    Includes ATR warmup candles before the pattern.
    """
    rows, price = warmup_candles(anchor)
    # Drop leg
    for _ in range(5):
        rows.append(bearish_candle(price, size=3.0))
        price -= 3.0
    # Base
    rows.append(doji(price))
    # Rally leg
    for _ in range(5):
        rows.append(bullish_candle(price, size=3.0))
        price += 3.0
    return make_df(rows)


def build_rbd_pattern(anchor: float = 100.0) -> pd.DataFrame:
    """
    Rally-Base-Drop pattern → should produce a supply zone.
    Includes ATR warmup candles before the pattern.
    """
    rows, price = warmup_candles(anchor)
    # Rally leg
    for _ in range(5):
        rows.append(bullish_candle(price, size=3.0))
        price += 3.0
    # Base
    rows.append(doji(price))
    # Drop leg
    for _ in range(5):
        rows.append(bearish_candle(price, size=3.0))
        price -= 3.0
    return make_df(rows)


class TestATR:
    def test_atr_is_positive(self):
        df = build_dbr_pattern()
        atr = _compute_atr(df)
        assert atr.dropna().gt(0).all()

    def test_atr_length_matches(self):
        df = build_dbr_pattern()
        atr = _compute_atr(df)
        assert len(atr) == len(df)


class TestBaseCandles:
    def test_doji_identified_as_base(self):
        df = build_dbr_pattern()
        atr = _compute_atr(df)
        is_base = _find_base_candles(df, atr, body_atr_ratio=0.3)
        # 16 warmup + 5 drop candles = doji at index 21
        assert is_base.iloc[21]

    def test_impulse_candle_not_base(self):
        df = build_dbr_pattern()
        atr = _compute_atr(df)
        is_base = _find_base_candles(df, atr, body_atr_ratio=0.3)
        # First candle is a big bearish drop, should not be a base
        assert not is_base.iloc[0]


class TestDBRDetection:
    def test_detects_demand_zone(self):
        df = build_dbr_pattern(anchor=100.0)
        result = detect_zones(df, "BTC-USD", "1d")
        assert len(result.demand_zones) >= 1

    def test_demand_zone_proximal_above_distal(self):
        df = build_dbr_pattern(anchor=100.0)
        result = detect_zones(df, "BTC-USD", "1d")
        for zone in result.demand_zones:
            assert zone.proximal > zone.distal, "Demand proximal must be above distal"

    def test_demand_zone_pattern_label(self):
        df = build_dbr_pattern(anchor=100.0)
        result = detect_zones(df, "BTC-USD", "1d")
        patterns = {z.formation_pattern for z in result.demand_zones}
        assert "DBR" in patterns or "RBR" in patterns


class TestRBDDetection:
    def test_detects_supply_zone(self):
        df = build_rbd_pattern(anchor=100.0)
        result = detect_zones(df, "BTC-USD", "1d")
        assert len(result.supply_zones) >= 1

    def test_supply_zone_proximal_below_distal(self):
        df = build_rbd_pattern(anchor=100.0)
        result = detect_zones(df, "BTC-USD", "1d")
        for zone in result.supply_zones:
            assert zone.proximal < zone.distal, "Supply proximal must be below distal"

    def test_supply_zone_pattern_label(self):
        df = build_rbd_pattern(anchor=100.0)
        result = detect_zones(df, "BTC-USD", "1d")
        patterns = {z.formation_pattern for z in result.supply_zones}
        assert "RBD" in patterns or "DBD" in patterns


class TestZoneMetrics:
    def test_fresh_zone_when_price_never_entered(self):
        df = build_dbr_pattern(anchor=100.0)
        result = detect_zones(df, "BTC-USD", "1d")
        # Price ends well above the base after a rally — zone should be fresh
        demand = result.demand_zones
        if demand:
            # The zone is below current price after rally; price hasn't revisited
            assert demand[0].is_fresh

    def test_strength_score_in_range(self):
        df = build_rbd_pattern(anchor=100.0)
        result = detect_zones(df, "BTC-USD", "1d")
        for zone in result.supply_zones + result.demand_zones:
            assert 0.0 <= zone.strength_score <= 100.0

    def test_result_asset_matches(self):
        df = build_dbr_pattern()
        result = detect_zones(df, "XAUUSD=X", "1d")
        assert result.asset == "XAUUSD=X"
        for zone in result.demand_zones + result.supply_zones:
            assert zone.asset == "XAUUSD=X"
