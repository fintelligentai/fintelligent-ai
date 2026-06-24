"""
Political trades service — fetches STOCK Act disclosures from
House Stock Watcher and Senate Stock Watcher (both free, no API key).

Data is fetched once and cached for 6 hours. Per-ticker lookups
filter the in-memory cache so downstream requests are instant.
"""

import time
import threading
import requests
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

HOUSE_URL  = "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json"
SENATE_URL = "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
}

CACHE_TTL  = 6 * 3600   # 6 hours
MAX_RECENT = 500         # cap on total trades returned in "all recent" view


@dataclass
class _Cache:
    data:       list[dict] = field(default_factory=list)
    fetched_at: float      = 0.0
    lock:       threading.Lock = field(default_factory=threading.Lock)


_cache = _Cache()


def _fetch_house() -> list[dict]:
    try:
        resp = requests.get(HOUSE_URL, timeout=30, allow_redirects=True, headers=HEADERS)
        resp.raise_for_status()
        raw = resp.json()
        out = []
        for r in raw:
            ticker = (r.get("ticker") or "").strip().upper()
            if not ticker or ticker in ("--", "N/A", ""):
                continue
            out.append({
                "chamber":       "House",
                "politician":    r.get("representative", ""),
                "party":         r.get("party", ""),
                "state":         r.get("state", ""),
                "ticker":        ticker,
                "asset_name":    r.get("asset_description", ""),
                "trade_type":    _normalise_type(r.get("type", "")),
                "amount":        r.get("amount", ""),
                "traded_date":   r.get("transaction_date", ""),
                "disclosed_date":r.get("disclosure_date", r.get("transaction_date", "")),
                "sector":        r.get("sector", ""),
                "industry":      r.get("industry", ""),
            })
        return out
    except Exception as e:
        logger.warning(f"Failed to fetch House trades: {e}")
        return []


def _fetch_senate() -> list[dict]:
    try:
        resp = requests.get(SENATE_URL, timeout=30, allow_redirects=True, headers=HEADERS)
        resp.raise_for_status()
        raw = resp.json()
        out = []
        for r in raw:
            ticker = (r.get("ticker") or "").strip().upper()
            if not ticker or ticker in ("--", "N/A", ""):
                continue
            out.append({
                "chamber":       "Senate",
                "politician":    r.get("senator", ""),
                "party":         r.get("party", ""),
                "state":         r.get("state", ""),
                "ticker":        ticker,
                "asset_name":    r.get("asset_description", ""),
                "trade_type":    _normalise_type(r.get("type", "")),
                "amount":        r.get("amount", ""),
                "traded_date":   r.get("transaction_date", ""),
                "disclosed_date":r.get("disclosure_date", r.get("transaction_date", "")),
                "sector":        r.get("sector", ""),
                "industry":      r.get("industry", ""),
            })
        return out
    except Exception as e:
        logger.warning(f"Failed to fetch Senate trades: {e}")
        return []


def _normalise_type(raw: str) -> str:
    t = raw.lower()
    if "purchase" in t or "buy" in t:
        return "Buy"
    if "sale" in t or "sell" in t:
        if "partial" in t:
            return "Sell (Partial)"
        return "Sell"
    if "exchange" in t:
        return "Exchange"
    return raw.strip() or "Unknown"


def _sort_key(trade: dict) -> str:
    return trade.get("traded_date") or ""


def _refresh() -> list[dict]:
    house  = _fetch_house()
    senate = _fetch_senate()
    combined = house + senate
    combined.sort(key=_sort_key, reverse=True)
    return combined


def get_all_trades(limit: int = MAX_RECENT) -> dict:
    """Return the most recent trades across all tickers."""
    data = _ensure_fresh()
    return {
        "trades":     data[:limit],
        "total":      len(data),
        "fetched_at": datetime.fromtimestamp(_cache.fetched_at, tz=timezone.utc).isoformat(),
    }


def get_trades_for_ticker(ticker: str, limit: int = 50) -> dict:
    """Return trades for a specific ticker symbol."""
    ticker = ticker.upper().strip()
    data   = _ensure_fresh()
    filtered = [t for t in data if t["ticker"] == ticker]
    return {
        "ticker":     ticker,
        "trades":     filtered[:limit],
        "total":      len(filtered),
        "fetched_at": datetime.fromtimestamp(_cache.fetched_at, tz=timezone.utc).isoformat(),
    }


def _ensure_fresh() -> list[dict]:
    with _cache.lock:
        if time.time() - _cache.fetched_at > CACHE_TTL or not _cache.data:
            logger.info("Refreshing political trades cache…")
            fresh = _refresh()
            if fresh:
                _cache.data       = fresh
                _cache.fetched_at = time.time()
                logger.info(f"Political trades cache: {len(fresh)} records")
            elif not _cache.data:
                logger.warning("Political trades: no data fetched and cache is empty")
        return _cache.data
