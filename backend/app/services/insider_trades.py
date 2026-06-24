"""
Insider trades service — parses SEC EDGAR Form 4 filings.

Form 4 is filed by corporate insiders (officers, directors, 10%+ shareholders)
within 2 business days of any transaction. Completely free, no API key needed.

Flow per ticker:
  1. Map ticker → CIK via SEC company tickers JSON (cached 24h)
  2. Fetch recent Form 4 filings via company submissions API
  3. Parse each Form 4 XML to extract transaction details
  4. Cache results per ticker for 6 hours

Flow for "all recent":
  1. Fetch EDGAR recent Form 4 atom feed
  2. Parse top N filings
  3. Cache 1 hour
"""

import time
import threading
import requests
import xml.etree.ElementTree as ET
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Fintelligent lxndros00@gmail.com"}

TICKERS_URL   = "https://www.sec.gov/files/company_tickers.json"
RECENT_FEED   = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&dateb=&owner=include&count=200&output=atom"

TICKER_CACHE_TTL   = 24 * 3600
PER_TICKER_TTL     = 6  * 3600
RECENT_TTL         = 1  * 3600

# Transaction codes we actually want to show
MEANINGFUL_CODES = {"P", "S"}
CODE_LABEL = {
    "P": "Buy",
    "S": "Sell",
    "M": "Option Exercise",
    "F": "Tax Withholding",
    "G": "Gift",
    "A": "Award",
}

_lock             = threading.Lock()
_ticker_map: dict = {}          # ticker → cik_str
_ticker_map_at    = 0.0

_per_ticker_cache: dict[str, dict] = {}  # ticker → {data, at}
_recent_cache: dict = {"data": [], "at": 0.0}


# ---------------------------------------------------------------------------
# Ticker → CIK mapping
# ---------------------------------------------------------------------------

def _get_ticker_map() -> dict[str, str]:
    global _ticker_map, _ticker_map_at
    with _lock:
        if time.time() - _ticker_map_at > TICKER_CACHE_TTL or not _ticker_map:
            try:
                r = requests.get(TICKERS_URL, headers=HEADERS, timeout=15)
                r.raise_for_status()
                raw = r.json()
                _ticker_map = {
                    v["ticker"].upper(): str(v["cik_str"]).zfill(10)
                    for v in raw.values()
                    if v.get("ticker")
                }
                _ticker_map_at = time.time()
                logger.info(f"Loaded {len(_ticker_map)} ticker→CIK mappings")
            except Exception as e:
                logger.warning(f"Failed to load ticker map: {e}")
    return _ticker_map


def _ticker_to_cik(ticker: str) -> Optional[str]:
    m = _get_ticker_map()
    return m.get(ticker.upper())


# ---------------------------------------------------------------------------
# Form 4 XML parser
# ---------------------------------------------------------------------------

def _tag(el) -> str:
    return el.tag.split("}")[-1] if "}" in el.tag else el.tag


def _child_text(el, tag: str) -> Optional[str]:
    for child in el:
        if _tag(child) == tag:
            # value may be nested inside a <value> element
            val_el = next((c for c in child if _tag(c) == "value"), None)
            return (val_el.text if val_el is not None else child.text) or None
    return None


