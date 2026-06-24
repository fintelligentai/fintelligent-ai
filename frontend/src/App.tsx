import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { Logo } from './components/Logo'
import { AuthModal } from './components/AuthModal'
import { GatePrompt } from './components/GatePrompt'
import { UnlockScreen } from './components/UnlockScreen'
import { AccountSettingsModal } from './components/AccountSettingsModal'
import { AdminPanel } from './components/AdminPanel'
import { UserMenu } from './components/UserMenu'
import { useQuery } from '@tanstack/react-query'
import { AssetPicker } from './components/AssetPicker'
import { ZoneSidebar } from './components/ZoneSidebar'
import { PriceChart } from './components/PriceChart'
import { SignalsPanel } from './components/SignalsPanel'
import { TimeframeSelector } from './components/TimeframeSelector'
import { fetchZones, fetchOHLCV, fetchSignals, fetchBacktest } from './api/client'
import { useZoneAlerts } from './hooks/useZoneAlerts'
import { useWatchlist } from './hooks/useWatchlist'
import { ScannerView } from './components/ScannerView'
import { WatchlistPanel } from './components/WatchlistPanel'
import { AcknowledgmentModal, isAcknowledged } from './components/AcknowledgmentModal'
import { InsiderTradesView } from './components/InsiderTradesView'
import { InsiderTradesPanel } from './components/InsiderTradesPanel'
import { IPOCalendarView } from './components/IPOCalendarView'
// import { CommentaryPanel } from './components/CommentaryPanel'
import type { OHLCVBar } from './types/zone'
import type { ZoneFilterState } from './components/ZoneFilters'
import type { Asset } from './types/asset'

const DEFAULT_ASSET: Asset = { ticker: 'BTC-USD', label: 'Bitcoin', category: 'crypto' }

