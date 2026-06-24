import { useQueries } from '@tanstack/react-query'
import { fetchSignals } from '../api/client'
import type { Asset } from '../types/asset'

interface Props {
  watchlist: Asset[]
  currentTicker: string
  onSelect: (asset: Asset) => void
  onRemove: (ticker: string) => void
}

const STRENGTH_COLOR: Record<string, string> = {
  'Very Strong': 'text-emerald-400',
  'Strong':      'text-emerald-500',
  'Moderate':    'text-amber-400',
  'Weak':        'text-gray-500',
}

export function WatchlistPanel({ watchlist, currentTicker, onSelect, onRemove }: Props) {
  const results = useQueries({
    queries: watchlist.map((asset) => ({
      queryKey: ['signals', asset.ticker, '1d', 2],
      queryFn:  () => fetchSignals(asset.ticker, '1d', 2),
      staleTime: 15 * 60_000,
      refetchInterval: 15 * 60_000,
    })),
  })

  if (watchlist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4 gap-2">
        <span className="text-2xl">★</span>
        <p className="text-xs text-gray-600">
          Pin assets by clicking the ★ next to any asset name
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {watchlist.map((asset, i) => {
        const query      = results[i]
        const data       = query.data
        const isLoading  = query.isLoading
        const isCurrent  = asset.ticker === currentTicker

        const allSignals = data ? [...data.buy_signals, ...data.sell_signals] : []
        const topSignal  = allSignals.sort((a, b) => b.signal_strength - a.signal_strength)[0]
        const price      = data?.current_price

        return (
          <div
            key={asset.ticker}
            className={[
              'rounded-lg border p-2.5 transition-colors group',
              isCurrent
                ? 'border-violet-500/40 bg-violet-500/8'
                : 'border-white/8 bg-white/3 hover:bg-white/6',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-1 mb-1.5">
              <button
                onClick={() => onSelect(asset)}
                className="text-left flex-1 min-w-0 cursor-pointer"
              >
                <div className="text-xs font-medium text-gray-200 truncate">{asset.label}</div>
                <div className="text-xs text-gray-600">{asset.ticker}</div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                {price != null && (
                  <span className="text-xs font-mono text-gray-400">
                    {price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                )}
                <button
                  onClick={() => onRemove(asset.ticker)}
                  className="text-gray-700 hover:text-red-400 transition-colors text-xs cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Remove from watchlist"
                >
                  ✕
                </button>
              </div>
            </div>

            {isLoading && (
              <div className="h-4 rounded bg-white/5 animate-pulse" />
            )}

            {!isLoading && !topSignal && (
              <span className="text-xs text-gray-700">No active signals</span>
            )}

            {!isLoading && topSignal && (
              <div className="flex items-center gap-2">
                <span className={[
                  'text-xs font-bold px-1.5 py-0.5 rounded shrink-0',
                  topSignal.signal_type === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400',
                ].join(' ')}>
                  {topSignal.signal_type}
                </span>
                <span className="text-xs text-gray-600">{topSignal.formation_pattern}</span>
                <span className={`text-xs ml-auto ${STRENGTH_COLOR[topSignal.strength_label]}`}>
                  {topSignal.strength_label}
                </span>
                <span className="text-xs text-gray-600">{topSignal.signal_strength}%</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