def _parse_form4_xml(xml_bytes: bytes, file_date: str) -> list[dict]:
    """Parse a Form 4 XML and return a list of transaction dicts."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []

    # Issuer
    issuer_el = next((c for c in root if _tag(c) == "issuer"), None)
    ticker    = _child_text(issuer_el, "issuerTradingSymbol") if issuer_el is not None else None
    company   = _child_text(issuer_el, "issuerName") if issuer_el is not None else None

    # Reporting owner
    owner_el  = next((c for c in root if _tag(c) == "reportingOwner"), None)
    oid_el    = next((c for c in owner_el if _tag(c) == "reportingOwnerId"), None) if owner_el is not None else None
    rel_el    = next((c for c in owner_el if _tag(c) == "reportingOwnerRelationship"), None) if owner_el is not None else None

    insider_name  = _child_text(oid_el, "rptOwnerName") if oid_el is not None else None
    title         = _child_text(rel_el, "officerTitle") if rel_el is not None else None
    is_director   = _child_text(rel_el, "isDirector") if rel_el is not None else "0"
    is_officer    = _child_text(rel_el, "isOfficer") if rel_el is not None else "0"
    is_ten_pct    = _child_text(rel_el, "isTenPercentOwner") if rel_el is not None else "0"

    role = title or (
        "Director" if is_director == "1" else
        "10% Owner" if is_ten_pct == "1" else
        "Officer"  if is_officer  == "1" else
        "Insider"
    )

    trades = []

    # Non-derivative transactions (direct stock buys/sells)
    nd_table = next((c for c in root if _tag(c) == "nonDerivativeTable"), None)
    if nd_table is not None:
        for txn in nd_table:
            if _tag(txn) != "nonDerivativeTransaction":
                continue

            amounts_el = next((c for c in txn if _tag(c) == "transactionAmounts"), None)
            coding_el  = next((c for c in txn if _tag(c) == "transactionCoding"), None)
            date_el    = next((c for c in txn if _tag(c) == "transactionDate"), None)
            post_el    = next((c for c in txn if _tag(c) == "postTransactionAmounts"), None)

            code = _child_text(coding_el, "transactionCode") if coding_el is not None else None
            if code not in MEANINGFUL_CODES:
                continue

            date_str   = _child_text(date_el, "transactionDate") if date_el is not None else file_date
            shares_str = _child_text(amounts_el, "transactionShares") if amounts_el is not None else None
            price_str  = _child_text(amounts_el, "transactionPricePerShare") if amounts_el is not None else None
            adc        = _child_text(amounts_el, "transactionAcquiredDisposedCode") if amounts_el is not None else None
            shares_after = _child_text(post_el, "sharesOwnedFollowingTransaction") if post_el is not None else None

            try:
                shares = float(shares_str) if shares_str else None
            except ValueError:
                shares = None
            try:
                price = float(price_str) if price_str else None
            except ValueError:
                price = None
            try:
                value = round(shares * price, 2) if shares and price else None
            except Exception:
                value = None

            trades.append({
                "ticker":        (ticker or "").upper(),
                "company":       company or "",
                "insider_name":  insider_name or "",
                "role":          role,
                "trade_type":    CODE_LABEL.get(code, code),
                "shares":        shares,
                "price":         price,
                "value":         value,
                "acquired_disposed": "Acquired" if adc == "A" else "Disposed" if adc == "D" else adc,
                "traded_date":   date_str or file_date,
                "filed_date":    file_date,
                "shares_after":  float(shares_after) if shares_after else None,
            })

    return trades


# ---------------------------------------------------------------------------
# Fetch helpers
# ---------------------------------------------------------------------------

def _get_filing_xml_url(cik: str, accession: str) -> Optional[str]:
    """Find the primary Form 4 XML URL from a filing index."""
    acc_clean = accession.replace("-", "")
    index_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_clean}/{accession}-index.htm"
    try:
        r = requests.get(index_url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return None
        # Find form4.xml links — prefer the root-level one over xslF345X06/form4.xml
        candidates = []
        for line in r.text.splitlines():
            if "form4.xml" in line.lower() and "href=" in line.lower():
                start = line.lower().find('href="') + 6
                end   = line.lower().find('"', start)
                path  = line[start:end]
                full  = f"https://www.sec.gov{path}" if path.startswith("/") else path
                candidates.append(full)
        # Prefer URL without "xsl" in the path (raw XML, not the styled version)
        for url in candidates:
            if "xsl" not in url.lower():
                return url
        if candidates:
            return candidates[-1]
        # Fallback: construct the URL
        return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_clean}/form4.xml"
    except Exception:
        return None


def _fetch_and_parse(cik: str, accession: str, file_date: str) -> list[dict]:
    xml_url = _get_filing_xml_url(cik, accession)
    if not xml_url:
        return []
    try:
        r = requests.get(xml_url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return []
        return _parse_form4_xml(r.content, file_date)
    except Exception as e:
        logger.debug(f"Failed to parse {xml_url}: {e}")
        return []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_insider_trades_for_ticker(ticker: str, limit: int = 30) -> dict:
    ticker = ticker.upper().strip()

    with _lock:
        cached = _per_ticker_cache.get(ticker)
        if cached and time.time() - cached["at"] < PER_TICKER_TTL:
            trades = cached["data"]
            return {
                "ticker": ticker,
                "trades": trades[:limit],
                "total":  len(trades),
                "fetched_at": datetime.fromtimestamp(cached["at"], tz=timezone.utc).isoformat(),
            }

    cik = _ticker_to_cik(ticker)
    if not cik:
        return {"ticker": ticker, "trades": [], "total": 0, "fetched_at": "", "error": f"Unknown ticker {ticker}"}

    trades   = []
    exchange = None
    try:
        sub_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        r = requests.get(sub_url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        d = r.json()

        # Extract exchange
        exchanges = d.get("exchanges", [])
        if exchanges:
            raw = exchanges[0]
            exchange = {"NYSE": "NYSE", "Nasdaq": "NASDAQ", "NASDAQ": "NASDAQ"}.get(raw, raw)

        filings = d.get("filings", {}).get("recent", {})
        forms   = filings.get("form", [])
        dates   = filings.get("filingDate", [])
        accs    = filings.get("accessionNumber", [])

        form4s = [
            (dates[i], accs[i])
            for i, f in enumerate(forms)
            if f == "4"
        ][:15]

        for file_date, acc in form4s:
            parsed = _fetch_and_parse(cik, acc, file_date)
            trades.extend(parsed)
            if len(trades) >= limit * 2:
                break

        trades.sort(key=lambda t: t.get("traded_date", ""), reverse=True)

    except Exception as e:
        logger.warning(f"Failed to fetch insider trades for {ticker}: {e}")

    with _lock:
        _per_ticker_cache[ticker] = {"data": trades, "at": time.time()}

    return {
        "ticker":     ticker,
        "exchange":   exchange,
        "verdict":    compute_verdict(trades),
        "trades":     trades[:limit],
        "total":      len(trades),
        "fetched_at": datetime.now(tz=timezone.utc).isoformat(),
    }


SIGNIFICANT_SELL_VALUE = 500_000   # $500K total sold
SIGNIFICANT_BUY_VALUE  = 100_000   # $100K total bought (buying is rarer, lower bar)
SIGNIFICANT_SELL_COUNT = 3          # OR 3+ distinct insiders selling
SIGNIFICANT_BUY_COUNT  = 2          # OR 2+ distinct insiders buying
VERDICT_DAYS           = 30


def _fmt_value(v: float) -> str:
    if v >= 1_000_000:
        return f"${v / 1_000_000:.1f}M"
    if v >= 1_000:
        return f"${v / 1_000:.0f}K"
    return f"${v:,.0f}"


def _aggregate_insiders(trades: list[dict]) -> list[dict]:
    """Aggregate trades by insider name and compute % of holdings sold/bought."""
    from collections import defaultdict
    agg: dict[str, dict] = defaultdict(lambda: {
        "name": "", "role": "", "shares": 0.0, "value": 0.0,
        "shares_after": None, "trade_type": "",
    })
    for t in trades:
        key = t["insider_name"]
        d   = agg[key]
        d["name"]       = t["insider_name"]
        d["role"]       = t["role"]
        d["trade_type"] = t["trade_type"]
        d["shares"]    += t["shares"] or 0
        d["value"]     += t["value"]  or 0
        if t.get("shares_after") is not None:
            d["shares_after"] = t["shares_after"]

    result = []
    for d in agg.values():
        pct = None
        if d["shares_after"] is not None and d["shares"] > 0:
            total_before = d["shares"] + d["shares_after"]
            if total_before > 0:
                pct = round(d["shares"] / total_before * 100, 1)
        result.append({
            "name":       d["name"],
            "role":       d["role"],
            "trade_type": d["trade_type"],
            "shares":     d["shares"],
            "value":      round(d["value"], 2),
            "value_fmt":  _fmt_value(d["value"]),
            "pct_of_holdings": pct,
        })
    result.sort(key=lambda x: x["value"], reverse=True)
    return result


def compute_verdict(trades: list[dict]) -> dict:
    cutoff = (datetime.now() - timedelta(days=VERDICT_DAYS)).strftime("%Y-%m-%d")
    recent = [t for t in trades if (t.get("traded_date") or "") >= cutoff]

    buys  = [t for t in recent if t["trade_type"] == "Buy"]
    sells = [t for t in recent if t["trade_type"] == "Sell"]

    buy_value     = sum(t["value"] or 0 for t in buys)
    sell_value    = sum(t["value"] or 0 for t in sells)
    buy_insiders  = len(set(t["insider_name"] for t in buys))
    sell_insiders = len(set(t["insider_name"] for t in sells))

    sig_sell = sell_value >= SIGNIFICANT_SELL_VALUE or sell_insiders >= SIGNIFICANT_SELL_COUNT
    sig_buy  = buy_value  >= SIGNIFICANT_BUY_VALUE  or buy_insiders  >= SIGNIFICANT_BUY_COUNT

    if sig_buy and sig_sell:
        verdict = "mixed"
        summary = (
            f"{buy_insiders} insider{'s' if buy_insiders != 1 else ''} bought {_fmt_value(buy_value)}, "
            f"{sell_insiders} sold {_fmt_value(sell_value)} in the last {VERDICT_DAYS} days"
        )
    elif sig_buy:
        verdict = "significant_buying"
        summary = (
            f"{buy_insiders} insider{'s' if buy_insiders != 1 else ''} "
            f"bought {_fmt_value(buy_value)} in the last {VERDICT_DAYS} days"
        )
    elif sig_sell:
        verdict = "significant_selling"
        summary = (
            f"{sell_insiders} insider{'s' if sell_insiders != 1 else ''} "
            f"sold {_fmt_value(sell_value)} in the last {VERDICT_DAYS} days"
        )
    else:
        verdict = "none"
        summary = f"No significant insider activity in the last {VERDICT_DAYS} days"

    return {
        "verdict":          verdict,
        "summary":          summary,
        "buy_value":        buy_value,
        "sell_value":       sell_value,
        "buy_insiders":     buy_insiders,
        "sell_insiders":    sell_insiders,
        "days":             VERDICT_DAYS,
        "buyer_details":    _aggregate_insiders(buys),
        "seller_details":   _aggregate_insiders(sells),
    }


_significant_cache: dict = {"data": [], "at": 0.0}
SIGNIFICANT_TTL = 1 * 3600


def get_significant_activity(limit: int = 50) -> dict:
    """Scan recent Form 4s and return only tickers with significant insider activity."""
    with _lock:
        if time.time() - _significant_cache["at"] < SIGNIFICANT_TTL and _significant_cache["data"]:
            return {
                "signals":    _significant_cache["data"][:limit],
                "total":      len(_significant_cache["data"]),
                "fetched_at": datetime.fromtimestamp(_significant_cache["at"], tz=timezone.utc).isoformat(),
            }

    # Get recent trades, group by ticker, compute verdicts
    recent = get_recent_insider_trades(limit=500)
    trades_by_ticker: dict[str, list] = {}
    for t in recent.get("trades", []):
        ticker = t.get("ticker", "")
        if ticker:
            trades_by_ticker.setdefault(ticker, []).append(t)

    signals = []
    for ticker, trades in trades_by_ticker.items():
        v = compute_verdict(trades)
        if v["verdict"] != "none":
            signals.append({
                "ticker":   ticker,
                "company":  trades[0].get("company", ""),
                **v,
            })

    # Sort: buying first (more bullish/rare), then mixed, then selling; by value within each
    order = {"significant_buying": 0, "mixed": 1, "significant_selling": 2}
    signals.sort(key=lambda s: (order.get(s["verdict"], 3), -(s["buy_value"] + s["sell_value"])))

    with _lock:
        _significant_cache["data"] = signals
        _significant_cache["at"]   = time.time()

    return {
        "signals":    signals[:limit],
        "total":      len(signals),
        "fetched_at": datetime.now(tz=timezone.utc).isoformat(),
    }


_news_cache: dict[str, dict] = {}
NEWS_TTL = 2 * 3600


def get_news_for_ticker(ticker: str, limit: int = 5) -> list[dict]:
    ticker = ticker.upper().strip()
    with _lock:
        cached = _news_cache.get(ticker)
        if cached and time.time() - cached["at"] < NEWS_TTL:
            return cached["data"][:limit]

    articles = []
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).news or []
        for item in info:
            # yfinance >= 0.2.x wraps content inside a "content" key
            content = item.get("content") or item
            title   = content.get("title") or item.get("title", "")
            pub     = (content.get("provider") or {}).get("displayName") or item.get("publisher", "")
            url     = (content.get("canonicalUrl") or {}).get("url") or item.get("link", "")
            ts      = content.get("pubDate") or ""
            if not ts and item.get("providerPublishTime"):
                from datetime import timezone as tz
                ts = datetime.fromtimestamp(item["providerPublishTime"], tz=timezone.utc).isoformat()
            if title:
                articles.append({"title": title, "publisher": pub, "url": url, "published_at": ts})
            if len(articles) >= limit:
                break
    except Exception as e:
        logger.debug(f"News fetch failed for {ticker}: {e}")

    with _lock:
        _news_cache[ticker] = {"data": articles, "at": time.time()}

    return articles[:limit]


def get_recent_insider_trades(limit: int = 100) -> dict:
    """Fetch the most recent Form 4 filings across all companies."""
    with _lock:
        if time.time() - _recent_cache["at"] < RECENT_TTL and _recent_cache["data"]:
            return {
                "trades":     _recent_cache["data"][:limit],
                "total":      len(_recent_cache["data"]),
                "fetched_at": datetime.fromtimestamp(_recent_cache["at"], tz=timezone.utc).isoformat(),
            }

    trades = []
    try:
        r = requests.get(RECENT_FEED, headers=HEADERS, timeout=20)
        r.raise_for_status()
        root = ET.fromstring(r.content)
        ns   = {"atom": "http://www.w3.org/2005/Atom"}

        entries = root.findall("atom:entry", ns)
        logger.info(f"Recent Form 4 feed: {len(entries)} entries")


        for entry in entries[:100]:
            link_el = entry.find("atom:link", ns)
            date_el = entry.find("atom:updated", ns)
            if link_el is None:
                continue

            href      = link_el.get("href", "")
            file_date = (date_el.text or "")[:10] if date_el is not None else ""

            # Extract CIK and accession from the URL
            # URL format: /Archives/edgar/data/{cik}/{acc-no}/{acc-no}-index.htm
            parts = href.rstrip("/").split("/")
            if len(parts) < 2:
                continue
            try:
                cik        = parts[-3]
                acc_no_raw = parts[-2]
                # reconstruct standard accession number format
                acc_digits = acc_no_raw.replace("-", "")
                accession  = f"{acc_digits[:10]}-{acc_digits[10:12]}-{acc_digits[12:]}"
            except Exception:
                continue

            parsed = _fetch_and_parse(cik, accession, file_date)
            trades.extend(parsed)

    except Exception as e:
        logger.warning(f"Failed to fetch recent insider trades: {e}")

    trades.sort(key=lambda t: t.get("traded_date", ""), reverse=True)

    with _lock:
        _recent_cache["data"] = trades
        _recent_cache["at"]   = time.time()

    return {
        "trades":     trades[:limit],
        "total":      len(trades),
        "fetched_at": datetime.now(tz=timezone.utc).isoformat(),
    }
