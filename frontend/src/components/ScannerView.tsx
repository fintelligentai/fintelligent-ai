import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchScannerResults, type ScanHit } from '../api/client'
import type { Asset, AssetCategory } from '../types/asset'
import { DisclaimerBanner } from './DisclaimerBanner'

interface Props {
  onSelectAsset: (asset: Asset) => void
  onClose: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  all:         'All',
  crypto:      'Crypto',
  stocks:      'Stocks',
  commodities: 'Commodities',
  forex:       'Forex',
  indices:     'Indices',
}

const STRENGTH_BAR: Record<string, string> = {
  'Very Strong': 'bg-emerald-400',
  'Strong':      'bg-emerald-500',
  'Moderate':    'bg-amber-400',
  'Weak':        'bg-gray-600',
}

const STRENGTH_COLOR: Record<string, string> = {
  'Very Strong': 'text-emerald-400',
  'Strong':      'text-emerald-400',
  'Moderate':    'text-amber-400',
  'Weak':        'text-gray-600',
}

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1)    return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function DistanceBadge({ pct }: { pct: number }) {
  const cls = pct <= 1
    ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/18'
    : pct <= 3
    ? 'bg-amber-500/12 text-amber-400 border border-amber-500/18'
    : 'bg-white/4 text-gray-600 border border-white/8'
  return (
    <span className={`text-[10px] font-mono rounded-md ${cls}`} style={{ padding: '3px 6px' }}>
      {pct.toFixed(2)}%
    </span>
  )
}

function ScorePill({ score }: { score: number }) {
  // Green = excellent, teal = strong, amber = moderate, plain = lower
  if (score >= 90) return (
    <span className="text-[12px] font-bold font-mono rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/22" style={{ padding: '3px 7px' }}>
      {score}
    </span>
  )
  if (score >= 80) return (
    <span className="text-[12px] font-bold font-mono rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" style={{ padding: '3px 7px' }}>
      {score}
    </span>
  )
  if (score >= 70) return (
    <span className="text-[12px] font-bold font-mono rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/15" style={{ padding: '3px 7px' }}>
      {score}
    </span>
  )
  return <span className="text-[12px] font-mono text-gray-600">{score}</span>
}

/* Mobile card — shown below sm breakpoint */
function HitCard({ hit, onSelect }: { hit: ScanHit; onSelect: () => void }) {
  const isBuy = hit.signal_type === 'BUY'
  return (
    <button
      onClick={onSelect}
      className="w-full text-left cursor-pointer transition-colors"
      style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', minHeight: 64 }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={['text-[10px] font-bold rounded border shrink-0',
              isBuy ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20'
                     : 'bg-red-500/12 text-red-400 border-red-500/20'].join(' ')}
            style={{ padding: '2px 7px' }}
          >{hit.signal_type}</span>
          <span className="text-[13px] font-semibold text-white truncate">{hit.label}</span>
          <span className="text-[10px] text-gray-600 font-mono shrink-0">{hit.formation_pattern}</span>
        </div>
        <ScorePill score={hit.score} />
      </div>
      <div className="flex items-center gap-4">
        <div>
          <span className="text-[9px] text-gray-700 uppercase tracking-widest">Entry </span>
          <span className="text-[12px] font-mono text-gray-300">{fmt(hit.entry)}</span>
        </div>
        <div>
          <span className="text-[9px] text-gray-700 uppercase tracking-widest">SL </span>
          <span className="text-[11px] font-mono text-red-400/70">{fmt(hit.stop_loss)}</span>
        </div>
        <div>
          <span className="text-[9px] text-gray-700 uppercase tracking-widest">TP </span>
          <span className="text-[11px] font-mono text-emerald-400/70">{fmt(hit.take_profit)}</span>
        </div>
        <DistanceBadge pct={hit.distance_pct} />
      </div>
    </button>
  )
}

