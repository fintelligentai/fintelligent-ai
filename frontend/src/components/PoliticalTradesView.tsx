import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPoliticalTrades } from '../api/client'
import type { PoliticalTrade } from '../api/client'

const PARTY_COLOR: Record<string, string> = {
  D: 'text-blue-400',
  R: 'text-red-400',
  I: 'text-gray-400',
}

const TYPE_COLOR: Record<string, string> = {
  'Buy':            'text-emerald-400',
  'Sell':           'text-red-400',
  'Sell (Partial)': 'text-orange-400',
  'Exchange':       'text-amber-400',
}

function fmt(date: string) {
  if (!date) return '—'
  try { return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return date }
}

function TradeRow({ trade }: { trade: PoliticalTrade }) {
  const partyColor = PARTY_COLOR[trade.party] ?? 'text-gray-400'
  const typeColor  = TYPE_COLOR[trade.trade_type] ?? 'text-gray-400'
  const isBuy      = trade.trade_type === 'Buy'

  return (
    <tr className="border-b border-white/4 hover:bg-white/3 transition-colors">
      <td className="py-2.5 px-3 text-xs text-gray-300 whitespace-nowrap">
        <div className="font-medium">{trade.politician}</div>
        <div className="text-gray-600 text-[10px]">
          <span className={partyColor}>{trade.party}</span>
          {' · '}{trade.state}
          {' · '}<span className="text-gray-700">{trade.chamber}</span>
        </div>
      </td>
      <td className="py-2.5 px-3 text-xs font-mono font-bold text-white whitespace-nowrap">
        {trade.ticker}
      </td>
      <td className="py-2.5 px-3 text-xs text-gray-400 max-w-[160px] truncate hidden md:table-cell">
        {trade.asset_name}
      </td>
      <td className={`py-2.5 px-3 text-xs font-semibold whitespace-nowrap ${typeColor}`}>
        {isBuy ? '▲' : '▼'} {trade.trade_type}
      </td>
      <td className="py-2.5 px-3 text-xs text-gray-400 whitespace-nowrap hidden sm:table-cell">
        {trade.amount}
      </td>
      <td className="py-2.5 px-3 text-xs text-gray-600 whitespace-nowrap">
        {fmt(trade.traded_date)}
      </td>
    </tr>
  )
}

export function PoliticalTradesView() {
  const [chamber, setChamber] = useState<'all' | 'House' | 'Senate'>('all')
  const [tradeType, setTradeType] = useState<'all' | 'Buy' | 'Sell'>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['political-trades'],
    queryFn:  () => fetchPoliticalTrades(500),
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })

  const trades = data?.trades ?? []

  const filtered = trades.filter(t => {
    if (chamber !== 'all' && t.chamber !== chamber) return false
    if (tradeType === 'Buy'  && !t.trade_type.toLowerCase().includes('buy') && t.trade_type !== 'Buy') return false
    if (tradeType === 'Sell' && !t.trade_type.toLowerCase().includes('sell')) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.ticker.toLowerCase().includes(q) &&
          !t.politician.toLowerCase().includes(q) &&
          !t.asset_name.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0 flex-wrap gap-2">
        <div>
          <span className="text-sm font-semibold text-gray-200">Congressional Trades</span>
          {data && (
            <span className="ml-2 text-xs text-gray-600">
              {filtered.length} of {data.total} disclosures
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <input
            type="text"
            placeholder="Ticker or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white/6 text-white text-xs px-2.5 py-1.5 rounded outline-none focus:bg-white/10 w-36 placeholder-gray-600"
          />

          {/* Chamber filter */}
          <div className="flex rounded overflow-hidden border border-white/10">
            {(['all', 'House', 'Senate'] as const).map(c => (
              <button
                key={c}
                onClick={() => setChamber(c)}
                className={[
                  'px-2.5 py-1 text-xs cursor-pointer transition-colors',
                  chamber === c ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex rounded overflow-hidden border border-white/10">
            {(['all', 'Buy', 'Sell'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTradeType(t)}
                className={[
                  'px-2.5 py-1 text-xs cursor-pointer transition-colors',
                  tradeType === t ? 'bg-violet-600 text-white' : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                {t === 'all' ? 'All' : t === 'Buy' ? '▲ Buy' : '▼ Sell'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
            Loading congressional disclosures…
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-center h-32 text-red-400 text-sm">
            Failed to load trades. Check your connection.
          </div>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
            No trades match the current filters
          </div>
        )}
        {!isLoading && filtered.length > 0 && (
          <table className="w-full">
            <thead className="sticky top-0 bg-[#0d0e14] border-b border-white/8 z-10">
              <tr>
                <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Politician</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Ticker</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600 hidden md:table-cell">Asset</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Type</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600 hidden sm:table-cell">Amount</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => <TradeRow key={i} trade={t} />)}
            </tbody>
          </table>
        )}
      </div>

      {data && (
        <div className="shrink-0 px-4 py-2 border-t border-white/6 text-[10px] text-gray-700">
          Source: House Stock Watcher · Senate Stock Watcher · STOCK Act disclosures · Updated {new Date(data.fetched_at).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
