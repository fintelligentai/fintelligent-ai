import type { MACross } from '../types/asset'

interface Props {
  maCross:   MACross | undefined
  timeframe: string
  ticker:    string
}

const MAX_BARS = 20

export function MACrossBadge({ maCross, timeframe, ticker }: Props) {
  // Only meaningful on daily; hide if stale
  if (timeframe !== '1d') return null
  if (!maCross || maCross.signal === 'none') return null
  if (maCross.bars_since_cross > MAX_BARS) return null

  const isGolden = maCross.signal === 'golden_cross'
  const icon     = isGolden ? '☀' : '☽'
  const color    = isGolden
    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
    : 'bg-red-500/15 border-red-500/40 text-red-400'

  const daysAgo  = maCross.bars_since_cross === 0 ? 'today' : `${maCross.bars_since_cross}d ago`
  const label    = isGolden ? 'Golden Cross' : 'Death Cross'

  const tooltip =
    `MA50: ${maCross.ma_fast.toLocaleString(undefined, { maximumFractionDigits: 2 })}  ·  ` +
    `MA200: ${maCross.ma_slow.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

  return (
    <div
      title={tooltip}
      className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold cursor-default shrink-0 ${color}`}
    >
      <span>{icon}</span>
      <span>{ticker} {label} {daysAgo}</span>
    </div>
  )
}
