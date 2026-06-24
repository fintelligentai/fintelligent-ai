"""
S&D Zone Backtester — historical hold/break rates per pattern type.

LOCKED METHODOLOGY (do not change based on resulting numbers):

Base detection:
  A candle qualifies as a "base" when |close - open| <= BASE_BODY_ATR_RATIO * ATR(14).
  This is identical to the live zone detector's base_candle_body_atr_ratio setting.

Impulse detection:
  Leg-in  : 5 bars immediately before the base region.
  Leg-out : 5 bars immediately after the base region.
  An impulse is confirmed when the close-to-close move >= IMPULSE_ATR_RATIO * ATR(14).
  Both ratios match the live zone detector exactly.

Pattern classification (same as live detector):
  RBD (Rally-Base-Drop)   => supply zone
  DBR (Drop-Base-Rally)   => demand zone
  RBR (Rally-Base-Rally)  => demand zone (continuation)
  DBD (Drop-Base-Drop)    => supply zone (continuation)

Zone levels (same as live detector _zone_boundaries):
  Supply : proximal = base low,  distal = base high
  Demand : proximal = base high, distal = base low

Test entry:
  Supply zone : a bar whose HIGH  >= proximal is a test entry.
  Demand zone : a bar whose LOW   <= proximal is a test entry.
  Only tests occurring AFTER the formation bar are counted.
  Multiple consecutive bars inside the zone count as ONE test
  (only the first bar triggers the test event).

Hold vs break (LOOKFORWARD_BARS = 10, locked):
  RESPECTED : within 10 bars following test entry, no bar closes beyond the distal level.
              Supply => no close above distal. Demand => no close below distal.
  BROKEN    : at least one of those 10 bars closes beyond the distal level.

Exclusion rule:
  A test event is excluded from n entirely if fewer than LOOKFORWARD_BARS bars remain
  in the dataset after the test entry bar. This prevents recent tests from being
  counted as "respected by default" simply because not enough time has elapsed.

Sample size (n):
  Total included test events across all detected zones of that pattern type.
  Only includes zones where at least one included test occurred.
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass, field

from app.core.config import settings
from app.services.data_fetcher import fetch_ohlcv
from app.services.zone_detector import (
    _compute_atr,
    _find_base_candles,
    _is_bullish_impulse,
    _is_bearish_impulse,
    _zone_boundaries,
    PATTERN_TO_ZONE,
)

LOOKFORWARD_BARS = 10  # locked — do not change
LEG_BARS         = 5   # bars to look before/after base (matches live detector)

_cache: dict[str, dict] = {}
_CACHE_TTL_S = 60 * 60  # 60 minutes


@dataclass
class PatternStat:
    holds:     int = 0
    breaks:    int = 0

    @property
    def n(self) -> int:
        return self.holds + self.breaks

    @property
    def hit_rate(self) -> float | None:
        return round(self.holds / self.n, 4) if self.n > 0 else None


def _backtest_df(df: pd.DataFrame) -> dict[str, PatternStat]:
    """
    Single-pass scan over the full OHLCV dataframe.
    Detects all zones (including historically broken ones) and checks every
    subsequent test event using the locked methodology above.
    """
    df = df.reset_index(drop=True)
    n  = len(df)

    atr     = _compute_atr(df, period=14)
    is_base = _find_base_candles(df, atr, settings.base_candle_body_atr_ratio)

    stats: dict[str, PatternStat] = {
        "RBD": PatternStat(),
        "DBR": PatternStat(),
        "RBR": PatternStat(),
        "DBD": PatternStat(),
    }

    # ------------------------------------------------------------------ #
    # 1. Find all base regions and classify them as a pattern             #
    # ------------------------------------------------------------------ #
    i = 1
    while i < n - 1:
        if not is_base.iloc[i]:
            i += 1
            continue

        base_start = i
        while i < n - 1 and is_base.iloc[i]:
            i += 1
        base_end = i - 1

        if base_start == 0 or base_end >= n - 1:
            continue

        atr_val = float(atr.iloc[base_end])
        if np.isnan(atr_val) or atr_val == 0:
            continue

        leg_in_start = max(0, base_start - LEG_BARS)
        leg_out_end  = min(n - 1, base_end + LEG_BARS)

        leg_in_bull  = _is_bullish_impulse(df, leg_in_start, base_start, atr_val, settings.impulse_move_atr_ratio)
        leg_in_bear  = _is_bearish_impulse(df, leg_in_start, base_start, atr_val, settings.impulse_move_atr_ratio)
        leg_out_bull = _is_bullish_impulse(df, base_end, leg_out_end,  atr_val, settings.impulse_move_atr_ratio)
        leg_out_bear = _is_bearish_impulse(df, base_end, leg_out_end,  atr_val, settings.impulse_move_atr_ratio)

        if   leg_in_bull and leg_out_bear: pattern = "RBD"
        elif leg_in_bear and leg_out_bull: pattern = "DBR"
        elif leg_in_bull and leg_out_bull: pattern = "RBR"
        elif leg_in_bear and leg_out_bear: pattern = "DBD"
        else: continue

        zone_type = PATTERN_TO_ZONE[pattern]
        proximal, distal = _zone_boundaries(df, base_start, base_end, zone_type)

        # formation is considered complete after the leg-out
        formation_bar = leg_out_end

        # ---------------------------------------------------------------- #
        # 2. Scan for test events after the formation bar                  #
        # ---------------------------------------------------------------- #
        in_zone = False

        for j in range(formation_bar + 1, n):
            bar = df.iloc[j]

            if zone_type == "supply":
                entering = bar["high"] >= proximal
            else:
                entering = bar["low"] <= proximal

            if entering and not in_zone:
                in_zone = True

                # Exclude if fewer than LOOKFORWARD_BARS bars remain
                remaining = n - j - 1
                if remaining < LOOKFORWARD_BARS:
                    continue  # excluded from n — not enough lookforward data

                # Check next LOOKFORWARD_BARS bars for a close beyond distal
                broken = False
                for k in range(j + 1, j + LOOKFORWARD_BARS + 1):
                    if k >= n:
                        break
                    c = df.iloc[k]["close"]
                    if zone_type == "supply" and c > distal:
                        broken = True
                        break
                    if zone_type == "demand" and c < distal:
                        broken = True
                        break

                if broken:
                    stats[pattern].breaks += 1
                else:
                    stats[pattern].holds += 1

            elif not entering:
                in_zone = False  # price exited zone, next entry is a new test

    return stats


def get_backtest(ticker: str, timeframe: str) -> dict:
    """
    Returns cached backtest results (60-min TTL) or runs a fresh scan.
    """
    import time
    cache_key = f"{ticker}:{timeframe}"
    entry = _cache.get(cache_key)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL_S:
        return entry["data"]

    df    = fetch_ohlcv(ticker, timeframe)
    stats = _backtest_df(df)

    result = {
        "ticker":           ticker,
        "timeframe":        timeframe,
        "lookforward_bars": LOOKFORWARD_BARS,
        "methodology": (
            "A zone test is counted when price enters the zone after it forms. "
            f"'Respected' means no bar closed beyond the distal level within the next "
            f"{LOOKFORWARD_BARS} bars after test entry. "
            "'Broken' means at least one bar did. "
            "Tests with fewer than 10 bars of data remaining are excluded entirely "
            "to avoid inflating the hold rate with incomplete observations. "
            "Stat shown: % of tests where the zone held for at least 10 bars after test."
        ),
        "patterns": {
            pat: {
                "hit_rate": s.hit_rate,
                "holds":    s.holds,
                "breaks":   s.breaks,
                "n":        s.n,
            }
            for pat, s in stats.items()
        },
    }

    _cache[cache_key] = {"ts": time.time(), "data": result}
    return result
