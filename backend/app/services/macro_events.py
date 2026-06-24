"""
Macro Market Events service.

Fetches recent financial news headlines from NewsAPI and maps them to
affected asset categories using a curated keyword → impact rule set.
Results are cached for 30 minutes to stay within the free-tier limit.
"""

import time
import hashlib
import requests
from datetime import datetime, timezone
from app.core.config import settings

# ---------------------------------------------------------------------------
# Curated macro impact rules
# Each rule: (keyword_set, affected_assets, headline_reason)
# affected_assets: list of (category_label, ticker_hint, direction)
# ---------------------------------------------------------------------------

MACRO_RULES = [
    {
        "keywords": ["fed", "federal reserve", "rate hike", "rate rise", "hawkish", "interest rate hike", "fomc"],
        "direction_hint": "hawkish",
        "impacts": [
            {"label": "Gold",        "ticker": "GC=F",    "direction": "bearish", "reason": "Higher rates raise opportunity cost of holding gold"},
            {"label": "USD",         "ticker": "DX-Y.NYB","direction": "bullish", "reason": "Higher rates attract capital to USD"},
            {"label": "Equities",    "ticker": "SPY",     "direction": "bearish", "reason": "Higher borrowing costs compress equity valuations"},
            {"label": "BTC",         "ticker": "BTC-USD", "direction": "bearish", "reason": "Risk-off sentiment pressures crypto"},
        ],
    },
    {
        "keywords": ["fed cut", "rate cut", "dovish", "easing", "pivot", "lower rates"],
        "direction_hint": "dovish",
        "impacts": [
            {"label": "Gold",        "ticker": "GC=F",    "direction": "bullish", "reason": "Lower real rates boost gold appeal"},
            {"label": "USD",         "ticker": "DX-Y.NYB","direction": "bearish", "reason": "Lower rates reduce USD yield premium"},
            {"label": "Equities",    "ticker": "SPY",     "direction": "bullish", "reason": "Lower rates expand equity multiples"},
            {"label": "BTC",         "ticker": "BTC-USD", "direction": "bullish", "reason": "Risk-on / liquidity expansion favours crypto"},
        ],
    },
    {
        "keywords": ["inflation", "cpi", "consumer price", "pce", "core inflation"],
        "direction_hint": "high inflation",
        "impacts": [
            {"label": "Gold",        "ticker": "GC=F",    "direction": "bullish", "reason": "Gold is a classic inflation hedge"},
            {"label": "Oil",         "ticker": "CL=F",    "direction": "bullish", "reason": "Energy is a major CPI component"},
            {"label": "USD",         "ticker": "DX-Y.NYB","direction": "watch",   "reason": "Depends on whether Fed responds with hikes"},
            {"label": "Equities",    "ticker": "SPY",     "direction": "bearish", "reason": "High inflation erodes real earnings"},
        ],
    },
    {
        "keywords": ["opec", "oil supply", "oil cut", "production cut", "crude supply"],
        "direction_hint": "supply cut",
        "impacts": [
            {"label": "Oil",         "ticker": "CL=F",    "direction": "bullish", "reason": "Supply reduction supports crude prices"},
            {"label": "Energy stocks","ticker": "XLE",    "direction": "bullish", "reason": "Higher oil boosts energy sector earnings"},
            {"label": "Equities",    "ticker": "SPY",     "direction": "bearish", "reason": "Higher energy costs weigh on corporate margins"},
        ],
    },
    {
        "keywords": ["oil glut", "oil surplus", "opec increase", "shale boom"],
        "direction_hint": "supply increase",
        "impacts": [
            {"label": "Oil",         "ticker": "CL=F",    "direction": "bearish", "reason": "Oversupply pressures crude prices"},
            {"label": "Energy stocks","ticker": "XLE",    "direction": "bearish", "reason": "Lower oil hits energy sector earnings"},
        ],
    },
    {
        "keywords": ["geopolitical", "war", "conflict", "military", "sanctions", "middle east", "ukraine", "russia"],
        "direction_hint": "geopolitical risk",
        "impacts": [
            {"label": "Gold",        "ticker": "GC=F",    "direction": "bullish", "reason": "Safe-haven demand spikes during geopolitical stress"},
            {"label": "Oil",         "ticker": "CL=F",    "direction": "bullish", "reason": "Supply disruption risk in conflict zones"},
            {"label": "USD",         "ticker": "DX-Y.NYB","direction": "bullish", "reason": "USD benefits from safe-haven flows"},
            {"label": "Equities",    "ticker": "SPY",     "direction": "bearish", "reason": "Risk-off sentiment pressures equities"},
            {"label": "BTC",         "ticker": "BTC-USD", "direction": "watch",   "reason": "Crypto can act as safe haven but also sells off in panic"},
        ],
    },
    {
        "keywords": ["china gdp", "china economy", "china slowdown", "china data", "pmi china"],
        "direction_hint": "China weakness",
        "impacts": [
            {"label": "Copper",      "ticker": "HG=F",    "direction": "bearish", "reason": "China is the world's largest copper consumer"},
            {"label": "AUD/USD",     "ticker": "AUDUSD=X","direction": "bearish", "reason": "Australia's economy is closely tied to Chinese demand"},
            {"label": "Oil",         "ticker": "CL=F",    "direction": "bearish", "reason": "China is a top global oil importer"},
            {"label": "Equities",    "ticker": "SPY",     "direction": "bearish", "reason": "Global growth concerns from a China slowdown"},
        ],
    },
    {
        "keywords": ["us jobs", "nonfarm payroll", "unemployment", "jobs report", "labor market"],
        "direction_hint": "strong jobs",
        "impacts": [
            {"label": "USD",         "ticker": "DX-Y.NYB","direction": "bullish", "reason": "Strong jobs data supports Fed hawkish expectations"},
            {"label": "Gold",        "ticker": "GC=F",    "direction": "bearish", "reason": "Strong economy reduces safe-haven demand"},
            {"label": "Equities",    "ticker": "SPY",     "direction": "watch",   "reason": "Good jobs = healthy economy but may trigger rate fear"},
        ],
    },
    {
        "keywords": ["recession", "gdp contraction", "economic slowdown", "stagflation"],
        "direction_hint": "recession risk",
        "impacts": [
            {"label": "Gold",        "ticker": "GC=F",    "direction": "bullish", "reason": "Recession drives safe-haven demand"},
            {"label": "Equities",    "ticker": "SPY",     "direction": "bearish", "reason": "Earnings contract in recessions"},
            {"label": "Oil",         "ticker": "CL=F",    "direction": "bearish", "reason": "Demand destruction hits energy prices"},
            {"label": "BTC",         "ticker": "BTC-USD", "direction": "bearish", "reason": "Risk assets sell off in recessions"},
        ],
    },
    {
        "keywords": ["tariff", "trade war", "trade dispute", "import duty", "export ban"],
        "direction_hint": "trade tension",
        "impacts": [
            {"label": "USD",         "ticker": "DX-Y.NYB","direction": "watch",   "reason": "Tariffs are inflationary but can trigger global dollar demand"},
            {"label": "Equities",    "ticker": "SPY",     "direction": "bearish", "reason": "Trade barriers disrupt supply chains and earnings"},
            {"label": "Gold",        "ticker": "GC=F",    "direction": "bullish", "reason": "Uncertainty drives safe-haven buying"},
            {"label": "Copper",      "ticker": "HG=F",    "direction": "bearish", "reason": "Trade friction suppresses industrial metals"},
        ],
    },
    {
        "keywords": ["crypto", "bitcoin", "ethereum", "sec", "crypto regulation", "crypto ban", "stablecoin"],
        "direction_hint": "crypto regulatory",
        "impacts": [
            {"label": "BTC",         "ticker": "BTC-USD", "direction": "watch",   "reason": "Regulatory news creates high short-term volatility"},
            {"label": "ETH",         "ticker": "ETH-USD", "direction": "watch",   "reason": "ETH closely correlated with regulatory sentiment"},
        ],
    },
]

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

