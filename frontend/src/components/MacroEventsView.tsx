import { useQuery } from '@tanstack/react-query'
import { fetchMacroEvents } from '../api/client'
import type { MacroImpact, MacroEvent } from '../api/client'

const DIRECTION_CONFIG = {
  bullish: { label: 'Bullish', color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', icon: '▲' },
  bearish: { label: 'Bearish', color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.28)',  icon: '▼' },
  watch:   { label: 'Watch',   color: '#fbbf24', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', icon: '◆' },
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffH  = Math.floor(diffMs / 3_600_000)
  if (diffH < 1)  return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

function ImpactPill({ impact }: { impact: MacroImpact }) {
  const cfg = DIRECTION_CONFIG[impact.direction as keyof typeof DIRECTION_CONFIG] ?? DIRECTION_CONFIG.watch
  return (
    <div title={impact.reason} className="flex items-center gap-1 cursor-default shrink-0"
      style={{ padding: '3px 8px', borderRadius: 6, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <span style={{ fontSize: 8, color: cfg.color }}>{cfg.icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{impact.label}</span>
    </div>
  )
}

function CardShell({ event, tag, children }: { event: MacroEvent; tag: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '16px 18px' }}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {event.source}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>·</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.20)' }}>{timeAgo(event.published_at)}</span>
        <span style={{ marginLeft: 'auto' }}>{tag}</span>
      </div>
      <a href={event.url} target="_blank" rel="noopener noreferrer"
        className="block text-white hover:text-violet-300 transition-colors"
        style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 12 }}>
        {event.title}
      </a>
      {children}
    </div>
  )
}

function MacroTag({ hint }: { hint: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,185,130,0.55)', background: 'rgba(255,120,40,0.08)', border: '1px solid rgba(255,120,40,0.15)', borderRadius: 5, padding: '2px 7px' }}>
      {hint}
    </span>
  )
}

function CompanyTag({ eventType }: { eventType: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(167,139,250,0.8)', background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.22)', borderRadius: 5, padding: '2px 7px' }}>
      {eventType}
    </span>
  )
}

function MacroEventCard({ event }: { event: MacroEvent }) {
  return (
    <CardShell event={event} tag={<MacroTag hint={event.direction_hint} />}>
      <div className="flex flex-wrap gap-2">
        {event.impacts.filter(imp => imp.direction !== 'watch').map((imp, i) => <ImpactPill key={i} impact={imp} />)}
      </div>
    </CardShell>
  )
}

function CompanyEventCard({ event }: { event: MacroEvent }) {
  const dir = event.direction as keyof typeof DIRECTION_CONFIG
  const cfg = DIRECTION_CONFIG[dir] ?? DIRECTION_CONFIG.watch
  return (
    <CardShell event={event} tag={<CompanyTag eventType={event.event_type} />}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Ticker pill */}
        <div className="flex items-center gap-1.5 shrink-0"
          style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{event.ticker}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{event.company}</span>
        </div>
        {/* Direction */}
        <div className="flex items-center gap-1 shrink-0"
          style={{ padding: '3px 9px', borderRadius: 6, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <span style={{ fontSize: 9, color: cfg.color }}>{cfg.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
        </div>
        {/* Reason */}
        {event.reason && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{event.reason}</span>
        )}
      </div>
    </CardShell>
  )
}

export function MacroEventsView() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['macro-events'],
    queryFn: () => fetchMacroEvents(20),
    staleTime: 20 * 60_000,
    refetchInterval: 20 * 60_000,
    retry: 1,
  })

  const macroCount   = data?.events.filter(e => e.category === 'macro').length   ?? 0
  const companyCount = data?.events.filter(e => e.category === 'company').length ?? 0

  return (
    <div className="h-full flex flex-col bg-[#09090e] overflow-hidden">
      <div className="shrink-0 flex items-center justify-between border-b" style={{ padding: '14px 20px', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Market Events</h2>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
            {data && !isLoading
              ? `${macroCount} macro · ${companyCount} company catalyst${companyCount !== 1 ? 's' : ''}`
              : 'Macro themes + company catalysts, AI-classified'}
          </p>
        </div>
        <button onClick={() => refetch()} className="text-gray-600 hover:text-gray-400 transition-colors" style={{ fontSize: 18, padding: 6 }} title="Refresh">↻</button>
      </div>

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
            <button onClick={() => refetch()} className="mt-3 text-violet-400 hover:text-violet-300 text-sm transition-colors">Try again</button>
          </div>
        )}

        {data?.error && !data.events.length && (
          <div className="text-center py-12">
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>{data.error}</p>
          </div>
        )}

        {!isLoading && !isError && data?.events.length === 0 && (
          <div className="text-center py-12">
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>No events matched right now — check back soon.</p>
          </div>
        )}

        {data?.events && data.events.length > 0 && (
          <div className="flex flex-col gap-3 max-w-2xl">
            {data.events.map((event, i) =>
              event.category === 'company'
                ? <CompanyEventCard key={i} event={event} />
                : <MacroEventCard   key={i} event={event} />
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t text-center" style={{ padding: '10px 20px', borderColor: 'rgba(255,255,255,0.05)' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
          Macro impact is indicative only — not a trading signal. AI classification may contain errors.
        </p>
      </div>
    </div>
  )
}
