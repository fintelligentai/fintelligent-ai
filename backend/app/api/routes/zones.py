from fastapi import APIRouter, HTTPException, Query
from app.models.zone import ZoneDetectionResult
from app.services.zone_detector import analyze_asset
from app.core.assets import TICKER_MAP
from app.core.config import settings

router = APIRouter(prefix="/zones", tags=["zones"])


@router.get("/{asset}", response_model=ZoneDetectionResult)
def get_zones(
    asset: str,
    timeframe: str = Query(default="1d"),
):
    if asset not in TICKER_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown asset '{asset}'")
    if timeframe not in settings.supported_timeframes:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe '{timeframe}'")

    try:
        return analyze_asset(asset, timeframe)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
