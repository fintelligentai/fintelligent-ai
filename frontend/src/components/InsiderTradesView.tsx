import { useQuery } from '@tanstack/react-query'
import { fetchSignificantInsiderActivity, fetchInsiderNews } from '../api/client'
import type { InsiderSignal, NewsArticle } from '../api/client'
import { InsiderTooltip } from './InsiderTooltip'
import { cardBase, DIVIDER, WARM_LABEL, WARM_LABEL_COLOR } from '../styles/card'

const VERDICT_CONFIG = {
  significant_buying: {
    icon: '🟢', label: 'Significant Buying',
    badge: 'bg-emerald-500/18 text-emerald-300 border border-emerald-500/28',
    ticker: 'text-emerald-400',
  },
  significant_selling: {
    icon: '🔴', label: 'Significant Selling',
    badge: 'bg-red-500/18 text-red-300 border border-red-500/28',
    ticker: 'text-red-400',
  },
  mixed: {
    icon: '🟡', label: 'Mixed Activity',
    badge: 'bg-amber-500/18 text-amber-300 border border-amber-500/28',
    ticker: 'text-amber-400',
  },
  none: {
    icon: '⚪', label: 'No Significant Activity',
    badge: 'bg-white/6 text-gray-500 border border-white/10',
    ticker: 'text-gray-400',
  },
}

function NewsLines({ ticker }: { ticker: string }) {
  const { data } = useQuery({
    queryKey: ['insider-news', ticker],
    queryFn:  () => fetchInsiderNews(ticker, 3),
    staleTime: 2 * 60 * 60 * 1000,
    retry: 1,
  })
  const articles = data?.articles ?? []
  if (!articles.length) return null
  return (
    <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid rgba(200,68,24,0.10)' }}>
      <div className={WARM_LABEL} style={{ color: WARM_LABEL_COLOR, marginBottom: 4 }}>News</div>
      {articles.map((a: NewsArticle, i: number) => (
        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
          className="block text-[11px] text-gray-500 hover:text-gray-300 transition-colors leading-snug">
          {a.title}
          <span className="ml-1 text-gray-700">· {a.publisher}</span>
        </a>
      ))}
    </div>
  )
}

function InsiderCard({ signal }: { signal: InsiderSignal }) {
  const config = VERDICT_CONFIG[signal.verdict] ?? VERDICT_CONFIG.none

  return (
    <div style={{ ...cardBase, padding: '18px 16px' }}>
      {/* Verdict badge */}
      <div className="mb-4">
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${config.badge}`}>
          {config.icon} {config.label}
        </span>
      </div>

      {/* Dominant: Ticker */}
      <div className="mb-1">
        <div className={`text-[28px] font-bold font-mono leading-none ${config.ticker}`}>
          {signal.ticker}
        </div>
      </div>
      <div className="text-[12px] text-gray-600 mb-4 truncate">{signal.company}</div>

      {/* Divider */}
      <div style={DIVIDER} />

      {/* Summary + tooltip details */}
      <div className="flex items-start flex-wrap gap-1.5">
        <span className="text-[12px] text-gray-400 leading-relaxed">{signal.summary}</span>
        {signal.seller_details && signal.seller_details.length > 0 && (
          <InsiderTooltip details={signal.seller_details} label="Sellers" />
        )}
        {signal.buyer_details && signal.buyer_details.length > 0 && (
          <InsiderTooltip details={signal.buyer_details} label="Buyers" />
        )}
      </div>

      <NewsLines ticker={signal.ticker} />
    </div>
  )
}

export function InsiderTradesView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['insider-trades-significant'],
    queryFn:  () => fetchSignificantInsiderActivity(50),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  const signals = data?.signals ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0e14]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 shrink-0 bg-[#0b0c12]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Insider Activity</span>
          <span className="text-xs text-gray-600">SEC Form 4 · last 30 days</span>
          {data && signals.length > 0 && (
            <span className="text-xs text-gray-700">· {signals.length} signals</span>
          )}
        </div>
        {data && (
          <span className="text-[10px] text-gray-700">
            {new Date(data.fetched_at).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-600 text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            Scanning SEC EDGAR for significant activity…
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-center h-32 text-red-400 text-sm">
            Failed to load insider activity. Is the backend running?
          </div>
        )}
        {!isLoading && !isError && signals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-600 text-sm">
            <span className="text-2xl">⚪</span>
            No significant insider activity detected in the last 30 days
          </div>
        )}
        {!isLoading && signals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {signals.map((s, i) => <InsiderCard key={i} signal={s} />)}
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 py-2 border-t border-white/6 text-[10px] text-gray-700">
        Source: SEC EDGAR Form 4 · Significant = ≥$500K sold or 3+ insiders · ≥$100K bought or 2+ insiders
      </div>
    </div>
  )
}
