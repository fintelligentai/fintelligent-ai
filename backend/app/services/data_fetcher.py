import yfinance as yf
import pandas as pd
import numpy as np
import requests
from app.core.assets import TICKER_MAP
from app.services import cache

# Yahoo Finance blocks datacenter IPs without a browser user-agent.
# Pass a custom session with browser headers to all yfinance calls.
_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
})


TIMEFRAME_MAP = {
    "1d":  {"interval": "1d",  "start": "1993-01-01"},
    "1wk": {"interval": "1wk", "start": "1985-01-01"},
    "1mo": {"interval": "1mo", "start": "1970-01-01"},
}

# How many bars the CHART endpoint returns to the frontend.
# The backtester always uses the full history; the chart uses a recent window
# to keep rendering fast and visually clean.
CHART_BAR_LIMIT = {
    "1d":  504,   # ~2 years of trading days
    "1wk": 260,   # ~5 years of weeks
    "1mo": 120,   # ~10 years of months
}


def fetch_ohlcv(asset: str, timeframe: str = "1d") -> pd.DataFrame:
    """
    Fetch OHLCV data for a given asset and timeframe.
    Returns a DataFrame with columns: open, high, low, close, volume (lowercase).
    Index is DatetimeIndex in UTC. Results are cached for 15 minutes.
    """
    if asset not in TICKER_MAP:
        raise ValueError(f"Unknown asset '{asset}'")
    if timeframe not in TIMEFRAME_MAP:
        raise ValueError(f"Unsupported timeframe '{timeframe}'. Choose from {list(TIMEFRAME_MAP)}")

    cached = cache.get_ohlcv(asset, timeframe)
    if cached is not None:
        return cached

    params = TIMEFRAME_MAP[timeframe]
    ticker = yf.Ticker(asset, session=_SESSION)
    df = ticker.history(interval=params["interval"], start=params["start"])

    if df.empty:
        raise RuntimeError(f"No data returned for {asset} on {timeframe}")

    df.index = pd.to_datetime(df.index, utc=True)
    df.columns = [c.lower() for c in df.columns]
    df = df[["open", "high", "low", "close", "volume"]].dropna()

    # yfinance returns open ≈ close for many forex/commodity bars (values differ
    # only at float precision beyond 6 dp, so == misses them). Use np.isclose.
    # Check ratio on the chart window (recent bars) — not full history.
    # Old historical data is fine; only recent yfinance forex data has open≈close.
    chart_limit = CHART_BAR_LIMIT.get(timeframe, 504)
    recent = df.tail(chart_limit)
    same_open_close = np.isclose(recent["open"], recent["close"], rtol=0, atol=1e-5).mean()
    if same_open_close > 0.3:
        df["open"] = df["close"].shift(1).fillna(df["close"])

    # Clamp high/low so bars are always OHLC-consistent.
    # lightweight-charts silently drops bars where high < open/close or
    # low > open/close, making forex/commodity charts appear blank.
    df["high"] = df[["open", "high", "close"]].max(axis=1)
    df["low"]  = df[["open", "low",  "close"]].min(axis=1)

    cache.set_ohlcv(asset, timeframe, df)
    return df


def fetch_ohlcv_chart(asset: str, timeframe: str = "1d") -> pd.DataFrame:
    """
    Returns a recent-window slice of OHLCV data suitable for chart display.
    The full history is fetched and cached once; this just limits what the
    frontend receives so the chart stays fast and uncluttered.
    """
    df = fetch_ohlcv(asset, timeframe)
    limit = CHART_BAR_LIMIT.get(timeframe, 504)
    return df.tail(limit)
