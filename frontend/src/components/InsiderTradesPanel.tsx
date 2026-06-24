import { useQuery } from '@tanstack/react-query'
import { fetchInsiderTradesForTicker, fetchInsiderNews } from '../api/client'
import type { InsiderVerdict, NewsArticle } from '../api/client'
import { InsiderTooltip } from './InsiderTooltip'

const VERDICT_CONFIG = {
  significant_buying: {
    icon: '🟢', label: 'Significant Insider Buying',
    color: 'border-emerald-500/40 bg-emerald-500/8 text-emerald-400',
  },
  significant_selling: {
    icon: '🔴', label: 'Significant Insider Selling',
    color: 'border-red-500/40 bg-red-500/8 text-red-400',
  },
  mixed: {
    icon: '🟡', label: 'Mixed Insider Activity',
    color: 'border-amber-500/40 bg-amber-500/8 text-amber-400',
  },
  none: {
    icon: '⚪', label: 'No Significant Activity',
    color: 'border-white/10 bg-white/3 text-gray-500',
  },
}

function NewsSection({ ticker }: { ticker: string }) {
  const { data } = useQuery({
    queryKey: ['insider-news', ticker],
    queryFn:  () => fetchInsiderNews(ticker, 4),
    staleTime: 2 * 60 * 60 * 1000,
    retry: 1,
  })

  const articles = data?.articles ?? []
  if (!articles.length) return null

  return (
    <div className="mt-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1.5">Related News</div>
      <div className="space-y-1.5">
        {articles.map((a: NewsArticle, i: number) => (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[11px] text-gray-400 hover:text-gray-200 transition-colors leading-snug"
          >
            {a.title}
            <span className="ml-1 text-gray-700">· {a.publisher}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

interface Props { ticker: string }

export function InsiderTradesPanel({ ticker }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['insider-trades', ticker],
    queryFn:  () => fetchInsiderTradesForTicker(ticker, 30),
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="px-3 py-3">
        <div className="h-16 rounded-lg bg-white/5 animate-pulse" />
      </div>
    )
  }

  const verdict  = data?.verdict
  const exchange = data?.exchange
  const config   = VERDICT_CONFIG[verdict?.verdict ?? 'none']

  return (
    <div className="px-3 py-3">
      <div className={`rounded-lg border p-3 ${config.color}`}>
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5">
            <span>{config.icon}</span>
            <span className="text-xs font-semibold">{config.label}</span>
          </div>
          {exchange && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-gray-500 shrink-0">
              {exchange}
            </span>
          )}
        </div>

        {/* Summary with tooltip */}
        {verdict && verdict.verdict !== 'none' && (
          <div className="flex items-center gap-0.5 text-[11px] text-gray-500 leading-relaxed flex-wrap">
            <span>{verdict.summary}</span>
            {verdict.seller_details.length > 0 && (
              <InsiderTooltip details={verdict.seller_details} label="Sellers" />
            )}
            {verdict.buyer_details.length > 0 && (
              <InsiderTooltip details={verdict.buyer_details} label="Buyers" />
            )}
          </div>
        )}
        {verdict?.verdict === 'none' && (
          <div className="text-[11px] text-gray-600">{verdict.summary}</div>
        )}
      </div>

      <NewsSection ticker={ticker} />
      <div className="text-[10px] text-gray-700 mt-2 px-1">Source: SEC EDGAR Form 4</div>
    </div>
  )
}