_cache: dict = {}
CACHE_TTL = 30 * 60  # 30 minutes


def _cache_key(query: str) -> str:
    return hashlib.md5(query.encode()).hexdigest()


# ---------------------------------------------------------------------------
# News fetcher
# ---------------------------------------------------------------------------

NEWSAPI_URL = "https://newsapi.org/v2/everything"
NEWSAPI_HEADLINES_URL = "https://newsapi.org/v2/top-headlines"

MACRO_SEARCH_QUERY = (
    "federal reserve OR inflation OR oil price OR opec OR gold price OR "
    "geopolitical OR trade war OR tariff OR recession OR china economy OR "
    "interest rate OR jobs report OR cryptocurrency"
)


def _fetch_newsapi(api_key: str) -> list[dict]:
    """Fetch recent macro-relevant headlines from NewsAPI."""
    params = {
        "q": MACRO_SEARCH_QUERY,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 30,
        "apiKey": api_key,
    }
    resp = requests.get(NEWSAPI_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data.get("articles", [])


# ---------------------------------------------------------------------------
# Classifier
# ---------------------------------------------------------------------------

def _classify_headline(title: str, description: str | None) -> dict | None:
    """Match a headline against macro rules. Returns best matching rule or None."""
    text = (title + " " + (description or "")).lower()
    for rule in MACRO_RULES:
        for kw in rule["keywords"]:
            if kw in text:
                return rule
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_macro_events(limit: int = 15) -> dict:
    """Return classified macro events. Cached for 30 minutes."""
    cache_key = f"macro_{limit}"
    cached = _cache.get(cache_key)
    if cached and time.time() - cached["ts"] < CACHE_TTL:
        return cached["data"]

    api_key = settings.newsapi_key
    if not api_key:
        result = {"events": [], "fetched_at": datetime.now(timezone.utc).isoformat(), "error": "NEWSAPI_KEY not configured"}
        return result

    try:
        articles = _fetch_newsapi(api_key)
    except Exception as e:
        result = {"events": [], "fetched_at": datetime.now(timezone.utc).isoformat(), "error": str(e)}
        return result

    events = []
    seen_titles: set[str] = set()

    for article in articles:
        title = article.get("title") or ""
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)

        rule = _classify_headline(title, article.get("description"))
        if rule is None:
            continue

        events.append({
            "title": title,
            "source": article.get("source", {}).get("name", ""),
            "url": article.get("url", ""),
            "published_at": article.get("publishedAt", ""),
            "direction_hint": rule["direction_hint"],
            "impacts": rule["impacts"],
        })

        if len(events) >= limit:
            break

    result = {
        "events": events,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "error": None,
    }
    _cache[cache_key] = {"ts": time.time(), "data": result}
    return result
