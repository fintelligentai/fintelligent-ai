import { useState, useCallback } from 'react'
import type { Asset } from '../types/asset'

const KEY = 'fintelligent_watchlist'

function load(): Asset[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(list: Asset[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<Asset[]>(load)

  const add = useCallback((asset: Asset) => {
    setWatchlist((prev) => {
      if (prev.some((a) => a.ticker === asset.ticker)) return prev
      const next = [...prev, asset]
      save(next)
      return next
    })
  }, [])

  const remove = useCallback((ticker: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((a) => a.ticker !== ticker)
      save(next)
      return next
    })
  }, [])

  const toggle = useCallback((asset: Asset) => {
    setWatchlist((prev) => {
      const exists = prev.some((a) => a.ticker === asset.ticker)
      const next   = exists ? prev.filter((a) => a.ticker !== asset.ticker) : [...prev, asset]
      save(next)
      return next
    })
  }, [])

  const isPinned = useCallback(
    (ticker: string) => watchlist.some((a) => a.ticker === ticker),
    [watchlist],
  )

  return { watchlist, add, remove, toggle, isPinned }
}
