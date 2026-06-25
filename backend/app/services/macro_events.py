"""
Macro Market Events service — RSS-based, no API key required.

Two classification passes:
  Pass 1 — Curated keyword matching for macro/geopolitical themes
            (Fed policy, OPEC, inflation, geopolitics, etc.)
  Pass 2 — Claude AI classification for company-specific catalysts
            (earnings, product launches, FDA, M&A, CEO changes, etc.)
            Only runs on headlines that didn't match Pass 1.

Sources: Google News RSS, Reuters, CNBC, MarketWatch.
Cache: 20 minutes.
"""

import json
import time
import feedparser
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from app.core.config import settings

# ---------------------------------------------------------------------------
# RSS sources
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
    "earnings surprise revenue",
    "FDA approval drug",
    "merger acquisition deal",
]

DIRECT_FEEDS = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://feeds.reuters.com/reuters/UKdomesticNews",
    "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",
    "https://feeds.marketwatch.com/marketwatch/topstories/",
]

GOOGLE_RSS_BASE = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"

# ---------------------------------------------------------------------------
# Macro impact rules (Pass 1)
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
            {"label": "Copper",  "ticker": "HG=F",    "direction": "bearish", "reason": "China is the world's largest copper consumer"},
            {"label": "AUD/USD", "ticker": "AUDUSD=X","direction": "bearish", "reason": "Australia's economy is closely tied to Chinese demand"},
            {"label": "Oil",     "ticker": "CL=F",    "direction": "bearish", "reason": "China is a top global oil importer"},
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
# RSS helpers
# ---------------------------------------------------------------------------

def _parse_date(entry) -> str:
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
# Pass 1 — curated macro keyword matching
# ---------------------------------------------------------------------------

def _macro_classify(title: str, summary: str | None) -> dict | None:
    text = (title + " " + (summary or "")).lower()
    for rule in MACRO_RULES:
        for kw in rule["keywords"]:
            if kw in text:
                return rule
    return None

# ---------------------------------------------------------------------------
# Pass 2 — Claude AI company-specific classification
# ---------------------------------------------------------------------------

AI_BATCH_SIZE = 25  # headlines per Claude call

AI_PROMPT = """\
You are a financial news classifier. Analyze the headlines below and identify \
company-specific market catalysts — events that have a direct, material impact \
on a specific publicly traded company's stock price.

Qualifying event types: earnings beat/miss, revenue guidance, product launch, \
FDA approval/rejection, M&A deal, CEO/leadership change, major contract win/loss, \
regulatory action, IPO, share buyback, dividend change, lawsuit outcome, \
data breach, major partnership.

For each qualifying headline return a JSON object. Skip headlines that are:
- General market commentary with no specific company
- Already macro/geopolitical themes (Fed, oil, gold, inflation, geopolitics)
- Unclear, opinion pieces, or listicles

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    "i": <headline index as integer>,
    "ticker": "<US exchange ticker, e.g. AAPL>",
    "company": "<full company name>",
    "event_type": "<short label e.g. Earnings Beat, FDA Approval, Product Launch>",
    "direction": "<bullish|bearish|watch>",
    "reason": "<one sentence why this moves the stock>"
  }
]

If no headlines qualify, return [].

Headlines:
"""


def _ai_classify_company_events(articles: list[dict]) -> list[dict]:
    """Send a batch of unmatched headlines to Claude and parse company events."""
    api_key = settings.anthropic_api_key
    if not api_key:
        return []

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
    except Exception:
        return []

    results = []
    # Process in batches
    for batch_start in range(0, len(articles), AI_BATCH_SIZE):
        batch = articles[batch_start: batch_start + AI_BATCH_SIZE]
        headlines_text = "\n".join(
            f"{i}. {a['title']}" for i, a in enumerate(batch)
        )

        try:
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{"role": "user", "content": AI_PROMPT + headlines_text}],
            )
            raw = response.content[0].text.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            classified = json.loads(raw)
        except Exception:
            continue

        for item in classified:
            idx = item.get("i")
            if idx is None or not isinstance(idx, int) or idx >= len(batch):
                continue
            article = batch[idx]
            results.append({
                "category": "company",
                "title": article["title"],
                "source": article["source"],
                "url": article["url"],
                "published_at": article["published_at"],
                "ticker": item.get("ticker", ""),
                "company": item.get("company", ""),
                "event_type": item.get("event_type", ""),
                "direction": item.get("direction", "watch"),
                "reason": item.get("reason", ""),
                # not used by company card but keeps schema consistent
                "direction_hint": item.get("event_type", ""),
                "impacts": [],
            })

    return results

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_macro_events(limit: int = 15) -> dict:
    cache_key = f"macro_{limit}"
    cached = _cache.get(cache_key)
    if cached and time.time() - cached["ts"] < CACHE_TTL:
        return cached["data"]

    all_articles: list[dict] = []

    for query in GOOGLE_NEWS_QUERIES:
        url = GOOGLE_RSS_BASE.format(query=query.replace(" ", "+"))
        try:
            all_articles.extend(_fetch_feed(url))
        except Exception:
            pass

    for url in DIRECT_FEEDS:
        try:
            all_articles.extend(_fetch_feed(url))
        except Exception:
            pass

    all_articles.sort(key=lambda a: a["published_at"], reverse=True)

    # Deduplicate by title
    seen: set[str] = set()
    unique: list[dict] = []
    for a in all_articles:
        if a["title"] and a["title"] not in seen:
            seen.add(a["title"])
            unique.append(a)

    # Pass 1 — macro keyword matching
    macro_events: list[dict] = []
    unmatched: list[dict] = []
    for article in unique:
        rule = _macro_classify(article["title"], article.get("summary"))
        if rule:
            macro_events.append({
                "category": "macro",
                "title": article["title"],
                "source": article["source"],
                "url": article["url"],
                "published_at": article["published_at"],
                "direction_hint": rule["direction_hint"],
                "impacts": rule["impacts"],
                # not used by macro card
                "ticker": "",
                "company": "",
                "event_type": "",
                "direction": "",
                "reason": "",
            })
        else:
            unmatched.append(article)

    # Pass 2 — AI company classification (on unmatched headlines only)
    company_events = _ai_classify_company_events(unmatched[:50])

    # Merge and sort newest first
    all_events = macro_events + company_events
    all_events.sort(key=lambda e: e["published_at"], reverse=True)

    result = {
        "events": all_events[:limit],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "error": None,
    }
    _cache[cache_key] = {"ts": time.time(), "data": result}
    return result