export default function App() {
  const [asset, setAsset]             = useState<Asset>(DEFAULT_ASSET)
  const [timeframe, setTimeframe]     = useState('1d')
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [rr, setRR]                   = useState(2)
  const [filters, setFilters]         = useState<ZoneFilterState>({
    minStrength: 0,
    zoneType: 'all',
    freshOnly: false,
  })

  const { user, signOut, isPremium, isAdmin } = useAuth()
  const [authOpen, setAuthOpen]             = useState(false)
  const [gateReason, setGateReason]         = useState<string | null>(null)
  const [unlockOpen, setUnlockOpen]         = useState(false)
  const [settingsOpen, setSettingsOpen]     = useState(false)
  const [adminOpen, setAdminOpen]           = useState(false)
  const [acknowledged, setAcknowledged]     = useState(isAcknowledged)
  const [alertsEnabled, setAlertsEnabled]   = useState(false)
  const [scannerOpen, setScannerOpen]       = useState(false)
  const [congressOpen, setCongressOpen]     = useState(false)
  const [ipoOpen, setIpoOpen]               = useState(false)
  const [sidebarTab, setSidebarTab]         = useState<'zones' | 'watchlist' | 'congress'>('zones')
  const [showHtf, setShowHtf]               = useState(true)
  const { watchlist, toggle, remove, isPinned } = useWatchlist()
  const ticker = asset.ticker

  const HTF_MAP: Record<string, string> = { '1d': '1wk', '1wk': '1mo' }
  const htfTimeframe = HTF_MAP[timeframe]

  const REFETCH_MS = 15 * 60_000

  const zonesQuery = useQuery({
    queryKey: ['zones', ticker, timeframe],
    queryFn: () => fetchZones(ticker, timeframe),
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry: 4,
    retryDelay: attempt => Math.min(2000 * attempt, 10000),
  })

  const ohlcvQuery = useQuery({
    queryKey: ['ohlcv', ticker, timeframe],
    queryFn: () => fetchOHLCV(ticker, timeframe),
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry: 4,
    retryDelay: attempt => Math.min(2000 * attempt, 10000),
  })

  const backtestQuery = useQuery({
    queryKey: ['backtest', ticker, timeframe],
    queryFn:  () => fetchBacktest(ticker, timeframe),
    staleTime: 60 * 60_000,
    retry: 1,
  })

  const htfZonesQuery = useQuery({
    queryKey: ['zones', ticker, htfTimeframe],
    queryFn: () => fetchZones(ticker, htfTimeframe!),
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry: 1,
    enabled: !!htfTimeframe && showHtf,
  })

  const signalsQuery = useQuery({
    queryKey: ['signals', ticker, timeframe, rr],
    queryFn: () => fetchSignals(ticker, timeframe, rr),
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
    retry: 1,
  })

  function handleAssetChange(a: Asset) {
    setAsset(a)
    setSelectedZoneId(null)
  }

  function handleTimeframeChange(tf: string) {
    setTimeframe(tf)
    setSelectedZoneId(null)
  }

  const { permission, requestPermission } = useZoneAlerts(zonesQuery.data, alertsEnabled)

  async function handleAlertsToggle() {
    if (!alertsEnabled && permission !== 'granted') {
      await requestPermission()
    }
    setAlertsEnabled((v) => !v)
  }

  const currentPrice = zonesQuery.data?.current_price

  function gate(reason: string, action?: () => void) {
    if (isPremium) { action?.(); return }
    setGateReason(reason)
  }

  const [bottomSheet, setBottomSheet] = useState(false)

  const navItems = [
    { key: 'scanner',  label: 'Scanner',  icon: '⚡', active: scannerOpen,  onClick: () => gate('Scan 500+ assets across all markets for active supply & demand signals.', () => { setScannerOpen(v => !v); setCongressOpen(false); setIpoOpen(false) }) },
    { key: 'insiders', label: 'Insiders', icon: '🕵️', active: congressOpen, onClick: () => gate('View significant insider buying and selling activity from SEC filings.', () => { setCongressOpen(v => !v); setScannerOpen(false); setIpoOpen(false) }) },
    { key: 'ipos',     label: 'IPOs',     icon: '🚀', active: ipoOpen,      onClick: () => gate('Track upcoming IPOs and their expected market significance.', () => { setIpoOpen(v => !v); setScannerOpen(false); setCongressOpen(false) }) },
  ]

  return (
    <>
    <div className="flex flex-col h-screen w-full text-gray-200 overflow-hidden" style={{ background: 'linear-gradient(170deg, #0d0e1b 0%, #080910 100%)' }}>
      {!acknowledged && (
        <AcknowledgmentModal onAcknowledge={() => setAcknowledged(true)} />
      )}

      {/* ── Header ── */}
      <header className="shrink-0 bg-[#0a0b13] border-b border-white/6">

        {/* Row 1: Brand + Asset + Price + Account */}
        <div className="flex items-center gap-2 px-3 sm:px-5 py-2">
          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <Logo size={30} />
            <span className="text-[13px] font-bold tracking-tight text-white hidden xs:block">Fintelligent</span>
            <span className="hidden sm:block text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: 'rgba(0,210,168,0.42)' }}>S&D</span>
          </div>

          <div className="hidden sm:block w-px h-5 mx-2 shrink-0 bg-white/8" />

          {/* Asset picker */}
          <div className={!isPremium ? 'pointer-events-none opacity-50 relative' : 'relative'}>
            <AssetPicker selected={asset} onChange={handleAssetChange} />
            {!isPremium && (
              <div className="absolute inset-0 cursor-pointer z-10"
                onClick={() => gate('Switch to any asset — stocks, crypto, forex and more.')} />
            )}
          </div>

          {/* Watchlist pin */}
          <button
            onClick={() => isPremium ? toggle(asset) : gate('Save assets to your watchlist and track them across sessions.')}
            className={['text-base transition-colors cursor-pointer shrink-0',
              isPremium && isPinned(ticker) ? 'text-amber-400' : 'text-gray-700 hover:text-gray-500'].join(' ')}
            style={{ minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isPremium && isPinned(ticker) ? '★' : '☆'}
          </button>

          {/* Price */}
          {currentPrice != null && (
            <div className="flex items-center gap-1.5 leading-none shrink-0 min-w-0">
              <span className="text-[12px] font-mono font-medium text-gray-200 tracking-tight truncate">
                {currentPrice.toLocaleString(undefined, { maximumFractionDigits: 5 })}
              </span>
              {zonesQuery.isFetching && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />}
            </div>
          )}

          <div className="flex-1" />

          {/* Alerts — hidden on mobile */}
          <button
            onClick={() => isPremium ? handleAlertsToggle() : gate('Get notified instantly when price enters a supply or demand zone.')}
            className={['hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer',
              isPremium && alertsEnabled
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-gray-600 hover:text-gray-400 border border-white/6',
              !isPremium || permission === 'denied' ? 'opacity-40' : '',
            ].join(' ')}
          >
            <span>{isPremium && alertsEnabled ? '🔔' : '🔕'}</span>
            <span>{isPremium && alertsEnabled ? 'Alerts on' : 'Alerts'}</span>
            {!isPremium && <span className="text-[9px] opacity-70">🔒</span>}
          </button>

          <div className="hidden sm:block w-px h-5 bg-white/8 mx-1 shrink-0" />

          {/* Account */}
          {user ? (
            <UserMenu
              email={user.email ?? ''}
              isAdmin={isAdmin}
              onAdmin={() => setAdminOpen(true)}
              onSettings={() => setSettingsOpen(true)}
              onSignOut={signOut}
            />
          ) : (
            <button onClick={() => setAuthOpen(true)}
              className="flex items-center gap-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border border-violet-500/40 text-violet-400 hover:bg-violet-600/15"
              style={{ padding: '7px 12px', minHeight: 32 }}>
              Sign in
            </button>
          )}
        </div>

        {/* Row 2: Timeframe + Nav modules — entire row scrolls horizontally */}
        <div className="flex items-center gap-2 border-t border-white/4 overflow-x-auto scrollbar-none" style={{ padding: '6px 12px 8px', WebkitOverflowScrolling: 'touch' }}>
          <TimeframeSelector
            selected={timeframe}
            onChange={(tf) => gate('Switch to Weekly and Monthly timeframes for broader market perspective.', () => handleTimeframeChange(tf))}
            lockedTimeframes={isPremium ? [] : ['1wk', '1mo']}
          />

          <div className="w-px h-4 bg-white/8 shrink-0" />

          {navItems.map(({ key, label, icon, active, onClick }) => (
            <button key={key} onClick={onClick}
              className={[
                'flex items-center gap-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all cursor-pointer border shrink-0',
                active
                  ? 'bg-violet-600 text-white border-violet-500/60'
                  : isPremium
                    ? 'text-gray-400 border-white/8 bg-white/4 hover:bg-white/8 hover:text-gray-200'
                    : 'text-gray-700 border-white/5 bg-white/2 opacity-60',
              ].join(' ')}
              style={{ padding: '5px 10px', minHeight: 30 }}
            >
              <span>{icon}</span>
              <span>{label}</span>
              {!isPremium && <span className="text-[9px] opacity-60">🔒</span>}
            </button>
          ))}
        </div>
      </header>

      {/* Scanner full-screen view */}
      {scannerOpen && (
        <div className="flex-1 overflow-hidden min-h-0">
          <ScannerView onSelectAsset={(a) => { handleAssetChange(a); setScannerOpen(false) }} onClose={() => setScannerOpen(false)} />
        </div>
      )}

      {/* Insider trades full-screen view */}
      {congressOpen && (
        <div className="flex-1 overflow-hidden min-h-0">
          <InsiderTradesView />
        </div>
      )}

      {/* IPO calendar full-screen view */}
      {ipoOpen && (
        <div className="flex-1 overflow-hidden min-h-0">
          <IPOCalendarView />
        </div>
      )}

      {/* Main content — stacks on mobile, side-by-side on md+ */}
      <div className={`flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 relative ${scannerOpen || congressOpen || ipoOpen ? 'hidden' : ''}`}>
        {/* Chart + signals column */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-y-auto md:overflow-hidden md:pb-0" style={{ paddingBottom: 'calc(48px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Chart — fixed height on mobile, flex-1 on desktop */}
          <main className="relative shrink-0 min-h-[240px] md:min-h-0 md:flex-1">
            {ohlcvQuery.isLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
                Loading chart…
              </div>
            )}
            {ohlcvQuery.isError && (
              <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
                Failed to load chart data. Is the backend running?
              </div>
            )}
            {ohlcvQuery.data && (
              <PriceChart
                bars={ohlcvQuery.data as OHLCVBar[]}
                zones={zonesQuery.data}
                htfZones={showHtf ? htfZonesQuery.data : undefined}
                selectedZoneId={selectedZoneId}
              />
            )}
          </main>

          {/* AI Commentary — disabled until ANTHROPIC_API_KEY is configured */}
          {/* <CommentaryPanel ticker={ticker} timeframe={timeframe} /> */}

          {/* Signals panel */}
          <SignalsPanel
            data={signalsQuery.data}
            isLoading={signalsQuery.isLoading}
            rr={rr}
            onRRChange={setRR}
            selectedZoneId={selectedZoneId}
            patternStats={backtestQuery.data?.patterns}
            patternStatsLoading={backtestQuery.isLoading}
            maCross={signalsQuery.data?.ma_cross}
            timeframe={timeframe}
            ticker={ticker}
          />

        </div>

        {/* Zone / Watchlist sidebar — desktop only (flex column in main layout) */}
        <aside className="hidden md:flex shrink-0 w-72 border-l border-white/6 flex-col bg-[#09090e]">
          {/* Tab toggle */}
          <div className="flex shrink-0 border-b border-white/6">
            {(['zones', 'watchlist', 'congress'] as const).map((tab) => {
              const locked = !isPremium && (tab === 'watchlist' || tab === 'congress')
              return (
                <button
                  key={tab}
                  onClick={() => locked
                    ? gate(tab === 'watchlist'
                        ? 'Save and manage your favourite assets in your personal watchlist.'
                        : 'View insider trading activity for the current asset.')
                    : setSidebarTab(tab)
                  }
                  className={[
                    'flex-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer',
                    sidebarTab === tab
                      ? 'text-gray-200 border-b-2 border-violet-500 -mb-px'
                      : locked ? 'text-gray-700 hover:text-gray-600' : 'text-gray-600 hover:text-gray-400',
                  ].join(' ')}
                  style={{ padding: '12px 4px', minHeight: 44 }}
                >
                  {tab === 'watchlist'
                    ? `★ Watchlist${isPremium && watchlist.length ? ` (${watchlist.length})` : ''}${locked ? ' 🔒' : ''}`
                    : tab === 'congress'
                      ? `🕵️ Insiders${locked ? ' 🔒' : ''}`
                      : 'Zones'}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '0 14px 16px 14px' }}>
            {sidebarTab === 'zones' ? (
              <>
                <div style={{ height: 12 }} />
                {htfTimeframe && (
                  <button
                    onClick={() => setShowHtf(v => !v)}
                    className={[
                      'w-full flex items-center justify-between rounded text-xs border transition-colors cursor-pointer',
                      showHtf
                        ? 'bg-violet-500/12 border-violet-500/30 text-violet-300'
                        : 'bg-white/3 border-white/8 text-gray-600 hover:text-gray-400',
                    ].join(' ')}
                    style={{ padding: '8px 10px', marginBottom: 12 }}
                  >
                    <span>
                      <span className="font-semibold">HTF Zones</span>
                      <span className="ml-1.5 text-gray-600">
                        ({htfTimeframe === '1wk' ? 'Weekly' : 'Monthly'})
                      </span>
                    </span>
                    <span>{showHtf ? 'ON' : 'OFF'}</span>
                  </button>
                )}
                <ZoneSidebar
                  data={zonesQuery.data}
                  isLoading={zonesQuery.isLoading}
                  selectedZoneId={selectedZoneId}
                  onSelectZone={setSelectedZoneId}
                  filters={filters}
                  onFiltersChange={setFilters}
                  patternStats={backtestQuery.data?.patterns}
                  patternStatsLoading={backtestQuery.isLoading}
                />
                {zonesQuery.isError && (
                  <div className="text-red-400 text-xs mt-2">
                    Zone detection failed. Is the backend running?
                  </div>
                )}
              </>
            ) : sidebarTab === 'congress' ? (
              <div className="pt-2">
                <InsiderTradesPanel ticker={ticker} />
              </div>
            ) : (
              <div className="pt-3">
                <WatchlistPanel
                  watchlist={watchlist}
                  currentTicker={ticker}
                  onSelect={(a) => { handleAssetChange(a); setSidebarTab('zones') }}
                  onRemove={remove}
                />
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>

    {/* ── Mobile bottom bar + sheet (outside overflow-hidden wrapper) ── */}
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#09090e] border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <button
        onClick={() => setBottomSheet(v => !v)}
        className="w-full flex items-center justify-between cursor-pointer"
        style={{ padding: '11px 20px', minHeight: 48 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Zones</span>
          {zonesQuery.data && (
            <span className="text-[10px] text-gray-600">{zonesQuery.data.zones?.length ?? 0} zones</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(['zones', 'watchlist', 'congress'] as const).map(tab => (
            <div
              key={tab}
              onClick={e => { e.stopPropagation(); setSidebarTab(tab); setBottomSheet(true) }}
              className="text-[10px] font-semibold cursor-pointer transition-colors"
              style={{ color: sidebarTab === tab && bottomSheet ? '#c4b5fd' : '#4b5563', padding: '4px 0' }}
            >
              {tab === 'zones' ? 'Zones' : tab === 'watchlist' ? '★ Watch' : '🕵️'}
            </div>
          ))}
          <span className="text-gray-600" style={{ fontSize: 14 }}>{bottomSheet ? '▼' : '▲'}</span>
        </div>
      </button>
    </div>

    {/* Mobile bottom sheet */}
    {bottomSheet && (
      <>
        <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setBottomSheet(false)} />
        <aside className="md:hidden fixed left-0 right-0 z-40 flex flex-col bg-[#09090e] border-t border-white/10 rounded-t-2xl"
          style={{ bottom: 'calc(48px + env(safe-area-inset-bottom, 0px))', maxHeight: '65vh' }}>
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <div className="flex shrink-0 border-b border-white/6">
            {(['zones', 'watchlist', 'congress'] as const).map((tab) => {
              const locked = !isPremium && (tab === 'watchlist' || tab === 'congress')
              return (
                <button
                  key={tab}
                  onClick={() => locked
                    ? gate(tab === 'watchlist'
                        ? 'Save and manage your favourite assets in your personal watchlist.'
                        : 'View insider trading activity for the current asset.')
                    : setSidebarTab(tab)
                  }
                  className={[
                    'flex-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer',
                    sidebarTab === tab
                      ? 'text-gray-200 border-b-2 border-violet-500 -mb-px'
                      : locked ? 'text-gray-700' : 'text-gray-600 hover:text-gray-400',
                  ].join(' ')}
                  style={{ padding: '12px 4px', minHeight: 44 }}
                >
                  {tab === 'watchlist'
                    ? `★ Watchlist${isPremium && watchlist.length ? ` (${watchlist.length})` : ''}${locked ? ' 🔒' : ''}`
                    : tab === 'congress' ? `🕵️ Insiders${locked ? ' 🔒' : ''}` : 'Zones'}
                </button>
              )
            })}
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '0 14px 16px' }}>
            {sidebarTab === 'zones' ? (
              <>
                <div style={{ height: 12 }} />
                {htfTimeframe && (
                  <button
                    onClick={() => setShowHtf(v => !v)}
                    className={['w-full flex items-center justify-between rounded text-xs border transition-colors cursor-pointer',
                      showHtf ? 'bg-violet-500/12 border-violet-500/30 text-violet-300' : 'bg-white/3 border-white/8 text-gray-600 hover:text-gray-400'].join(' ')}
                    style={{ padding: '8px 10px', marginBottom: 12 }}
                  >
                    <span><span className="font-semibold">HTF Zones</span><span className="ml-1.5 text-gray-600">({htfTimeframe === '1wk' ? 'Weekly' : 'Monthly'})</span></span>
                    <span>{showHtf ? 'ON' : 'OFF'}</span>
                  </button>
                )}
                <ZoneSidebar
                  data={zonesQuery.data}
                  isLoading={zonesQuery.isLoading}
                  selectedZoneId={selectedZoneId}
                  onSelectZone={setSelectedZoneId}
                  filters={filters}
                  onFiltersChange={setFilters}
                  patternStats={backtestQuery.data?.patterns}
                  patternStatsLoading={backtestQuery.isLoading}
                />
              </>
            ) : sidebarTab === 'congress' ? (
              <div className="pt-2"><InsiderTradesPanel ticker={ticker} /></div>
            ) : (
              <div className="pt-3">
                <WatchlistPanel
                  watchlist={watchlist}
                  currentTicker={ticker}
                  onSelect={(a) => { handleAssetChange(a); setSidebarTab('zones'); setBottomSheet(false) }}
                  onRemove={remove}
                />
              </div>
            )}
          </div>
        </aside>
      </>
    )}

    {authOpen     && <AuthModal onClose={() => setAuthOpen(false)} />}
    {settingsOpen && <AccountSettingsModal onClose={() => setSettingsOpen(false)} />}
    {adminOpen    && <AdminPanel onClose={() => setAdminOpen(false)} />}
    {unlockOpen   && (
      <UnlockScreen
        onClose={() => setUnlockOpen(false)}
        isAdmin={isAdmin}
        onEnterBrokerId={() => { setUnlockOpen(false); setSettingsOpen(true) }}
      />
    )}
    {gateReason && (
      <GatePrompt
        reason={gateReason}
        isLoggedIn={!!user}
        isAdmin={isAdmin}
        onSignIn={() => { setGateReason(null); setAuthOpen(true) }}
        onSettings={() => { setGateReason(null); setSettingsOpen(true) }}
        onClose={() => setGateReason(null)}
      />
    )}
    </>
  )
}
