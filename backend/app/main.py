from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import zones, ohlcv, admin, assets, signals
from app.api.routes import scanner, commentary, backtest, political_trades, insider_trades, ipo_calendar
from app.db.commentary import init_db
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from app.services.scanner import start_background_scanner
    start_background_scanner()
    # Warm insider trades cache in background so first user request is fast
    import threading
    from app.services.insider_trades import get_significant_activity
    threading.Thread(target=get_significant_activity, daemon=True).start()
    yield


app = FastAPI(
    title=settings.app_name,
    description="AI-powered Supply & Demand market zone analyzer",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router,  prefix="/api/v1")
app.include_router(zones.router,   prefix="/api/v1")
app.include_router(ohlcv.router,   prefix="/api/v1")
app.include_router(signals.router, prefix="/api/v1")
app.include_router(scanner.router,    prefix="/api/v1")
app.include_router(commentary.router, prefix="/api/v1")
app.include_router(backtest.router,   prefix="/api/v1")
app.include_router(political_trades.router, prefix="/api/v1")
app.include_router(insider_trades.router,  prefix="/api/v1")
app.include_router(ipo_calendar.router,    prefix="/api/v1")
app.include_router(admin.router,           prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
