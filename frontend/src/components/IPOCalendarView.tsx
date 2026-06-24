import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchIPOCalendar } from '../api/client'
import type { IPOEntry } from '../api/client'
import { cardBase, cardNotable, cardStandard, DIVIDER, WARM_LABEL, WARM_LABEL_COLOR } from '../styles/card'

const TIER_BADGE = {
  major:    'bg-red-500/18 text-red-300 border border-red-500/28',
  notable:  'bg-amber-500/18 text-amber-300 border border-amber-500/28',
  standard: 'bg-white/5 text-gray-500 border border-white/10',
}

const TIER_CARD = {
  major:    cardBase,
  notable:  cardNotable,
  standard: cardStandard,
}

const EXCHANGE_COLOR: Record<string, string> = {
  'NYSE':          'text-blue-400',
  'NASDAQ':        'text-violet-400',
  'NASDAQ Select': 'text-violet-400',
}

function fmt(date: string) {
  if (!date) return '—'
  try { return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return date }
}

function IPOCard({ entry }: { entry: IPOEntry }) {
  const badgeStyle = TIER_BADGE[entry.tier]
  const exColor    = EXCHANGE_COLOR[entry.exchange] ?? 'text-gray-500'

  return (
    <div style={{ ...TIER_CARD[entry.tier], padding: '18px 16px' }}>
      {/* Tier badge + exchange row */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${badgeStyle}`}>
          {entry.icon} {entry.label}
        </span>
        <div className="flex items-center gap-2">
          {entry.exchange && (
            <span className={`text-[11px] font-bold ${exColor}`}>{entry.exchange}</span>
          )}
          <span className="text-[10px]" style={{ color: 'rgba(255,185,130,0.38)' }}>{fmt(entry.date)}</span>
        </div>
      </div>

      {/* Dominant: Company name */}
      <div className="mb-4">
        <div className="text-[17px] font-bold text-white leading-tight">{entry.company}</div>
        {entry.ticker && (
          <div className="text-[11px] font-mono mt-0.5" style={{ color: 'rgba(255,185,130,0.40)' }}>
            {entry.ticker}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={DIVIDER} />

      {/* Key stats: deal size (dominant number) + price range */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className={WARM_LABEL} style={{ color: WARM_LABEL_COLOR, marginBottom: 3 }}>Deal Size</div>
          <div className="text-[20px] font-semibold font-mono text-white leading-none">
            {entry.deal_value_fmt}
          </div>
        </div>
        <div>
          <div className={WARM_LABEL} style={{ color: WARM_LABEL_COLOR, marginBottom: 3 }}>Price Range</div>
          <div className="text-[15px] font-mono text-gray-300 leading-none">
            {entry.price_range !== '—' ? `$${entry.price_range}` : '—'}
          </div>
        </div>
      </div>

      {/* Shares + impact */}
      <div className="flex items-center gap-2 mt-2" style={{ color: 'rgba(255,185,130,0.38)' }}>
        <span className="text-[10px]">📊</span>
        <span className="text-[11px] leading-snug">{entry.impact}</span>
      </div>
    </div>
  )
}

type Tab = 'upcoming' | 'priced' | 'filed'

export function IPOCalendarView() {
  const [tab, setTab]             = useState<Tab>('priced')
  const [tierFilter, setTierFilter] = useState<'all' | 'major' | 'notable'>('all')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ipo-calendar'],
    queryFn:  fetchIPOCalendar,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })

  const entries  = data?.[tab] ?? []
  const filtered = entries.filter(e =>
    tierFilter === 'all'    ? true :
    tierFilter === 'major'  ? e.tier === 'major' :
    e.tier === 'major' || e.tier === 'notable'
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: `Upcoming${data ? ` (${data.upcoming.length})` : ''}` },
    { key: 'priced',   label: `Recent${data   ? ` (${data.priced.length})`   : ''}` },
    { key: 'filed',    label: `Filed${data     ? ` (${data.filed.length})`    : ''}` },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0d0e14' }}>

      {/* Header */}
      <div className="flex items-center justify-between shrink-0 flex-wrap" style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0b0c12', gap: 10 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <span className="text-[11px] font-bold uppercase text-gray-500" style={{ letterSpacing: '0.12em' }}>IPO Calendar</span>
          {data && (
            <span className="text-[11px] text-gray-600 font-mono">{data.month} {data.year}</span>
          )}
        </div>

        <div className="flex items-center" style={{ gap: 8 }}>
          {/* Tier filter pills */}
          <div className="flex items-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden' }}>
            {(['all', 'notable', 'major'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className="text-[11px] font-semibold cursor-pointer transition-all"
                style={{
                  padding: '5px 11px',
                  background: tierFilter === t ? 'rgba(124,58,237,0.25)' : 'transparent',
                  color: tierFilter === t ? '#c4b5fd' : '#6b7280',
                  borderRight: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {t === 'all' ? 'All' : t === 'notable' ? '🟡 Notable+' : '🔴 Major'}
              </button>
            ))}
          </div>

          {data && (
            <span className="text-[10px] text-gray-700 font-mono">
              {new Date(data.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-end shrink-0" style={{ padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0e14', gap: 2 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="text-[12px] font-semibold cursor-pointer transition-all"
            style={{
              padding: '10px 14px',
              color: tab === t.key ? '#e5e7eb' : '#4b5563',
              borderBottom: tab === t.key ? '2px solid #7c3aed' : '2px solid transparent',
              marginBottom: -1,
              background: 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: 16 }}>
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm" style={{ gap: 8 }}>
            <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            Loading IPO calendar…
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-center h-32 text-red-400 text-sm">
            Failed to load IPO calendar. Is the backend running?
          </div>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm" style={{ gap: 4 }}>
            No {tab} IPOs{tierFilter !== 'all' ? ' matching the filter' : ''}
          </div>
        )}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 14 }}>
            {filtered.map(e => <IPOCard key={e.deal_id} entry={e} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 text-[10px] text-gray-700" style={{ padding: '8px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        Source: Nasdaq IPO Calendar · Major = $500M+ offering · Notable = $100M+ offering
      </div>
    </div>
  )
}
