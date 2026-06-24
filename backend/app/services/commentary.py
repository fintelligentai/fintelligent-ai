"""
Generates and caches AI commentary for S&D chart setups.

Cost control strategy:
- Commentary is only regenerated when the underlying zone/signal data hash changes.
- Haiku is used (cheapest Claude model, ~$0.00025 per call).
- No speculative pre-generation: commentary is generated on-demand for the viewed asset
  and then cached until the data changes (typically every 15 min at most).
"""

import hashlib
import json
import logging

import anthropic

from app.core.config import settings
from app.db.commentary import get_cached, set_cached
from app.models.zone import ZoneDetectionResult
from app.models.signal import SignalResult

log = logging.getLogger(__name__)

_CLOSING = "This analysis is provided for educational purposes only and does not constitute financial advice."

_SYSTEM_PROMPT = """You are a concise financial education assistant that explains supply and demand chart analysis.
Your output must:
- Be a single paragraph of 4-6 sentences.
- Use hedged, non-certain language throughout: "may," "could," "historically has," "suggests," "appears."
- Never use "will" or any language expressing certainty about future price movements.
- Acknowledge that zones can fail and past reactions don't guarantee future price action.
- End with exactly this sentence, verbatim: "This analysis is provided for educational purposes only and does not constitute financial advice."
- Sound natural and readable, not like a list of facts.
Do not add any headers, bullet points, or extra lines — only the paragraph."""


def _build_data_hash(zones: ZoneDetectionResult, signals: SignalResult) -> str:
    payload = {
        "price": round(zones.current_price, 6),
        "zones": [
            {
                "id": z.id,
                "type": z.zone_type,
                "proximal": round(z.proximal_level, 6),
                "distal": round(z.distal_level, 6),
                "strength": z.strength_score,
                "fresh": z.is_fresh,
                "pattern": z.formation_pattern,
            }
            for z in zones.zones
        ],
        "buy_count":  len(signals.buy_signals),
        "sell_count": len(signals.sell_signals),
    }
    raw = json.dumps(payload, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def _build_user_prompt(label: str, ticker: str, timeframe: str,
                        zones: ZoneDetectionResult, signals: SignalResult) -> str:
    price = zones.current_price
    tf_label = {"1d": "daily", "1wk": "weekly", "1mo": "monthly"}.get(timeframe, timeframe)

    # Nearest supply zone
    supply_zones = sorted(
        [z for z in zones.zones if z.zone_type == "supply"],
        key=lambda z: abs(z.proximal_level - price),
    )
    demand_zones = sorted(
        [z for z in zones.zones if z.zone_type == "demand"],
        key=lambda z: abs(z.proximal_level - price),
    )

    lines = [
        f"Asset: {label} ({ticker}), {tf_label} timeframe",
        f"Current price: {price:,.5g}",
        f"Total zones detected: {len(zones.zones)} "
        f"({len(supply_zones)} supply, {len(demand_zones)} demand)",
    ]

    if supply_zones:
        sz = supply_zones[0]
        dist_pct = abs(sz.proximal_level - price) / price * 100
        lines.append(
            f"Nearest supply zone: {sz.proximal_level:,.5g}–{sz.distal_level:,.5g}, "
            f"pattern={sz.formation_pattern}, strength={sz.strength_score}/100, "
            f"{'fresh (never retested)' if sz.is_fresh else 'tested'}, "
            f"{dist_pct:.1f}% away"
        )
    else:
        lines.append("No supply zones currently detected.")

    if demand_zones:
        dz = demand_zones[0]
        dist_pct = abs(dz.proximal_level - price) / price * 100
        lines.append(
            f"Nearest demand zone: {dz.proximal_level:,.5g}–{dz.distal_level:,.5g}, "
            f"pattern={dz.formation_pattern}, strength={dz.strength_score}/100, "
            f"{'fresh (never retested)' if dz.is_fresh else 'tested'}, "
            f"{dist_pct:.1f}% away"
        )
    else:
        lines.append("No demand zones currently detected.")

    buy_count  = len(signals.buy_signals)
    sell_count = len(signals.sell_signals)
    if buy_count > sell_count:
        bias = f"bullish bias ({buy_count} buy signal{'s' if buy_count != 1 else ''}, {sell_count} sell)"
    elif sell_count > buy_count:
        bias = f"bearish bias ({sell_count} sell signal{'s' if sell_count != 1 else ''}, {buy_count} buy)"
    else:
        bias = f"neutral/mixed ({buy_count} buy, {sell_count} sell signals)"

    lines.append(f"Signal bias: {bias}")

    if signals.buy_signals:
        top = max(signals.buy_signals, key=lambda s: s.signal_strength)
        lines.append(f"Strongest BUY signal: entry={top.entry:,.5g}, SL={top.stop_loss:,.5g}, TP={top.take_profit:,.5g}, strength={top.signal_strength}%")
    if signals.sell_signals:
        top = max(signals.sell_signals, key=lambda s: s.signal_strength)
        lines.append(f"Strongest SELL signal: entry={top.entry:,.5g}, SL={top.stop_loss:,.5g}, TP={top.take_profit:,.5g}, strength={top.signal_strength}%")

    lines.append(
        "\nWrite a 4-6 sentence educational commentary paragraph about this chart setup using the data above. "
        "Use hedged language (may, could, historically has). End with the required closing sentence exactly as instructed."
    )
    return "\n".join(lines)


def get_or_generate_commentary(
    ticker: str,
    timeframe: str,
    label: str,
    zones: ZoneDetectionResult,
    signals: SignalResult,
) -> dict:
    """
    Returns cached commentary if the underlying data hasn't changed.
    Otherwise calls Claude Haiku to generate a fresh paragraph and caches it.
    """
    data_hash = _build_data_hash(zones, signals)
    cached = get_cached(ticker, timeframe)

    if cached and cached["data_hash"] == data_hash:
        return {
            "commentary": cached["commentary"],
            "generated_at": cached["generated_at"],
            "cached": True,
        }

    if not settings.anthropic_api_key:
        fallback = (
            f"AI commentary is not configured. Add your ANTHROPIC_API_KEY to the backend .env file to enable this feature. "
            f"{_CLOSING}"
        )
        return {"commentary": fallback, "generated_at": None, "cached": False}

    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        user_prompt = _build_user_prompt(label, ticker, timeframe, zones, signals)

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        commentary = message.content[0].text.strip()

        # Guarantee the closing line is present
        if _CLOSING not in commentary:
            commentary = commentary.rstrip(".") + " " + _CLOSING

        set_cached(ticker, timeframe, commentary, data_hash)
        cached_row = get_cached(ticker, timeframe)
        return {
            "commentary": commentary,
            "generated_at": cached_row["generated_at"] if cached_row else None,
            "cached": False,
        }

    except Exception as e:
        log.error("Commentary generation failed for %s: %s", ticker, e)
        raise
