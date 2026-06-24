from fastapi import APIRouter, HTTPException, Query
from app.core.assets import TICKER_MAP
from app.core.config import settings
from app.services.backtest import get_backtest

router = APIRouter(prefix="/backtest", tags=["backtest"])


@router.get("/{asset}")
def get_backtest_stats(
    asset: str,
    timeframe: str = Query(default="1d"),
):
    if asset not in TICKER_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown asset '{asset}'")
    if timeframe not in settings.supported_timeframes:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe '{timeframe}'")

    try:
        return get_backtest(asset, timeframe)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
