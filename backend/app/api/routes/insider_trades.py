from fastapi import APIRouter, Query
from app.services.insider_trades import get_insider_trades_for_ticker, get_recent_insider_trades, get_significant_activity, get_news_for_ticker

router = APIRouter(prefix="/insider-trades", tags=["insider-trades"])


@router.get("/significant")
def significant_activity(limit: int = Query(default=50, ge=1, le=100)):
    return get_significant_activity(limit=limit)


@router.get("")
def list_recent_trades(limit: int = Query(default=100, ge=1, le=200)):
    return get_recent_insider_trades(limit=limit)


@router.get("/{ticker}/news")
def ticker_news(ticker: str, limit: int = Query(default=5, ge=1, le=10)):
    return {"ticker": ticker.upper(), "articles": get_news_for_ticker(ticker, limit=limit)}


@router.get("/{ticker}")
def trades_for_ticker(ticker: str, limit: int = Query(default=30, ge=1, le=100)):
    return get_insider_trades_for_ticker(ticker=ticker, limit=limit)
