from fastapi import APIRouter, HTTPException, Query
from app.services.data_fetcher import fetch_ohlcv_chart
from app.core.assets import TICKER_MAP
from app.core.config import settings

router = APIRouter(prefix="/ohlcv", tags=["ohlcv"])


@router.get("/{asset}")
def get_ohlcv(
    asset: str,
    timeframe: str = Query(default="1d"),
):
    if asset not in TICKER_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown asset '{asset}'")

    try:
        df = fetch_ohlcv_chart(asset, timeframe)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    records = []
    for ts, row in df.iterrows():
        records.append({
            "time": int(ts.timestamp()),
            "open": round(float(row["open"]), 6),
            "high": round(float(row["high"]), 6),
            "low": round(float(row["low"]), 6),
            "close": round(float(row["close"]), 6),
        })
    return records
