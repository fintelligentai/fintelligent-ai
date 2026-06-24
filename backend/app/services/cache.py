"""
Two-tier TTL cache for OHLCV data and zone detection results.

- OHLCV: 15-minute TTL (price data doesn't change intrabar on daily tf)
- Zones: 15-minute TTL (zone detection is expensive, results are stable intraday)

Both caches are keyed by (asset, timeframe).
Thread-safe via cachetools.TTLCache + threading.RLock.
"""

import threading
from datetime import datetime, timezone
from cachetools import TTLCache

import pandas as pd
from app.models.zone import ZoneDetectionResult

_OHLCV_TTL = 15 * 60       # 15 minutes
_ZONES_TTL = 15 * 60

_ohlcv_cache: TTLCache = TTLCache(maxsize=32, ttl=_OHLCV_TTL)
_zones_cache: TTLCache = TTLCache(maxsize=32, ttl=_ZONES_TTL)
_ohlcv_lock = threading.RLock()
_zones_lock = threading.RLock()

# Track when each key was last populated
_ohlcv_timestamps: dict[str, datetime] = {}
_zones_timestamps: dict[str, datetime] = {}


def _key(asset: str, timeframe: str) -> str:
    return f"{asset}:{timeframe}"


# ---------------------------------------------------------------------------
# OHLCV cache
# ---------------------------------------------------------------------------

def get_ohlcv(asset: str, timeframe: str) -> pd.DataFrame | None:
    with _ohlcv_lock:
        return _ohlcv_cache.get(_key(asset, timeframe))


def set_ohlcv(asset: str, timeframe: str, df: pd.DataFrame) -> None:
    k = _key(asset, timeframe)
    with _ohlcv_lock:
        _ohlcv_cache[k] = df
        _ohlcv_timestamps[k] = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Zone cache
# ---------------------------------------------------------------------------

def get_zones(asset: str, timeframe: str) -> ZoneDetectionResult | None:
    with _zones_lock:
        return _zones_cache.get(_key(asset, timeframe))


def set_zones(asset: str, timeframe: str, result: ZoneDetectionResult) -> None:
    k = _key(asset, timeframe)
    with _zones_lock:
        _zones_cache[k] = result
        _zones_timestamps[k] = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Cache management
# ---------------------------------------------------------------------------

def invalidate(asset: str, timeframe: str) -> None:
    """Force-expire a specific asset/timeframe from both caches."""
    k = _key(asset, timeframe)
    with _ohlcv_lock:
        _ohlcv_cache.pop(k, None)
        _ohlcv_timestamps.pop(k, None)
    with _zones_lock:
        _zones_cache.pop(k, None)
        _zones_timestamps.pop(k, None)


def invalidate_all() -> None:
    with _ohlcv_lock:
        _ohlcv_cache.clear()
        _ohlcv_timestamps.clear()
    with _zones_lock:
        _zones_cache.clear()
        _zones_timestamps.clear()


def cache_status() -> dict:
    now = datetime.now(timezone.utc)
    with _ohlcv_lock:
        ohlcv_keys = list(_ohlcv_cache.keys())
    with _zones_lock:
        zones_keys = list(_zones_cache.keys())

    entries = {}
    for k in set(ohlcv_keys) | set(zones_keys):
        ohlcv_ts = _ohlcv_timestamps.get(k)
        zones_ts = _zones_timestamps.get(k)
        entries[k] = {
            "ohlcv_cached": k in ohlcv_keys,
            "zones_cached": k in zones_keys,
            "ohlcv_age_s": round((now - ohlcv_ts).total_seconds()) if ohlcv_ts else None,
            "zones_age_s": round((now - zones_ts).total_seconds()) if zones_ts else None,
            "ohlcv_ttl_s": _OHLCV_TTL,
            "zones_ttl_s": _ZONES_TTL,
        }
    return entries
