const TIMEFRAMES = [
  { value: '1d',  label: 'D' },
  { value: '1wk', label: 'W' },
  { value: '1mo', label: 'M' },
]

interface Props {
  selected:          string
  onChange:          (tf: string) => void
  lockedTimeframes?: string[]
}

export function TimeframeSelector({ selected, onChange, lockedTimeframes = [] }: Props) {
  return (
    <div className="flex items-center gap-1">
      {TIMEFRAMES.map((tf) => {
        const locked = lockedTimeframes.includes(tf.value)
        const isActive = selected === tf.value
        return (
          <button
            key={tf.value}
            onClick={() => onChange(tf.value)}
            className={[
              'flex items-center gap-1 rounded-lg text-[11px] font-bold tracking-wide transition-all cursor-pointer border',
              isActive
                ? 'bg-white/12 text-white border-white/20'
                : locked
                  ? 'text-gray-700 border-white/5 bg-white/2'
                  : 'text-gray-500 border-white/8 bg-white/4 hover:bg-white/8 hover:text-gray-200 hover:border-white/12',
            ].join(' ')}
            style={{ padding: '5px 10px' }}
          >
            {tf.label}
            {locked && <span className="text-[9px] leading-none opacity-50">🔒</span>}
          </button>
        )
      })}
    </div>
  )
}
