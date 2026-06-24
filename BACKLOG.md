# Fintelligent AI — Project Backlog

Work through these in priority order across sessions. Don't build multiple items at once.
Update status as items are completed or new items are added.

---

## TIER 1 — Immediate (blocking launch)

### 1. GatePrompt redesign
The paywall/conversion screen shown when free users hit a premium feature.
Most important screen in the app — first impression of the upgrade ask.
Must match the premium dark-gradient aesthetic (same card pattern as AuthModal/AcknowledgmentModal).
**Status:** Not started

### 2. Deployment
Move off localhost to real hosting so the app can be tested in real-world conditions.
- **Frontend:** Vercel
- **Backend:** Railway or Render (FastAPI + uvicorn)
- Environment variables: Supabase URL/key, ANTHROPIC_API_KEY (when ready)
- Must confirm Supabase auth redirect URLs work on the deployed domain
- Deployment does NOT need to wait for Stripe or webhooks
**Status:** Not started

---

## TIER 2 — Post-launch

### 3. Broker webhook / postback integration
Auto-grant premium on deposit, auto-revoke on withdrawal.
Primary monetization model is broker CPA — this is the core revenue flow.
Must confirm what Exness/AvaTrade actually support (real-time webhook vs. dashboard-only).

**Design must support two modes:**
- **(a) Automatic** — broker webhook/postback fires on deposit/withdrawal event
- **(b) Manual/admin-triggered** — admin marks deposit/withdrawal in admin panel (already built)

**Status:** Manual fallback (mode b) already built. Mode (a) pending broker confirmation.

### 4. Stripe subscription billing
For users who want to pay directly rather than via broker deposit.
**Note:** Primary monetization is broker CPA, not subscriptions — assess whether Stripe is
actually needed near-term before building. May be lower priority than it appears.
**Status:** Not started

### 5. AI commentary
Built but disabled — waiting on Anthropic API key with billing.
To re-enable: uncomment 2 lines in App.tsx, confirm SQLite cache is persisting.
**Status:** Built, disabled — waiting on API key

---

## TIER 3 — Polish & expansion

### 6. Mobile layout pass
Rethink chart / zone panel / scanner layout for small screens.
Likely bottom sheet pattern for zones/watchlist on mobile.
**Status:** Not started

---

## Completed

### Core analysis
- S&D zone detection (RBD/DBR/RBR/DBD, ATR-based scoring)
- Candlestick chart with canvas zone overlay
- Zone strength filters (min strength, supply/demand/all, fresh-only)
- Timeframe selector (D/W/M) with premium gating on W/M
- TTL caching (15 min, in-memory) + auto-refresh
- Signals panel (all signals, scrollable, R:R adjustable)
- Multi-timeframe confluence overlay (HTF zones in violet, toggle)
- Zone formation markers on chart (triangle + stem at formation candle)
- Backtesting / historical win-rate (per pattern, per asset, n sample size shown)
- Extended historical data to maximum yfinance availability (30+ years)
- Golden cross / death cross badge (MA50/MA200, header, hover tooltip)
- EURUSD/forex candlestick fix (np.isclose + chart-window ratio detection)

### Asset universe & scanner
- Expanded asset universe (170+ assets, 6 categories)
- Asset scanner (background job, 170+ assets, 15-min cycle, 2-min startup delay)
- Scanner view with filters: distance-to-entry, strength, score
- **Scanner score range filter (min/max slider)** — built, confirmed
- Watchlist (pin assets, localStorage, signal summary per asset)
- Price alerts (Web Notifications API, zone entry + approach triggers)

### Auth & monetization infrastructure
- Supabase Auth (login/signup, Google OAuth, email/password)
- Free vs Premium tier gating (D free, W/M/scanner/watchlist/insiders/IPOs premium)
- Admin panel (user management, tier upgrade/downgrade, broker partner CRUD)
- Broker partners with geo-filtering (hard block by country, admin bypass)
- Broker deposit verification flow (user submits broker name + account ID, admin upgrades manually)
- CountrySelect component (searchable multi-select with portal dropdown)
- Account Settings modal (broker name + ID fields, plan display)

### Data modules
- IPO calendar (Upcoming / Recent / Filed tabs, tier badges, deal size)
- Politician / congressional trades module
- Insider trades (market-wide feed + per-asset sidebar panel)

### UI polish
- Full premium dark-gradient aesthetic across all modals and panels
- AuthModal, AcknowledgmentModal, AdminPanel, AccountSettingsModal, UnlockScreen redesigned
- UserMenu dropdown premium redesign
- AssetPicker category tabs fix, dropdown width fix
- Logo swapped to brain image from Supabase
- Support email (fintelligent.ai@gmail.com) in Settings and paywall screen
- CSS reset workaround documented: always use inline styles, never Tailwind padding/margin
- IPO Calendar header/tabs/filters polished
