export type ZoneType = 'supply' | 'demand'
export type FormationPattern = 'RBD' | 'DBR' | 'RBR' | 'DBD'

export interface SDZone {
  zone_id: string
  asset: string
  timeframe: string
  zone_type: ZoneType
  proximal: number
  distal: number
  formed_at: string
  formation_pattern: FormationPattern
  strength_score: number
  touch_count: number
  is_fresh: boolean
  is_active: boolean
  impulse_size_atr: number
  base_candle_count: number
}

export interface ZoneDetectionResult {
  asset: string
  timeframe: string
  detected_at: string
  current_price: number
  atr_14: number
  supply_zones: SDZone[]
  demand_zones: SDZone[]
  total_zones: number
}

export interface OHLCVBar {
  time: number   // unix timestamp (seconds)
  open: number
  high: number
  low: number
  close: number
}
