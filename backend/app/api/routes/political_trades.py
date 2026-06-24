from fastapi import APIRouter, Query
from app.services.political_trades import get_all_trades, get_trades_for_ticker

router = APIRouter(prefix="/political-trades", tags=["political-trades"])


@router.get("")
def list_trades(limit: int = Query(default=200, ge=1, le=500)):
    return get_all_trades(limit=limit)


@router.get("/{ticker}")
def trades_for_ticker(ticker: str, limit: int = Query(default=50, ge=1, le=200)):
    return get_trades_for_ticker(ticker=ticker, limit=limit)
