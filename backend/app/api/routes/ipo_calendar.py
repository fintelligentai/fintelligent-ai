from fastapi import APIRouter
from app.services.ipo_calendar import get_ipo_calendar

router = APIRouter(prefix="/ipo-calendar", tags=["ipo-calendar"])


@router.get("")
def ipo_calendar():
    return get_ipo_calendar()
