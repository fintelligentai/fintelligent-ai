export interface ZoneFilterState {
  minStrength: number
  zoneType: 'all' | 'supply' | 'demand'
  freshOnly: boolean
}

interface Props {
  filters: ZoneFilterState
  onChange: (f: ZoneFilterState) => void
  totalVisible: number
  totalAll: number
}

export function ZoneFilters({ filters, onChange, totalVisible, totalAll }: Props) {
  const set = (patch: Partial<ZoneFilterState>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex flex-col gap-4 pb-4 mb-2 border-b border-white/6">
      {/* Zone type toggle */}
      <div className="flex gap-1.5 mt-3">
        {(['all', 'supply', 'demand'] as const).map((t) => (
          <button
            key={t}
            onClick={() => set({ zoneType: t })}
            className={[
              'flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] transition-colors cursor-pointer',
              filters.zoneType === t
                ? t === 'supply'
                  ? 'bg-red-500/22 text-red-300 border border-red-500/30'
                  : t === 'demand'
                  ? 'bg-emerald-500/22 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/12 text-white border border-white/20'
                : 'bg-white/4 text-gray-600 border border-white/6 hover:bg-white/8 hover:text-gray-400',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Min strength slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">Min strength</span>
          <span className="text-[11px] font-mono text-gray-400">{filters.minStrength || '—'}</span>
        </div>
        <input
          type="range"
          min={0} max={90} step={5}
          value={filters.minStrength}
          onChange={(e) => set({ minStrength: Number(e.target.value) })}
          className="w-full h-1 rounded-full appearance-none bg-white/8 accent-violet-500 cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-gray-700 mt-1.5 tracking-wide">
          <span>0</span>
          <span>90</span>
        </div>
      </div>

      {/* Fresh only */}
      <label className="flex items-center justify-between cursor-pointer select-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">Fresh zones only</span>
        <button
          role="switch"
          aria-checked={filters.freshOnly}
          onClick={() => set({ freshOnly: !filters.freshOnly })}
          className={['relative w-8 h-4 rounded-full transition-colors', filters.freshOnly ? 'bg-violet-600' : 'bg-white/12'].join(' ')}
        >
          <span className={['absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm',
            filters.freshOnly ? 'translate-x-4' : 'translate-x-0'].join(' ')} />
        </button>
      </label>

      {/* Count */}
      <div className="text-[10px] text-gray-700 tracking-wide">
        Showing <span className="text-gray-500">{totalVisible}</span> of {totalAll} zones
      </div>
    </div>
  )
}
