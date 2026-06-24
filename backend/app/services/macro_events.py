"""
Macro Market Events service — RSS-based, no API key required.

Sources:
  - Google News RSS (keyword-searchable, real-time)
  - Reuters business/markets RSS
  - CNBC markets RSS
  - MarketWatch top stories RSS

Results are cached for 20 minutes.
"""

import time
import feedparser
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

# ---------------------------------------------------------------------------
# RSS feed sources
# ---------------------------------------------------------------------------

GOOGLE_NEWS_QUERIES = [
    "federal reserve interest rates",
    "oil price OPEC",
    "gold price inflation",
    "US economy recession GDP",
    "China economy trade",
    "geopolitical conflict markets",
    "tariff trade war",
    "cryptocurrency regulation bitcoin",
    "jobs report unemployment",
]

DIRECT_FEEDS = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://feeds.reuters.com/reuters/UKdomesticNews",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",   # CNBC markets
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",    # CNBC economy
    "https://feeds.marketwatch.com/marketwatch/topstories/",
]

GOOGLE_RSS_BASE = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"

# ---------------------------------------------------------------------------
# Macro impact rules (same as before — keyword → affected assets)
# ---------------------------------------------------------------------------

MACRO_RULES = [
    {
        "keywords": ["fed", "federal reserve", "rate hike", "rate rise", "hawkish", "interest rate hike", "fomc"],
        "direction_hint": "Fed hawkish",
        "impacts": [
            {"label": "Gold",     "ticker": "GC=F",     "direction": "bearish", "reason": "Higher rates raise opportunity cost of holding gold"},
            {"label": "USD",      "ticker": "DX-Y.NYB", "direction": "bullish", "reason": "Higher rates attract capital to USD"},
            {"label": "Equities", "ticker": "SPY",      "direction": "bearish", "reason": "Higher borrowing costs compress equity valuations"},
            {"label": "BTC",      "ticker": "BTC-USD",  "direction": "bearish", "reason": "Risk-off sentiment pressures crypto"},
        ],
    },
    {
        "keywords": ["rate cut", "dovish", "easing", "fed pivot", "lower rates"],
        "direction_hint": "Fed dovish",
        "impacts": [
            {"label": "Gold",     "ticker": "GC=F",     "direction": "bullish", "reason": "Lower real rates boost gold appeal"},
            {"label": "USD",      "ticker": "DX-Y.NYB", "direction": "bearish", "reason": "Lower rates reduce USD yield premium"},
            {"label": "Equities", "ticker": "SPY",      "direction": "bullish", "reason": "Lower rates expand equity multiples"},
            {"label": "BTC",      "ticker": "BTC-USD",  "direction": "bullish", "reason": "Risk-on / liquidity expansion favours crypto"},
        ],
    },
    {
        "keywords": ["inflation", "cpi", "consumer price", "pce", "core inflation"],
        "direction_hint": "Inflation data",
        "impacts": [
            {"label": "Gold",     "ticker": "GC=F",     "direction": "bullish", "reason": "Gold is a classic inflation hedge"},
            {"label": "Oil",      "ticker": "CL=F",     "direction": "bullish", "reason": "Energy is a major CPI component"},
            {"label": "USD",      "ticker": "DX-Y.NYB", "direction": "watch",   "reason": "Depends on whether Fed responds with hikes"},
            {"label": "Equities", "ticker": "SPY",      "direction": "bearish", "reason": "High inflation erodes real earnings"},
        ],
    },
    {
        "keywords": ["opec", "oil supply", "oil cut", "production cut", "crude supply", "oil price"],
        "direction_hint": "Oil supply",
        "impacts": [
            {"label": "Oil",          "ticker": "CL=F", "direction": "bullish", "reason": "Supply reduction supports crude prices"},
            {"label": "Energy stocks","ticker": "XLE",  "direction": "bullish", "reason": "Higher oil boosts energy sector earnings"},
            {"label": "Equities",     "ticker": "SPY",  "direction": "bearish", "reason": "Higher energy costs weigh on corporate margins"},
        ],
    },
    {
        "keywords": ["geopolit", "war", "conflict", "military strike", "sanctions", "middle east", "ukraine", "russia"],
        "direction_hint": "Geopolitical risk",
        "impacts": [
            {"label": "Gold",     "ticker": "GC=F",     "direction": "bullish", "reason": "Safe-haven demand spikes during geopolitical stress"},
            {"label": "Oil",      "ticker": "CL=F",     "direction": "bullish", "reason": "Supply disruption risk in conflict zones"},
            {"label": "USD",      "ticker": "DX-Y.NYB", "direction": "bullish", "reason": "USD benefits from safe-haven flows"},
            {"label": "Equities", "ticker": "SPY",      "direction": "bearish", "reason": "Risk-off sentiment pressures equities"},
            {"label": "BTC",      "ticker": "BTC-USD",  "direction": "watch",   "reason": "Crypto can act as safe haven but also sells off in panic"},
        ],
    },
    {
        "keywords": ["china gdp", "china economy", "china slowdown", "china pmi", "china data"],
        "direction_hint": "China weakness",
        "impacts": [
            {"label": "Copper",  "ticker": "HG=F",   "direction": "bearish", "reason": "China is the world's largest copper consumer"},
            {"label": "AUD/USD", "ticker": "AUDUSD=X","direction": "bearish", "reason": "Australia's economy is closely tied to Chinese demand"},
            {"label": "Oil",     "ticker": "CL=F",   "direction": "bearish", "reason": "China is a top global oil importer"},
        ],
    },
    {
        "keywords": ["nonfarm payroll", "jobs report", "unemployment", "labor market", "jobless claims"],
        "direction_hint": "US jobs data",
        "impacts": [
            {"label": "USD",      "ticker": "DX-Y.NYB", "direction": "bullish", "reason": "Strong jobs data supports Fed hawkish expectations"},
            {"label": "Gold",     "ticker": "GC=F",     "direction": "bearish", "reason": "Strong economy reduces safe-haven demand"},
            {"label": "Equities", "ticker": "SPY",      "direction": "watch",   "reason": "Good jobs = healthy economy but may trigger rate fear"},
        ],
    },
    {
        "keywords": ["recession", "gdp contraction", "economic slowdown", "stagflation", "gdp shrink"],
        "direction_hint": "Recession risk",
        "impacts": [
            {"label": "Gold",     "ticker": "GC=F",    "direction": "bullish", "reason": "Recession drives safe-haven demand"},
            {"label": "Equities", "ticker": "SPY",     "direction": "bearish", "reason": "Earnings contract in recessions"},
            {"label": "Oil",      "ticker": "CL=F",    "direction": "bearish", "reason": "Demand destruction hits energy prices"},
            {"label": "BTC",      "ticker": "BTC-USD", "direction": "bearish", "reason": "Risk assets sell off in recessions"},
        ],
    },
    {
        "keywords": ["tariff", "trade war", "trade dispute", "import duty", "export ban", "trade tension"],
        "direction_hint": "Trade tension",
        "impacts": [
            {"label": "USD",      "ticker": "DX-Y.NYB", "direction": "watch",   "reason": "Tariffs are inflationary but can trigger global dollar demand"},
            {"label": "Equities", "ticker": "SPY",      "direction": "bearish", "reason": "Trade barriers disrupt supply chains and earnings"},
            {"label": "Gold",     "ticker": "GC=F",     "direction": "bullish", "reason": "Uncertainty drives safe-haven buying"},
            {"label": "Copper",   "ticker": "HG=F",     "direction": "bearish", "reason": "Trade friction suppresses industrial metals"},
        ],
    },
    {
        "keywords": ["bitcoin", "crypto", "ethereum", "sec crypto", "crypto regulation", "stablecoin", "digital asset"],
        "direction_hint": "Crypto news",
        "impacts": [
            {"label": "BTC", "ticker": "BTC-USD", "direction": "watch", "reason": "Regulatory/macro news creates high short-term volatility"},
            {"label": "ETH", "ticker": "ETH-USD", "direction": "watch", "reason": "ETH closely correlated with BTC sentiment"},
        ],
    },
]

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

