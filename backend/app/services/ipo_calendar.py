"""
IPO calendar service — data from Nasdaq IPO calendar API (free, no key).

Returns upcoming, recently priced, and filed IPOs with a significance tier
based on deal size.
"""

import time
import threading
import requests
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

NASDAQ_URL = "https://api.nasdaq.com/api/ipo/calendar"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

CACHE_TTL = 6 * 3600
_lock  = threading.Lock()
_cache: dict = {"data": None, "at": 0.0}

# Significance thresholds (offering dollar value)
MAJOR_THRESHOLD  = 500_000_000   # $500M+
NOTABLE_THRESHOLD = 100_000_000  # $100M+


def _parse_value(s: str) -> float:
    """Parse '$1,200,000,000' → 1200000000.0"""
    if not s:
        return 0.0
    try:
        return float(s.replace("$", "").replace(",", "").strip())
    except ValueError:
        return 0.0


def _significance(dollar_value: float) -> dict:
    if dollar_value >= MAJOR_THRESHOLD:
        return {"tier": "major",    "label": "Major",    "icon": "🔴", "impact": "Significant market impact expected"}
    if dollar_value >= NOTABLE_THRESHOLD:
        return {"tier": "notable",  "label": "Notable",  "icon": "🟡", "impact": "Medium market impact"}
    return     {"tier": "standard", "label": "Standard", "icon": "⚪", "impact": "Low market impact"}


def _fmt_value(v: float) -> str:
    if v <= 0:
        return "—"
    if v >= 1_000_000_000:
        return f"${v / 1_000_000_000:.1f}B"
    if v >= 1_000_000:
        return f"${v / 1_000_000:.0f}M"
    return f"${v:,.0f}"


def _process_row(row: dict, status: str) -> dict:
    raw_value = row.get("dollarValueOfSharesOffered", "") or ""
    dollar_value = _parse_value(raw_value)
    sig = _significance(dollar_value)

    date_field = (
        row.get("pricedDate") or
        row.get("expectedPriceDate") or
        row.get("filedDate") or ""
    )

    return {
        "deal_id":       row.get("dealID", ""),
        "ticker":        (row.get("proposedTickerSymbol") or "").strip(),
        "company":       row.get("companyName", "").strip().title(),
        "exchange":      (row.get("proposedExchange") or "").replace(" Global", "").replace(" Global Select", ""),
        "price_range":   row.get("proposedSharePrice") or row.get("priceRange") or "—",
        "shares_offered":row.get("sharesOffered") or "—",
        "deal_value":    dollar_value,
        "deal_value_fmt":_fmt_value(dollar_value),
        "date":          date_field,
        "status":        status,
        **sig,
    }


def _fetch() -> dict:
    try:
        r = requests.get(NASDAQ_URL, headers=HEADERS, timeout=15)
        r.raise_for_status()
        data = r.json().get("data", {})

        upcoming = [_process_row(row, "upcoming") for row in (data.get("upcoming", {}).get("rows") or [])]
        priced   = [_process_row(row, "priced")   for row in (data.get("priced",   {}).get("rows") or [])]
        filed    = [_process_row(row, "filed")    for row in (data.get("filed",    {}).get("rows") or [])]

        # Sort each section by deal value descending
        for lst in (upcoming, priced, filed):
            lst.sort(key=lambda x: x["deal_value"], reverse=True)

        return {
            "upcoming": upcoming,
            "priced":   priced,
            "filed":    filed,
            "month":    data.get("month", ""),
            "year":     str(data.get("year", "")),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch IPO calendar: {e}")
        return {"upcoming": [], "priced": [], "filed": [], "month": "", "year": ""}


def get_ipo_calendar() -> dict:
    with _lock:
        if time.time() - _cache["at"] < CACHE_TTL and _cache["data"]:
            return {**_cache["data"], "fetched_at": datetime.fromtimestamp(_cache["at"], tz=timezone.utc).isoformat()}

    data = _fetch()

    with _lock:
        _cache["data"] = data
        _cache["at"]   = time.time()

    return {**data, "fetched_at": datetime.now(tz=timezone.utc).isoformat()}
