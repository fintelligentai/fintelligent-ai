import { useState, useEffect } from 'react'
import type { TradeSignal, SignalResult, MACross } from '../types/asset'
import type { PatternStat } from '../api/client'
import { DisclaimerBanner } from './DisclaimerBanner'
import { WinRateBadge } from './WinRateBadge'
import { MACrossBadge } from './MACrossBadge'
import { cardBuy, cardBuySelected, cardSell, cardSellSelected, DIVIDER, WARM_LABEL, WARM_LABEL_COLOR } from '../styles/card'

interface Props {
  data: SignalResult | undefined
  isLoading: boolean
  rr: number
  onRRChange: (rr: number) => void
  selectedZoneId: string | null
  patternStats?: Record<string, PatternStat>
  patternStatsLoading?: boolean
  maCross?: MACross
  timeframe?: string
  ticker?: string
}

const STRENGTH_COLOR: Record<string, string> = {
  'Very Strong': 'text-emerald-400',
  'Strong':      'text-emerald-500',
  'Moderate':    'text-amber-400',
  'Weak':        'text-gray-500',
}

const STRENGTH_BAR: Record<string, string> = {
  'Very Strong': 'bg-emerald-400',
  'Strong':      'bg-emerald-500',
  'Moderate':    'bg-amber-400',
  'Weak':        'bg-gray-600',
}

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1)    return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function SignalCard({ signal, isSelected, patternStats, patternStatsLoading }: {
  signal: TradeSignal
  isSelected: boolean
  patternStats?: Record<string, PatternStat>
  patternStatsLoading?: boolean
}) {
  const isBuy = signal.signal_type === 'BUY'

  const cardStyle = isBuy
    ? (isSelected ? cardBuySelected : cardBuy)
    : (isSelected ? cardSellSelected : cardSell)

  return (
    <div style={{ ...cardStyle, padding: '18px' }}>
      {/* Top row: direction badge + pattern + strength */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={[
              'text-[11px] font-bold rounded-md tracking-wide border',
              isBuy
                ? 'bg-emerald-500/18 text-emerald-400 border-emerald-500/25'
                : 'bg-red-500/18 text-red-400 border-red-500/25',
            ].join(' ')}
            style={{ padding: '3px 9px' }}
          >
            {signal.signal_type}
          </span>
          <span className="text-[11px] font-mono" style={{ color: 'rgba(255,185,130,0.50)' }}>
            {signal.formation_pattern}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold ${STRENGTH_COLOR[signal.strength_label]}`}>
            {signal.strength_label}
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,185,130,0.35)' }}>
            {signal.signal_strength}%
          </span>
        </div>
      </div>

      {/* Dominant: Entry price */}
      <div className="mb-4">
        <div className={WARM_LABEL} style={{ color: WARM_LABEL_COLOR, marginBottom: 4 }}>Entry</div>
        <div className="text-[26px] font-semibold font-mono text-white leading-none tracking-tight">
          {fmt(signal.entry)}
        </div>
      </div>

      {/* Secondary: SL / TP */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className={WARM_LABEL} style={{ color: WARM_LABEL_COLOR, marginBottom: 3 }}>Stop loss</div>
          <div className="text-[13px] font-mono text-red-400 font-medium">{fmt(signal.stop_loss)}</div>
        </div>
        <div>
          <div className={WARM_LABEL} style={{ color: WARM_LABEL_COLOR, marginBottom: 3 }}>Take profit</div>
          <div className="text-[13px] font-mono text-emerald-400 font-medium">{fmt(signal.take_profit)}</div>
        </div>
      </div>

      {/* Divider */}
      <div style={DIVIDER} />

      {/* Strength bar + distance */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,100,40,0.10)' }}>
          <div
            className={`h-1 rounded-full transition-all ${STRENGTH_BAR[signal.strength_label]}`}
            style={{ width: `${signal.signal_strength}%` }}
          />
        </div>
        <span className="text-[10px] font-mono shrink-0" style={{ color: 'rgba(255,185,130,0.42)' }}>
          {signal.distance_pct}% away
        </span>
      </div>

      <WinRateBadge
        pattern={signal.formation_pattern}
        stat={patternStats?.[signal.formation_pattern]}
        isLoading={patternStatsLoading ?? false}
      />
    </div>
  )
}

export function SignalsPanel({ data, isLoading, rr, onRRChange, selectedZoneId, patternStats, patternStatsLoading, maCross, timeframe = '1d', ticker = '' }: Props) {
  const [rrInput, setRRInput] = useState(String(rr))
  useEffect(() => { setRRInput(String(rr)) }, [rr])

  function handleRRCommit(val: string) {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0.5 && n <= 20) onRRChange(Math.round(n * 10) / 10)
  }

  const buySignals  = data?.buy_signals  ?? []
  const sellSignals = data?.sell_signals ?? []
  const allSignals  = [...buySignals, ...sellSignals].sort((a, b) => {
    if (a.zone_id === selectedZoneId) return -1
    if (b.zone_id === selectedZoneId) return 1
    return a.distance_pct - b.distance_pct
  })

  return (
    <div className="border-t border-white/8 bg-[#0b0c12] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-white/8 gap-2 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Signals</span>
          {data && (
            <span className="text-xs text-gray-700">
              {buySignals.length} buy · {sellSignals.length} sell
            </span>
          )}
          <MACrossBadge maCross={maCross} timeframe={timeframe} ticker={ticker} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 hidden sm:block">Risk / Reward</span>
          <span className="text-xs text-gray-600">1 :</span>
          <input
            type="number"
            min={0.5} max={20} step={0.5}
            value={rrInput}
            onChange={(e) => setRRInput(e.target.value)}
            onBlur={(e) => handleRRCommit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRRCommit(rrInput)}
            className="w-14 bg-white/6 text-white text-xs font-mono px-2 py-1 rounded outline-none focus:bg-white/12 text-center"
          />
        </div>
      </div>

      {/* Cards strip */}
      <div className="px-3 sm:px-4 py-4 sm:overflow-x-auto">
        {isLoading && (
          <div className="flex flex-col sm:flex-row gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 w-full sm:w-72 rounded-2xl shrink-0 animate-pulse"
                style={{ background: 'rgba(30,4,4,0.6)', border: '1px solid rgba(200,55,18,0.12)' }} />
            ))}
          </div>
        )}

        {!isLoading && allSignals.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-4">
            No active signals — all zones have been tested or broken
          </p>
        )}

        {!isLoading && allSignals.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            {allSignals.map((signal) => (
              <div key={signal.zone_id} className="w-full sm:w-72 shrink-0">
                <SignalCard
                  signal={signal}
                  isSelected={signal.zone_id === selectedZoneId}
                  patternStats={patternStats}
                  patternStatsLoading={patternStatsLoading}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <DisclaimerBanner />
    </div>
  )
}
