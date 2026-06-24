import { useQuery } from '@tanstack/react-query'
import { fetchPoliticalTradesForTicker } from '../api/client'
import type { PoliticalTrade } from '../api/client'

const PARTY_COLOR: Record<string, string> = {
  D: 'text-blue-400',
  R: 'text-red-400',
  I: 'text-gray-400',
}

function fmt(date: string) {
  if (!date) return '—'
  try { return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return date }
}

function TradeRow({ trade }: { trade: PoliticalTrade }) {
  const isBuy      = trade.trade_type === 'Buy'
  const partyColor = PARTY_COLOR[trade.party] ?? 'text-gray-500'
  const typeColor  = isBuy ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 gap-2 min-w-0">
      <div className="min-w-0">
        <div className="text-xs text-gray-300 truncate">{trade.politician}</div>
        <div className="text-[10px] text-gray-600 mt-0.5">
          <span className={partyColor}>{trade.party}</span>
          {' · '}{trade.state} · {trade.chamber}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-xs font-semibold ${typeColor}`}>
          {isBuy ? '▲' : '▼'} {trade.trade_type}
        </div>
        <div className="text-[10px] text-gray-600 mt-0.5">{fmt(trade.traded_date)}</div>
      </div>
    </div>
  )
}

interface Props {
  ticker: string
}

export function PoliticalTradesPanel({ ticker }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['political-trades', ticker],
    queryFn:  () => fetchPoliticalTradesForTicker(ticker, 20),
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <div className="h-3 w-32 rounded bg-white/5 animate-pulse mb-2" />
        {[0,1,2].map(i => <div key={i} className="h-10 rounded bg-white/4 animate-pulse mb-1.5" />)}
      </div>
    )
  }

  const trades = data?.trades ?? []

  if (trades.length === 0) {
    return (
      <div className="px-3 py-3 text-xs text-gray-600 text-center">
        No congressional trades on record for {ticker}
      </div>
    )
  }

  return (
    <div className="px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">
        Congressional Trades ({trades.length})
      </div>
      {trades.map((t, i) => <TradeRow key={i} trade={t} />)}
    </div>
  )
}
