from fastapi import APIRouter, Query
from app.services.macro_events import get_macro_events

router = APIRouter(prefix="/macro-events", tags=["macro-events"])


@router.get("")
def macro_events(limit: int = Query(default=15, ge=1, le=30)):
    return get_macro_events(limit)
