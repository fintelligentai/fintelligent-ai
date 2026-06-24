from fastapi import APIRouter, Query
from app.services.scanner import get_results

router = APIRouter(prefix="/scanner", tags=["scanner"])


@router.get("/results")
async def get_scan_results(
    category:    str | None = Query(default=None),
    signal_type: str | None = Query(default=None),
    limit:       int        = Query(default=50, le=200),
):
    results, status = get_results()

    if category:
        results = [r for r in results if r["category"] == category]
    if signal_type:
        results = [r for r in results if r["signal_type"] == signal_type]

    return {
        "results": results[:limit],
        "total":   len(results),
        "status":  status,
    }
