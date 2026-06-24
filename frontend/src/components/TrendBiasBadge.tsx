import type { TrendBias } from '../types/asset'

interface Props {
  trendBias: TrendBias | undefined
  ticker: string
}

export function TrendBiasBadge({ trendBias, ticker }: Props) {
  if (!trendBias) return null

  const { bias, ma_50, ma_200 } = trendBias

  const config = {
    bullish: {
      label: 'Bullish',
      icon: '▲',
      bg: 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.35)',
      text: '#34d399',
      glow: '0 0 10px rgba(16,185,129,0.18)',
    },
    bearish: {
      label: 'Bearish',
      icon: '▼',
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.35)',
      text: '#f87171',
      glow: '0 0 10px rgba(239,68,68,0.18)',
    },
    neutral: {
      label: 'Neutral',
      icon: '◆',
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.30)',
      text: '#fbbf24',
      glow: '0 0 10px rgba(245,158,11,0.14)',
    },
  }[bias]

  const fmt = (n: number) =>
    n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n.toFixed(4)

  const tooltip = `MA50: ${fmt(ma_50)}  ·  MA200: ${fmt(ma_200)}`

  return (
    <div
      title={tooltip}
      className="flex items-center gap-1.5 shrink-0 cursor-default select-none"
      style={{
        padding: '4px 10px',
        borderRadius: 8,
        background: config.bg,
        border: `1px solid ${config.border}`,
        boxShadow: config.glow,
      }}
    >
      <span style={{ fontSize: 9, color: config.text }}>{config.icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: config.text, letterSpacing: '0.04em' }}>
        {ticker} {config.label}
      </span>
    </div>
  )
}
