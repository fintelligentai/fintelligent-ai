export type AssetCategory = 'crypto' | 'stocks' | 'commodities' | 'forex' | 'indices'

export interface Asset {
  ticker: string
  label: string
  category: AssetCategory
}

export interface TradeSignal {
  signal_type: 'BUY' | 'SELL'
  zone_id: string
  asset: string
  timeframe: string
  formation_pattern: string
  entry: number
  stop_loss: number
  take_profit: number
  risk_pips: number
  reward_pips: number
  signal_strength: number
  strength_label: 'Weak' | 'Moderate' | 'Strong' | 'Very Strong'
  zone_proximal: number
  zone_distal: number
  distance_to_entry: number
  distance_pct: number
  trend_aligned: 'aligned' | 'counter' | 'neutral'
}

export interface MACross {
  signal: 'golden_cross' | 'death_cross' | 'none'
  ma_fast: number
  ma_slow: number
  bars_since_cross: number
}

export interface TrendBias {
  bias: 'bullish' | 'bearish' | 'neutral'
  ma_50: number
  ma_200: number
  current_price: number
}

export interface SignalResult {
  asset: string
  timeframe: string
  computed_at: string
  current_price: number
  atr_14: number
  rr_ratio: number
  buy_signals: TradeSignal[]
  sell_signals: TradeSignal[]
  ma_cross?: MACross
  trend_bias?: TrendBias
}
