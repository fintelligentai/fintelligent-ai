from fastapi import APIRouter, HTTPException, Query
from app.core.assets import TICKER_MAP
from app.core.config import settings
from app.services.zone_detector import analyze_asset
from app.services.signal_engine import compute_signals
from app.services.commentary import get_or_generate_commentary

router = APIRouter(prefix="/commentary", tags=["commentary"])


@router.get("/{asset}")
async def get_commentary(
    asset: str,
    timeframe: str = Query(default="1d"),
):
    if asset not in TICKER_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown asset '{asset}'")
    if timeframe not in settings.supported_timeframes:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe '{timeframe}'")

    info = TICKER_MAP[asset]
    label = info["label"] if isinstance(info, dict) else info.label

    try:
        zones   = analyze_asset(asset, timeframe)
        signals = compute_signals(zones, rr_ratio=2.0)
        result  = get_or_generate_commentary(asset, timeframe, label, zones, signals)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "ticker":       asset,
        "timeframe":    timeframe,
        "commentary":   result["commentary"],
        "generated_at": result["generated_at"],
        "cached":       result["cached"],
    }