_cache: dict = {}
CACHE_TTL = 20 * 60  # 20 minutes


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _classify(title: str, summary: str | None) -> dict | None:
    text = (title + " " + (summary or "")).lower()
    for rule in MACRO_RULES:
        for kw in rule["keywords"]:
            if kw in text:
                return rule
    return None


def _parse_date(entry) -> str:
    """Return ISO timestamp from a feedparser entry, falling back to now."""
    for attr in ("published", "updated"):
        raw = getattr(entry, attr, None)
        if raw:
            try:
                return parsedate_to_datetime(raw).isoformat()
            except Exception:
                pass
    return datetime.now(timezone.utc).isoformat()


def _fetch_feed(url: str) -> list[dict]:
    feed = feedparser.parse(url)
    articles = []
    for entry in feed.entries:
        title = getattr(entry, "title", "") or ""
        if not title:
            continue
        # Google News prefixes "Source - " — strip it
        if " - " in title:
            title = title.rsplit(" - ", 1)[0].strip()
        articles.append({
            "title": title,
            "source": feed.feed.get("title", "") or getattr(entry, "source", {}).get("title", ""),
            "url": getattr(entry, "link", ""),
            "published_at": _parse_date(entry),
            "summary": getattr(entry, "summary", "") or "",
        })
    return articles


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_macro_events(limit: int = 15) -> dict:
    cache_key = f"macro_{limit}"
    cached = _cache.get(cache_key)
    if cached and time.time() - cached["ts"] < CACHE_TTL:
        return cached["data"]

    all_articles: list[dict] = []

    # Google News keyword feeds
    for query in GOOGLE_NEWS_QUERIES:
        url = GOOGLE_RSS_BASE.format(query=query.replace(" ", "+"))
        try:
            all_articles.extend(_fetch_feed(url))
        except Exception:
            pass

    # Direct financial RSS feeds
    for url in DIRECT_FEEDS:
        try:
            all_articles.extend(_fetch_feed(url))
        except Exception:
            pass

    # Sort newest first
    all_articles.sort(key=lambda a: a["published_at"], reverse=True)

    events = []
    seen: set[str] = set()

    for article in all_articles:
        title = article["title"]
        if not title or title in seen:
            continue
        seen.add(title)

        rule = _classify(title, article.get("summary"))
        if rule is None:
            continue

        events.append({
            "title": title,
            "source": article["source"],
            "url": article["url"],
            "published_at": article["published_at"],
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
