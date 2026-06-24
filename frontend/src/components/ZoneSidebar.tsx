import type { SDZone, ZoneDetectionResult } from '../types/zone'
import type { PatternStat } from '../api/client'
import { ZoneFilters, type ZoneFilterState } from './ZoneFilters'
import { WinRateBadge } from './WinRateBadge'
import { cardBuy, cardBuySelected, cardSell, cardSellSelected, DIVIDER, WARM_LABEL, WARM_LABEL_COLOR } from '../styles/card'

interface Props {
  data: ZoneDetectionResult | undefined
  isLoading: boolean
  selectedZoneId: string | null
  onSelectZone: (id: string | null) => void
  filters: ZoneFilterState
  onFiltersChange: (f: ZoneFilterState) => void
  patternStats?: Record<string, PatternStat>
  patternStatsLoading?: boolean
}

function ZoneCard({ zone, selected, onClick, patternStats, patternStatsLoading }: {
  zone: SDZone
  selected: boolean
  onClick: () => void
  patternStats?: Record<string, PatternStat>
  patternStatsLoading?: boolean
}) {
  const isSupply = zone.zone_type === 'supply'

  return (
    <button
      onClick={onClick}
      className="w-full text-left transition-all cursor-pointer"
      style={{ ...(isSupply ? (selected ? cardSellSelected : cardSell) : (selected ? cardBuySelected : cardBuy)), padding: '14px' }}
    >
      {/* Zone type + pattern + fresh */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: isSupply ? 'rgba(248,113,113,0.80)' : 'rgba(52,211,153,0.80)' }}
        >
          {zone.zone_type} · {zone.formation_pattern}
        </span>
        <span className="text-[10px]" style={{ color: WARM_LABEL_COLOR }}>
          {zone.is_fresh ? '✦ fresh' : `${zone.touch_count}×`}
        </span>
      </div>

      {/* Dominant: price range */}
      <div className="mb-3">
        <div className={WARM_LABEL} style={{ color: WARM_LABEL_COLOR, marginBottom: 2 }}>Range</div>
        <div className="text-[14px] font-mono font-semibold text-white leading-snug">
          {zone.proximal.toLocaleString(undefined, { maximumFractionDigits: 5 })}
          <span style={{ color: WARM_LABEL_COLOR }}> – </span>
          {zone.distal.toLocaleString(undefined, { maximumFractionDigits: 5 })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ ...DIVIDER, margin: '8px 0' }} />

      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,100,40,0.10)' }}>
          <div
            className="h-1 rounded-full transition-all"
            style={{
              width: `${zone.strength_score}%`,
              background: isSupply ? 'rgba(239,68,68,0.75)' : 'rgba(52,211,153,0.75)',
            }}
          />
        </div>
        <span className="text-[10px] font-mono shrink-0" style={{ color: WARM_LABEL_COLOR }}>
          {zone.strength_score}
        </span>
      </div>

      <WinRateBadge
        pattern={zone.formation_pattern}
        stat={patternStats?.[zone.formation_pattern]}
        isLoading={patternStatsLoading ?? false}
      />
    </button>
  )
}

function applyFilters(zones: SDZone[], filters: ZoneFilterState): SDZone[] {
  return zones.filter((z) => {
    if (filters.zoneType !== 'all' && z.zone_type !== filters.zoneType) return false
    if (z.strength_score < filters.minStrength) return false
    if (filters.freshOnly && !z.is_fresh) return false
    return true
  })
}

export function ZoneSidebar({ data, isLoading, selectedZoneId, onSelectZone, filters, onFiltersChange, patternStats, patternStatsLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl animate-pulse"
            style={{ background: 'rgba(25,4,4,0.5)', border: '1px solid rgba(200,55,18,0.10)' }} />
        ))}
      </div>
    )
  }

  if (!data) return null

  const allZones = [
    ...data.supply_zones,
    ...data.demand_zones,
  ].sort((a, b) => b.strength_score - a.strength_score)

  const visible = applyFilters(allZones, filters)

  return (
    <div className="flex flex-col gap-2">
      <ZoneFilters
        filters={filters}
        onChange={onFiltersChange}
        totalVisible={visible.length}
        totalAll={allZones.length}
      />
      {visible.length === 0 && (
        <div className="text-xs text-gray-600 text-center py-6">
          No zones match the current filters
        </div>
      )}
      {visible.map((zone) => (
        <ZoneCard
          key={zone.zone_id}
          zone={zone}
          selected={selectedZoneId === zone.zone_id}
          onClick={() => onSelectZone(selectedZoneId === zone.zone_id ? null : zone.zone_id)}
          patternStats={patternStats}
          patternStatsLoading={patternStatsLoading}
        />
      ))}
    </div>
  )
}