/* Desktop table row — shown sm and above */
function HitRow({ hit, index, onSelect }: { hit: ScanHit; index: number; onSelect: () => void }) {
  const isBuy = hit.signal_type === 'BUY'
  const isEven = index % 2 === 0

  return (
    <button
      onClick={onSelect}
      className="w-full text-left flex items-center gap-3 px-5 py-2.5 transition-colors cursor-pointer group"
      style={{
        background: isEven ? 'transparent' : 'rgba(255,255,255,0.013)',
        borderBottom: '1px solid rgba(200,65,20,0.07)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,65,20,0.055)')}
      onMouseLeave={e => (e.currentTarget.style.background = isEven ? 'transparent' : 'rgba(255,255,255,0.013)')}
    >
      <div className="w-36 shrink-0">
        <div className="text-[13px] font-semibold text-white truncate leading-tight">{hit.label}</div>
        <div className="text-[10px] text-gray-600 font-mono mt-0.5">{hit.asset}</div>
      </div>
      <span
        className={['text-[10px] font-bold rounded-md shrink-0 border tracking-wide',
          isBuy ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/12 text-red-400 border-red-500/20'].join(' ')}
        style={{ padding: '3px 8px' }}
      >{hit.signal_type}</span>
      <span className="text-[10px] text-gray-600 font-mono w-8 shrink-0">{hit.formation_pattern}</span>
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="min-w-0">
          <div className="text-[9px] text-gray-700 uppercase tracking-widest mb-0.5">Entry</div>
          <div className="text-[12px] font-mono text-gray-300 truncate">{fmt(hit.entry)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[9px] text-gray-700 uppercase tracking-widest mb-0.5">SL</div>
          <div className="text-[12px] font-mono text-red-400/70 truncate">{fmt(hit.stop_loss)}</div>
        </div>
        <div className="min-w-0 hidden md:block">
          <div className="text-[9px] text-gray-700 uppercase tracking-widest mb-0.5">TP</div>
          <div className="text-[12px] font-mono text-emerald-400/70 truncate">{fmt(hit.take_profit)}</div>
        </div>
      </div>
      <div className="shrink-0">
        <div className="text-[9px] text-gray-700 uppercase tracking-widest mb-1">Dist.</div>
        <DistanceBadge pct={hit.distance_pct} />
      </div>
      <div className="shrink-0 w-24 hidden md:block">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-medium ${STRENGTH_COLOR[hit.strength_label]}`}>{hit.strength_label}</span>
          <span className="text-[10px] text-gray-700 font-mono">{hit.signal_strength}%</span>
        </div>
        <div className="h-px rounded-full" style={{ background: 'rgba(255,100,40,0.10)' }}>
          <div className={`h-px rounded-full ${STRENGTH_BAR[hit.strength_label]}`} style={{ width: `${hit.signal_strength}%` }} />
        </div>
      </div>
      <div className="shrink-0 w-14 text-right hidden lg:block">
        <ScorePill score={hit.score} />
      </div>
      <span className="text-gray-700 group-hover:text-gray-400 transition-colors shrink-0 text-xs">›</span>
    </button>
  )
}

export function ScannerView({ onSelectAsset, onClose }: Props) {
  const [category, setCategory]     = useState<string>('all')
  const [signalType, setSignalType] = useState<string>('all')
  const [minScore, setMinScore]     = useState<number>(0)

  const { data, isLoading } = useQuery({
    queryKey: ['scanner', category, signalType],
    queryFn: () => fetchScannerResults(
      category   !== 'all' ? category   : undefined,
      signalType !== 'all' ? signalType : undefined,
    ),
    refetchInterval: 60_000,
    staleTime: 60_000,
  })

  const status     = data?.status
  const allResults = data?.results ?? []
  const results    = minScore > 0 ? allResults.filter(h => h.score >= minScore) : allResults
  const isScanning = status?.scanning ?? false
  const lastScan   = status?.last_scan_at
  const progress   = status ? Math.round((status.assets_scanned / Math.max(status.total_assets, 1)) * 100) : 0

  const lastScanLabel = lastScan
    ? `${Math.round((Date.now() - new Date(lastScan).getTime()) / 60_000)} min ago`
    : null

  function handleSelect(hit: ScanHit) {
    onSelectAsset({ ticker: hit.asset, label: hit.label, category: hit.category as AssetCategory })
  }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'linear-gradient(170deg, #0d0e1b 0%, #080910 100%)' }}>

      {/* ── Header ── */}
      <div className="border-b border-white/6 bg-[#0a0b13] shrink-0">

        {/* Row 1: title + status */}
        <div className="flex items-center gap-3 px-5 pt-3 pb-2.5">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-200 transition-colors cursor-pointer border border-white/8 rounded-lg bg-white/4 hover:bg-white/8"
            style={{ padding: '4px 10px', minHeight: 44 }}
          >
            <span>←</span>
            <span>Chart</span>
          </button>
          <div className="w-px h-3 bg-white/8" />
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">Scanner</span>
          <div className="w-px h-3 bg-white/8" />
          <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
            {isScanning ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" /><span>Scanning… {progress}%</span></>
            ) : lastScanLabel ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" /><span>Updated {lastScanLabel}</span></>
            ) : (
              <><span className="w-1.5 h-1.5 rounded-full bg-gray-700 shrink-0" /><span>Starting…</span></>
            )}
          </div>
          {data && !isScanning && (
            <span className="text-[10px] text-gray-700 font-mono ml-1">
              {results.length}{minScore > 0 ? `/${allResults.length}` : ''} signals
            </span>
          )}
        </div>

        {/* Row 2: filters */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0 px-4 pb-3 border-t border-white/4">

          {/* Category */}
          <div className="flex items-center gap-1 pt-3 overflow-x-auto">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => setCategory(key)}
                className={[
                  'text-[11px] font-medium transition-all cursor-pointer rounded-md shrink-0',
                  category === key
                    ? 'text-white bg-white/10 border border-white/14'
                    : 'text-gray-600 hover:text-gray-300',
                ].join(' ')}
                style={{ padding: '4px 9px', minHeight: 44 }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* BUY / SELL + min score on same row */}
          <div className="flex items-center gap-2 pt-3 ml-auto">
            {(['all', 'BUY', 'SELL'] as const).map((t) => (
              <button key={t} onClick={() => setSignalType(t)}
                className={[
                  'text-[11px] font-semibold transition-all cursor-pointer rounded-md border shrink-0',
                  signalType === t
                    ? t === 'BUY'  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                    : t === 'SELL' ? 'bg-red-500/15 text-red-400 border-red-500/25'
                    : 'bg-white/10 text-white border-white/14'
                    : 'text-gray-600 border-transparent hover:text-gray-300',
                ].join(' ')}
                style={{ padding: '4px 9px', minHeight: 30 }}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
            <div className="w-px h-4 bg-white/8 shrink-0" />
            <input
              type="range" min={0} max={80} step={5}
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="w-20 h-px appearance-none bg-white/12 accent-violet-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-gray-500 w-5 shrink-0">{minScore || '—'}</span>
          </div>

        </div>
      </div>

      {/* ── Column headers — desktop only ── */}
      <div className="hidden sm:flex items-center gap-3 px-5 py-2 border-b shrink-0"
        style={{ borderColor: 'rgba(200,65,20,0.10)', background: 'rgba(10,11,19,0.7)' }}>
        <div className="w-36 shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-700">Asset</div>
        <div className="w-12 shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-700">Type</div>
        <div className="w-8 shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-700">Pat.</div>
        <div className="flex-1 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-700">Entry / SL / TP</div>
        <div className="w-16 shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-700">Dist.</div>
        <div className="w-24 shrink-0 hidden md:block text-[9px] font-bold uppercase tracking-[0.14em] text-gray-700">Strength</div>
        <div className="w-14 shrink-0 text-right hidden lg:block text-[9px] font-bold uppercase tracking-[0.14em] text-gray-700">Score</div>
        <div className="w-3 shrink-0" />
      </div>

      {/* ── Results ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex flex-col px-5 py-3 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-11 rounded-lg animate-pulse"
                style={{ background: 'rgba(200,60,20,0.04)', border: '1px solid rgba(200,60,20,0.06)' }} />
            ))}
          </div>
        )}

        {!isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            {isScanning ? (
              <>
                <div className="text-2xl">⏳</div>
                <p className="text-[12px] text-gray-600 tracking-wide leading-relaxed text-center">
                  Scanning {status?.assets_scanned} / {status?.total_assets} assets…
                </p>
                <div className="w-48 h-px rounded-full mt-1" style={{ background: 'rgba(200,60,20,0.12)' }}>
                  <div className="h-px bg-violet-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </>
            ) : !lastScan ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <p className="text-[12px] text-gray-600 text-center leading-relaxed">
                  Scanner warming up…<br />
                  <span className="text-[11px] text-gray-700">First scan takes ~4–5 minutes after startup.</span>
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl">🔍</div>
                <p className="text-[12px] text-gray-600 tracking-wide leading-relaxed">
                  No signals within 5% of entry right now
                </p>
              </>
            )}
          </div>
        )}

        {!isLoading && results.length > 0 && results.map((hit, i) => (
          <div key={`${hit.asset}-${hit.signal_type}-${i}`}>
            {/* Mobile card */}
            <div className="sm:hidden">
              <HitCard hit={hit} onSelect={() => handleSelect(hit)} />
            </div>
            {/* Desktop row */}
            <div className="hidden sm:block">
              <HitRow hit={hit} index={i} onSelect={() => handleSelect(hit)} />
            </div>
          </div>
        ))}
      </div>

      <DisclaimerBanner />
    </div>
  )
}
