import { createPortal } from 'react-dom'
import { useTooltip } from '../hooks/useTooltip'
import type { PatternStat } from '../api/client'

interface Props {
  pattern:   string
  stat:      PatternStat | undefined
  isLoading: boolean
}

const METHODOLOGY =
  'A test is counted when price enters the zone after it forms. ' +
  '"Respected" means no bar closed beyond the distal level within the next 10 bars after test entry. ' +
  '"Broken" means at least one bar closed beyond it. ' +
  'Tests with fewer than 10 bars of data remaining are excluded entirely ' +
  'to avoid inflating the hold rate with incomplete observations.'

export function WinRateBadge({ pattern, stat, isLoading }: Props) {
  const { triggerRef, visible, hoverProps, tapProps, tooltipStyle } = useTooltip({ width: 288 })

  if (isLoading) {
    return <div className="h-3 w-24 rounded bg-white/5 animate-pulse mt-1" />
  }

  if (!stat || stat.n === 0) return null

  const pct   = stat.hit_rate != null ? Math.round(stat.hit_rate * 100) : null
  const color = pct == null ? 'text-gray-600'
              : pct >= 70   ? 'text-emerald-400'
              : pct >= 50   ? 'text-amber-400'
              :               'text-red-400'

  return (
    <div className="inline-flex items-center gap-1 mt-1">
      <span className={`text-xs font-mono ${color}`}>
        {pct != null ? `${pct}%` : '—'}
      </span>
      <span className="text-xs text-gray-600">held ≥10 bars after test</span>
      <span className="text-xs text-gray-700">(n={stat.n})</span>

      <span
        ref={triggerRef}
        {...hoverProps}
        {...tapProps}
        className="text-gray-600 hover:text-gray-400 cursor-help text-xs leading-none select-none"
      >
        ⓘ
      </span>

      {visible && createPortal(
        <div
          className="bg-[#1a1b26] border border-white/15 rounded-lg p-3 shadow-2xl pointer-events-none"
          style={tooltipStyle}
        >
          <p className="text-xs text-gray-400 leading-relaxed">{METHODOLOGY}</p>
          <p className="text-xs text-gray-600 mt-2">
            Pattern: <span className="text-gray-300">{pattern}</span>
            {' · '}Holds: <span className="text-emerald-400">{stat.holds}</span>
            {' · '}Breaks: <span className="text-red-400">{stat.breaks}</span>
          </p>
        </div>,
        document.body,
      )}
    </div>
  )
}
