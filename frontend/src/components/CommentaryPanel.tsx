import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCommentary } from '../api/client'

interface Props {
  ticker: string
  timeframe: string
}

export function CommentaryPanel({ ticker, timeframe }: Props) {
  const [expanded, setExpanded] = useState(true)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['commentary', ticker, timeframe],
    queryFn:  () => fetchCommentary(ticker, timeframe),
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
    retry: 1,
  })

  const generatedLabel = data?.generated_at
    ? `${Math.round((Date.now() - new Date(data.generated_at).getTime()) / 60_000)} min ago`
    : null

  return (
    <div className="border-t border-white/8 bg-[#0d0e14] shrink-0">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2 text-left cursor-pointer hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            AI Commentary
          </span>
          {isLoading && (
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          )}
          {data && !isLoading && (
            <span className="text-xs text-gray-700">
              · {data.cached ? 'cached' : 'generated'}{generatedLabel ? `, ${generatedLabel}` : ''}
            </span>
          )}
        </div>
        <span className="text-gray-700 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 sm:px-4 pb-3">
          {isLoading && (
            <div className="space-y-1.5">
              {[100, 90, 75].map((w) => (
                <div key={w} className={`h-3 rounded bg-white/5 animate-pulse`} style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-xs text-red-400">
              Commentary unavailable — check that the backend is running and ANTHROPIC_API_KEY is set.
            </p>
          )}

          {data && !isLoading && (
            <p className="text-xs text-gray-400 leading-relaxed">{data.commentary}</p>
          )}
        </div>
      )}
    </div>
  )
}
