from fastapi import APIRouter, Query
from app.core.assets import ASSETS, search_assets, AssetCategory

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/")
async def list_assets(
    category: AssetCategory | None = Query(default=None),
):
    """Return all assets, optionally filtered by category."""
    if category:
        return [a for a in ASSETS if a["category"] == category]
    return ASSETS


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    category: AssetCategory | None = Query(default=None),
):
    """Search assets by ticker or name. Returns up to 20 matches."""
    return search_assets(q, category)
