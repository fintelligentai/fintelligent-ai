import axios from 'axios'
import type { ZoneDetectionResult } from '../types/zone'
import type { Asset, AssetCategory, SignalResult } from '../types/asset'

const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1'
const http = axios.create({ baseURL: BASE })

export async function fetchZones(asset: string, timeframe = '1d'): Promise<ZoneDetectionResult> {
  const { data } = await http.get<ZoneDetectionResult>(`/zones/${encodeURIComponent(asset)}`, {
    params: { timeframe },
  })
  return data
}

export async function fetchOHLCV(asset: string, timeframe = '1d') {
  const { data } = await http.get(`/ohlcv/${encodeURIComponent(asset)}`, { params: { timeframe } })
  return data
}

export async function fetchSignals(asset: string, timeframe = '1d', rr = 2): Promise<SignalResult> {
  const { data } = await http.get<SignalResult>(`/signals/${encodeURIComponent(asset)}`, {
    params: { timeframe, rr },
  })
  return data
}

export async function searchAssets(q: string, category?: AssetCategory): Promise<Asset[]> {
  const { data } = await http.get<Asset[]>('/assets/search', {
    params: { q, ...(category ? { category } : {}) },
  })
  return data
}

export async function listAssets(category?: AssetCategory): Promise<Asset[]> {
  const { data } = await http.get<Asset[]>('/assets', {
    params: category ? { category } : {},
  })
  return data
}

export interface ScanHit {
  asset: string
  label: string
  category: AssetCategory
  signal_type: 'BUY' | 'SELL'
  formation_pattern: string
  entry: number
  stop_loss: number
  take_profit: number
  signal_strength: number
  strength_label: string
  distance_pct: number
  score: number
}

export interface ScannerResult {
  results: ScanHit[]
  total: number
  status: {
    scanning: boolean
    last_scan_at: string | null
    assets_scanned: number
    total_assets: number
    errors: number
  }
}

export interface CommentaryResult {
  ticker:       string
  timeframe:    string
  commentary:   string
  generated_at: string | null
  cached:       boolean
}

export interface PatternStat {
  hit_rate: number | null
  holds:    number
  breaks:   number
  n:        number
}

export interface BacktestResult {
  ticker:           string
  timeframe:        string
  lookforward_bars: number
  methodology:      string
  patterns:         Record<string, PatternStat>
}

export async function fetchBacktest(asset: string, timeframe = '1d'): Promise<BacktestResult> {
  const { data } = await http.get<BacktestResult>(`/backtest/${encodeURIComponent(asset)}`, {
    params: { timeframe },
  })
  return data
}

export async function fetchCommentary(asset: string, timeframe = '1d'): Promise<CommentaryResult> {
  const { data } = await http.get<CommentaryResult>(`/commentary/${encodeURIComponent(asset)}`, {
    params: { timeframe },
  })
  return data
}

export interface InsiderTrade {
  ticker:             string
  company:            string
  insider_name:       string
  role:               string
  trade_type:         string   // "Buy" | "Sell"
  shares:             number | null
  price:              number | null
  value:              number | null
  acquired_disposed:  string   // "Acquired" | "Disposed"
  traded_date:        string
  filed_date:         string
  shares_after:       number | null
}

export interface InsiderDetail {
  name:              string
  role:              string
  trade_type:        string
  shares:            number
  value:             number
  value_fmt:         string
  pct_of_holdings:   number | null
}

export interface InsiderVerdict {
  verdict:         'significant_buying' | 'significant_selling' | 'mixed' | 'none'
  summary:         string
  buy_value:       number
  sell_value:      number
  buy_insiders:    number
  sell_insiders:   number
  days:            number
  buyer_details:   InsiderDetail[]
  seller_details:  InsiderDetail[]
}

export interface NewsArticle {
  title:        string
  publisher:    string
  url:          string
  published_at: string
}

export interface InsiderSignal {
  ticker:          string
  company:         string
  verdict:         InsiderVerdict['verdict']
  summary:         string
  buy_value:       number
  sell_value:      number
  buy_insiders:    number
  sell_insiders:   number
  days:            number
  buyer_details?:  InsiderDetail[]
  seller_details?: InsiderDetail[]
}

