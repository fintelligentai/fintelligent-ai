from fastapi import APIRouter, Query
from app.services import cache

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/cache")
async def get_cache_status():
    """Show what's currently cached and how old each entry is."""
    return cache.cache_status()


@router.delete("/cache")
async def clear_cache(
    asset: str | None = Query(default=None),
    timeframe: str = Query(default="1d"),
):
    """
    Bust the cache. Pass ?asset=BTC-USD to invalidate one asset,
    or omit to clear everything.
    """
    if asset:
        cache.invalidate(asset, timeframe)
        return {"cleared": f"{asset}:{timeframe}"}
    cache.invalidate_all()
    return {"cleared": "all"}
