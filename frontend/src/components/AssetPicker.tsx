import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchAssets, listAssets } from '../api/client'
import type { Asset, AssetCategory } from '../types/asset'

const CATEGORIES: { id: AssetCategory; label: string }[] = [
  { id: 'crypto',      label: 'Crypto'      },
  { id: 'stocks',      label: 'Stocks'      },
  { id: 'commodities', label: 'Commodities' },
  { id: 'forex',       label: 'Forex'       },
  { id: 'indices',     label: 'Indices'     },
]

interface Props {
  selected: Asset | null
  onChange: (asset: Asset) => void
}

export function AssetPicker({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<AssetCategory>('crypto')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isSearching = query.length >= 1

  const browseQuery = useQuery({
    queryKey: ['assets', category],
    queryFn: () => listAssets(category),
    staleTime: Infinity,
    enabled: open && !isSearching,
  })

  const searchQuery = useQuery({
    queryKey: ['assets-search', query, category],
    queryFn: () => searchAssets(query, category),
    staleTime: 30_000,
    enabled: open && isSearching,
  })

  const results: Asset[] = isSearching
    ? (searchQuery.data ?? [])
    : (browseQuery.data ?? [])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function select(asset: Asset) {
    onChange(asset)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/8 hover:bg-white/12 transition-colors text-sm cursor-pointer"
      >
        <span className="font-medium text-white">
          {selected ? selected.label : 'Select asset'}
        </span>
        {selected && (
          <span className="text-gray-500 text-xs font-mono">{selected.ticker}</span>
        )}
        <svg className="w-3 h-3 text-gray-500 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-[#0e0f18] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ width: 'min(384px, calc(100vw - 24px))' }}>
          {/* Search input */}
          <div className="p-2 border-b border-white/8">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker or name…"
              className="w-full bg-white/6 text-white text-sm px-3 py-2 rounded outline-none placeholder-gray-600 focus:bg-white/10"
            />
          </div>

          {/* Category tabs — shown when not searching */}
          {!isSearching && (
            <div className="flex border-b border-white/8" style={{ gap: 4, padding: 8 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={[
                    'flex-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer border text-center',
                    category === c.id
                      ? 'bg-violet-600/20 text-violet-300 border-violet-500/30'
                      : 'text-gray-500 hover:text-gray-300 border-transparent hover:border-white/8 hover:bg-white/5',
                  ].join(' ')}
                  style={{ padding: '4px 6px' }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Results list */}
          <div className="max-h-64 overflow-y-auto">
            {(isSearching ? searchQuery.isLoading : browseQuery.isLoading) && (
              <div className="p-3 text-xs text-gray-600 text-center">Loading…</div>
            )}
            {results.length === 0 && !searchQuery.isLoading && !browseQuery.isLoading && (
              <div className="p-3 text-xs text-gray-600 text-center">No results</div>
            )}
            {results.map((asset) => (
              <button
                key={asset.ticker}
                onClick={() => select(asset)}
                className={[
                  'w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/6 transition-colors cursor-pointer',
                  selected?.ticker === asset.ticker ? 'bg-violet-600/15' : '',
                ].join(' ')}
              >
                <div>
                  <span className="text-sm text-white font-medium">{asset.label}</span>
                </div>
                <span className="text-xs font-mono text-gray-500">{asset.ticker}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