export interface InsiderTradesResult {
  trades:     InsiderTrade[]
  verdict?:   InsiderVerdict
  exchange?:  string | null
  total:      number
  fetched_at: string
  ticker?:    string
  error?:     string
}

export interface SignificantActivityResult {
  signals:    InsiderSignal[]
  total:      number
  fetched_at: string
}

export async function fetchInsiderTrades(limit = 100): Promise<InsiderTradesResult> {
  const { data } = await http.get<InsiderTradesResult>('/insider-trades', { params: { limit } })
  return data
}

export async function fetchInsiderTradesForTicker(ticker: string, limit = 30): Promise<InsiderTradesResult> {
  const { data } = await http.get<InsiderTradesResult>(`/insider-trades/${encodeURIComponent(ticker)}`, { params: { limit } })
  return data
}

export async function fetchSignificantInsiderActivity(limit = 50): Promise<SignificantActivityResult> {
  const { data } = await http.get<SignificantActivityResult>('/insider-trades/significant', { params: { limit } })
  return data
}

export async function fetchInsiderNews(ticker: string, limit = 5): Promise<{ ticker: string; articles: NewsArticle[] }> {
  const { data } = await http.get(`/insider-trades/${encodeURIComponent(ticker)}/news`, { params: { limit } })
  return data
}

export interface IPOEntry {
  deal_id:          string
  ticker:           string
  company:          string
  exchange:         string
  price_range:      string
  shares_offered:   string
  deal_value:       number
  deal_value_fmt:   string
  date:             string
  status:           'upcoming' | 'priced' | 'filed'
  tier:             'major' | 'notable' | 'standard'
  label:            string
  icon:             string
  impact:           string
}

export interface IPOCalendarResult {
  upcoming:   IPOEntry[]
  priced:     IPOEntry[]
  filed:      IPOEntry[]
  month:      string
  year:       string
  fetched_at: string
}

export async function fetchIPOCalendar(): Promise<IPOCalendarResult> {
  const { data } = await http.get<IPOCalendarResult>('/ipo-calendar')
  return data
}

export interface PoliticalTrade {
  chamber:        string
  politician:     string
  party:          string
  state:          string
  ticker:         string
  asset_name:     string
  trade_type:     string
  amount:         string
  traded_date:    string
  disclosed_date: string
  sector:         string
  industry:       string
}

export interface PoliticalTradesResult {
  trades:     PoliticalTrade[]
  total:      number
  fetched_at: string
  ticker?:    string
}

export async function fetchPoliticalTrades(limit = 200): Promise<PoliticalTradesResult> {
  const { data } = await http.get<PoliticalTradesResult>('/political-trades', { params: { limit } })
  return data
}

export async function fetchPoliticalTradesForTicker(ticker: string, limit = 50): Promise<PoliticalTradesResult> {
  const { data } = await http.get<PoliticalTradesResult>(`/political-trades/${encodeURIComponent(ticker)}`, { params: { limit } })
  return data
}

export interface MacroImpact {
  label: string
  ticker: string
  direction: 'bullish' | 'bearish' | 'watch'
  reason: string
}

export interface MacroEvent {
  title: string
  source: string
  url: string
  published_at: string
  direction_hint: string
  impacts: MacroImpact[]
}

export interface MacroEventsResult {
  events: MacroEvent[]
  fetched_at: string
  error: string | null
}

export async function fetchMacroEvents(limit = 15): Promise<MacroEventsResult> {
  const { data } = await http.get<MacroEventsResult>('/macro-events', { params: { limit } })
  return data
}

export async function fetchScannerResults(
  category?: string,
  signal_type?: string,
): Promise<ScannerResult> {
  const { data } = await http.get<ScannerResult>('/scanner/results', {
    params: {
      ...(category    ? { category }    : {}),
      ...(signal_type ? { signal_type } : {}),
      limit: 50,
    },
  })
  return data
}
