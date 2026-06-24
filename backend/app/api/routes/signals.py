from fastapi import APIRouter, HTTPException, Query
from app.models.signal import SignalResult
from app.services.zone_detector import analyze_asset
from app.services.signal_engine import compute_signals
from app.services.data_fetcher import fetch_ohlcv
from app.core.assets import TICKER_MAP
from app.core.config import settings

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("/{asset}", response_model=SignalResult)
def get_signals(
    asset: str,
    timeframe: str = Query(default="1d"),
    rr: float = Query(default=2.0, ge=0.5, le=20.0, description="Risk:Reward ratio"),
):
    """
    Compute BUY/SELL trade signals for a given asset based on S&D zone analysis.
    """
    if asset not in TICKER_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown asset '{asset}'")
    if timeframe not in settings.supported_timeframes:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe '{timeframe}'")

    try:
        zones = analyze_asset(asset, timeframe)
        df    = fetch_ohlcv(asset, timeframe)
        return compute_signals(zones, rr_ratio=rr, df=df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
