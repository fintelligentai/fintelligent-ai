import { useQuery } from '@tanstack/react-query'
import { fetchMacroEvents } from '../api/client'
import type { MacroImpact } from '../api/client'

const DIRECTION_CONFIG = {
  bullish: { label: 'Bullish', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', icon: '▲' },
  bearish: { label: 'Bearish', color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.28)',  icon: '▼' },
  watch:   { label: 'Watch',   color: '#fbbf24', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', icon: '◆' },
}

function ImpactPill({ impact }: { impact: MacroImpact }) {
  const cfg = DIRECTION_CONFIG[impact.direction]
  return (
    <div
      title={impact.reason}
      className="flex items-center gap-1 cursor-default"
      style={{
        padding: '3px 8px',
        borderRadius: 6,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 8, color: cfg.color }}>{cfg.icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{impact.label}</span>
    </div>
  )
}

function EventCard({ event }: { event: { title: string; source: string; url: string; published_at: string; direction_hint: string; impacts: MacroImpact[] } }) {
  const date = new Date(event.published_at)
  const timeAgo = (() => {
    const diffMs = Date.now() - date.getTime()
    const diffH  = Math.floor(diffMs / 3_600_000)
    if (diffH < 1)  return `${Math.floor(diffMs / 60_000)}m ago`
    if (diffH < 24) return `${diffH}h ago`
    return `${Math.floor(diffH / 24)}d ago`
  })()

  return (
    <div
      className="rounded-xl"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '16px 18px',
      }}
    >
      {/* Header: source + time + hint */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {event.source}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>·</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.20)' }}>{timeAgo}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 600,
            color: 'rgba(255,185,130,0.55)',
            background: 'rgba(255,120,40,0.08)',
            border: '1px solid rgba(255,120,40,0.15)',
            borderRadius: 5,
            padding: '2px 7px',
          }}
        >
          {event.direction_hint}
        </span>
      </div>

      {/* Headline */}
      <a
        href={event.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-white hover:text-violet-300 transition-colors"
        style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 12 }}
      >
        {event.title}
      </a>

      {/* Impact pills */}
      <div className="flex flex-wrap gap-2">
        {event.impacts.map((imp, i) => (
          <ImpactPill key={i} impact={imp} />
        ))}
      </div>
    </div>
  )
}

export function MacroEventsView() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['macro-events'],
    queryFn: () => fetchMacroEvents(15),
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
    retry: 1,
  })

  return (
    <div className="h-full flex flex-col bg-[#09090e] overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between border-b"
        style={{ padding: '14px 20px', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Market Events</h2>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
            Macro headlines mapped to affected assets — tap a pill to see why
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          style={{ fontSize: 18, padding: 6 }}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
        {isLoading && (
          <div className="flex flex-col gap-3">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="rounded-xl animate-pulse h-24"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p style={{ color: 'rgba(248,113,113,0.7)', fontSize: 13 }}>Failed to load market events.</p>
            <button onClick={() => refetch()} className="mt-3 text-violet-400 hover:text-violet-300 text-sm transition-colors">
              Try again
            </button>
          </div>
        )}

        {data?.error && !data.events.length && (
          <div className="text-center py-12">
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              {data.error.includes('NEWSAPI_KEY')
                ? 'NewsAPI key not configured. Add NEWSAPI_KEY to your backend environment variables.'
                : data.error}
            </p>
          </div>
        )}

        {!isLoading && !isError && data?.events.length === 0 && !data?.error && (
          <div className="text-center py-12">
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>No macro events matched right now — check back soon.</p>
          </div>
        )}

        {data?.events && data.events.length > 0 && (
          <div className="flex flex-col gap-3 max-w-2xl">
            {data.events.map((event, i) => (
              <EventCard key={i} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Footer disclaimer */}
      <div
        className="shrink-0 border-t text-center"
        style={{ padding: '10px 20px', borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
          Macro impact is indicative only — not a trading signal. Always apply your own analysis.
        </p>
      </div>
    </div>
  )
}
