"""
Background asset scanner.

Scans all assets every 15 minutes using a daemon thread.
Results are cached in-memory and served instantly via the API.
"""

import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

MAX_DISTANCE_PCT = 30.0  # exclude only very distant signals
DEFAULT_RR       = 2.0
SCAN_INTERVAL_S  = 15 * 60
MAX_WORKERS      = 5

# ── Shared state (protected by _lock) ────────────────────────────────────────
_results: list[dict] = []
_status: dict = {
    "scanning": False,
    "last_scan_at": None,
    "assets_scanned": 0,
    "total_assets": 0,
    "errors": 0,
}
_lock = threading.Lock()


def _scan_asset(asset: str) -> list[dict]:
    """Return near-entry signals for one asset. Never raises."""
    try:
        from app.core.assets import TICKER_MAP
        from app.services.zone_detector import analyze_asset
        from app.services.signal_engine import compute_signals

        zones   = analyze_asset(asset, "1d")
        signals = compute_signals(zones, rr_ratio=DEFAULT_RR)
        info    = TICKER_MAP[asset]

        label    = info.label    if hasattr(info, "label")    else info["label"]
        category = info.category if hasattr(info, "category") else info["category"]

        hits = []
        for sig in signals.buy_signals + signals.sell_signals:
            if sig.distance_pct > MAX_DISTANCE_PCT:
                continue
            # Score: 60% signal strength + 40% proximity bonus
            # Proximity bonus peaks at 0% distance, fades to 0 at MAX_DISTANCE_PCT
            proximity_bonus = max(0, (MAX_DISTANCE_PCT - sig.distance_pct) / MAX_DISTANCE_PCT) * 40
            score = round(sig.signal_strength * 0.6 + proximity_bonus, 1)
            hits.append({
                "asset":             asset,
                "label":             label,
                "category":          category,
                "signal_type":       sig.signal_type,
                "formation_pattern": sig.formation_pattern,
                "entry":             sig.entry,
                "stop_loss":         sig.stop_loss,
                "take_profit":       sig.take_profit,
                "signal_strength":   sig.signal_strength,
                "strength_label":    sig.strength_label,
                "distance_pct":      sig.distance_pct,
                "score":             score,
            })
        return hits
    except Exception:
        return []


def run_scan() -> None:
    """Full scan across all assets. Runs in background thread."""
    from app.core.assets import TICKER_MAP

    assets = list(TICKER_MAP.keys())
    total  = len(assets)

    with _lock:
        _status.update(scanning=True, total_assets=total, assets_scanned=0, errors=0)

    all_hits: list[dict] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(_scan_asset, a): a for a in assets}
        for future in as_completed(futures):
            hits = future.result()
            all_hits.extend(hits)
            with _lock:
                _status["assets_scanned"] += 1
                if not hits and futures[future]:
                    pass  # could count errors here if needed

    all_hits.sort(key=lambda x: -x["score"])

    with _lock:
        _results.clear()
        _results.extend(all_hits)
        _status.update(
            scanning=False,
            last_scan_at=datetime.now(timezone.utc).isoformat(),
        )


def get_results() -> tuple[list[dict], dict]:
    with _lock:
        return list(_results), dict(_status)


STARTUP_DELAY_S = 120  # wait 2 min after boot before first scan so routes are responsive


def start_background_scanner() -> None:
    """Start the recurring background scan as a daemon thread."""
    def _loop():
        time.sleep(STARTUP_DELAY_S)
        while True:
            run_scan()
            time.sleep(SCAN_INTERVAL_S)

    t = threading.Thread(target=_loop, daemon=True, name="asset-scanner")
    t.start()
