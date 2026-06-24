import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  ColorType,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import type { OHLCVBar, ZoneDetectionResult } from '../types/zone'

interface Props {
  bars: OHLCVBar[]
  zones: ZoneDetectionResult | undefined
  htfZones: ZoneDetectionResult | undefined
  selectedZoneId: string | null
}

// Primary timeframe colors
const SUPPLY_FILL      = 'rgba(239, 68, 68, 0.08)'
const SUPPLY_FILL_SEL  = 'rgba(239, 68, 68, 0.22)'
const SUPPLY_LINE      = 'rgba(239, 68, 68, 0.55)'
const SUPPLY_LINE_SEL  = 'rgba(239, 68, 68, 0.95)'
const DEMAND_FILL      = 'rgba(16, 185, 129, 0.08)'
const DEMAND_FILL_SEL  = 'rgba(16, 185, 129, 0.22)'
const DEMAND_LINE      = 'rgba(16, 185, 129, 0.55)'
const DEMAND_LINE_SEL  = 'rgba(16, 185, 129, 0.95)'

// Higher timeframe colors (violet/purple — drawn behind primary zones)
const HTF_SUPPLY_FILL  = 'rgba(168, 85, 247, 0.07)'
const HTF_SUPPLY_LINE  = 'rgba(168, 85, 247, 0.50)'
const HTF_DEMAND_FILL  = 'rgba(99, 102, 241, 0.07)'
const HTF_DEMAND_LINE  = 'rgba(99, 102, 241, 0.50)'

export function PriceChart({ bars, zones, htfZones, selectedZoneId }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const chartRef        = useRef<IChartApi | null>(null)
  const candleRef       = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const overlayRef      = useRef<HTMLCanvasElement | null>(null)

  // Keep latest values accessible from stable callbacks
  const zonesRef        = useRef(zones)
  const htfZonesRef     = useRef(htfZones)
  const selectedZoneRef = useRef(selectedZoneId)
  const barsRef         = useRef(bars)
  zonesRef.current        = zones
  htfZonesRef.current     = htfZones
  selectedZoneRef.current = selectedZoneId
  barsRef.current         = bars

  function drawZoneLayer(
    ctx: CanvasRenderingContext2D,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick'>,
    allZones: Array<{ zone_type: string; proximal: number; distal: number; zone_id: string; formed_at?: string }>,
    fill: (isSupply: boolean, isSelected: boolean) => string,
    line: (isSupply: boolean, isSelected: boolean) => string,
    selId: string | null,
    dpr: number,
    canvasWidth: number,
    showMarkers: boolean,
  ) {
    for (const zone of allZones) {
      const isSupply   = zone.zone_type === 'supply'
      const isSelected = zone.zone_id === selId

      const y1 = series.priceToCoordinate(zone.proximal)
      const y2 = series.priceToCoordinate(zone.distal)
      if (y1 == null || y2 == null) continue

      const top    = Math.min(y1, y2) * dpr
      const bottom = Math.max(y1, y2) * dpr
      const height = Math.max(bottom - top, 1)

      ctx.fillStyle = fill(isSupply, isSelected)
      ctx.fillRect(0, top, canvasWidth, height)

      ctx.strokeStyle = line(isSupply, isSelected)
      ctx.lineWidth   = (isSelected ? 1.5 : 1) * dpr
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(0, y1 * dpr)
      ctx.lineTo(canvasWidth, y1 * dpr)
      ctx.stroke()

      ctx.setLineDash([4 * dpr, 4 * dpr])
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.moveTo(0, y2 * dpr)
      ctx.lineTo(canvasWidth, y2 * dpr)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.setLineDash([])

      // Formation marker — triangle + stem at the bar where the zone was created
      if (showMarkers && zone.formed_at) {
        const formedTs = Math.floor(new Date(zone.formed_at).getTime() / 1000)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const x = chart.timeScale().timeToCoordinate(formedTs as any)
        if (x != null) {
          const px        = x * dpr
          const py        = y1 * dpr
          const size      = 9 * dpr
          const stemLen   = 14 * dpr
          const markerColor = line(isSupply, isSelected)
          ctx.setLineDash([])
          ctx.globalAlpha = isSelected ? 1.0 : 0.85

          // Stem line from proximal edge outward
          ctx.strokeStyle = markerColor
          ctx.lineWidth   = 1.5 * dpr
          ctx.beginPath()
          if (isSupply) {
            ctx.moveTo(px, py)
            ctx.lineTo(px, py + stemLen)
          } else {
            ctx.moveTo(px, py)
            ctx.lineTo(px, py - stemLen)
          }
          ctx.stroke()

          // Filled triangle at stem tip
          ctx.fillStyle = markerColor
          ctx.beginPath()
          if (isSupply) {
            const tip = py + stemLen
            ctx.moveTo(px,           tip + size * 0.8)
            ctx.lineTo(px - size,    tip)
            ctx.lineTo(px + size,    tip)
          } else {
            const tip = py - stemLen
            ctx.moveTo(px,           tip - size * 0.8)
            ctx.lineTo(px - size,    tip)
            ctx.lineTo(px + size,    tip)
          }
          ctx.closePath()
          ctx.fill()

          ctx.globalAlpha = 1
        }
      }
    }
  }

  function drawZones() {
    const canvas = overlayRef.current
    const series = candleRef.current
    if (!canvas || !series) return

    const dpr = window.devicePixelRatio || 1
    const ctx  = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const selId = selectedZoneRef.current
    const htf   = htfZonesRef.current
    const z     = zonesRef.current

    const chart = chartRef.current
    if (!chart) return

    // Draw HTF zones first (behind primary) — no formation markers on HTF
    if (htf) {
      const htfAll = [...htf.supply_zones, ...htf.demand_zones]
      drawZoneLayer(
        ctx, chart, series, htfAll,
        (isSupply) => isSupply ? HTF_SUPPLY_FILL : HTF_DEMAND_FILL,
        (isSupply) => isSupply ? HTF_SUPPLY_LINE : HTF_DEMAND_LINE,
        null, dpr, canvas.width, false,
      )
    }

    // Draw primary zones on top — with formation markers
    if (z) {
      const allZones = [...z.supply_zones, ...z.demand_zones]
      drawZoneLayer(
        ctx, chart, series, allZones,
        (isSupply, isSel) => isSel ? (isSupply ? SUPPLY_FILL_SEL : DEMAND_FILL_SEL) : (isSupply ? SUPPLY_FILL : DEMAND_FILL),
        (isSupply, isSel) => isSel ? (isSupply ? SUPPLY_LINE_SEL : DEMAND_LINE_SEL) : (isSupply ? SUPPLY_LINE : DEMAND_LINE),
        selId, dpr, canvas.width, true,
      )
    }
  }

  function syncCanvas() {
    const container = containerRef.current
    const canvas    = overlayRef.current
    if (!container || !canvas) return
    const dpr = window.devicePixelRatio || 1
    const w   = container.clientWidth
    const h   = container.clientHeight
    canvas.width        = w * dpr
    canvas.height       = h * dpr
    canvas.style.width  = `${w}px`
    canvas.style.height = `${h}px`
    drawZones()
  }

  // Init chart once — canvas is created programmatically AFTER chart init
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width === 0 || height === 0) return

      if (!chartRef.current) {
        const chart = createChart(container, {
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#6b7280',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.04)' },
            horzLines: { color: 'rgba(255,255,255,0.04)' },
          },
          crosshair: { vertLine: { labelVisible: false } },
          rightPriceScale: {
            mode: PriceScaleMode.Normal,
            borderColor: 'rgba(255,255,255,0.08)',
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.08)',
            timeVisible: true,
            secondsVisible: false,
          },
          width,
          height,
        })

        const candles = chart.addSeries(CandlestickSeries, {
          upColor:         '#10b981',
          downColor:       '#ef4444',
          borderUpColor:   '#10b981',
          borderDownColor: '#ef4444',
          wickUpColor:     '#10b981',
          wickDownColor:   '#ef4444',
        })

        chartRef.current  = chart
        candleRef.current = candles

        // Load any bars that arrived before the chart was ready
        if (barsRef.current.length > 0) {
          candles.setData(barsRef.current as never)
          chart.timeScale().fitContent()
        }

        // Create overlay canvas and append AFTER chart is set up
        const canvas = document.createElement('canvas')
        canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:10;'
        container.style.position = 'relative'
        container.appendChild(canvas)
        overlayRef.current = canvas

        chart.timeScale().subscribeVisibleLogicalRangeChange(() => syncCanvas())
      } else {
        chartRef.current.applyOptions({ width, height })
      }

      syncCanvas()
    })

    observer.observe(container)
    return () => {
      observer.disconnect()
      if (overlayRef.current) {
        overlayRef.current.remove()
        overlayRef.current = null
      }
      chartRef.current?.remove()
      chartRef.current  = null
      candleRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update candles
  useEffect(() => {
    if (!candleRef.current || !bars.length) return
    candleRef.current.setData(bars as never)
    chartRef.current?.timeScale().fitContent()
    syncCanvas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars])

  // Redraw zones on change
  useEffect(() => {
    syncCanvas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, htfZones, selectedZoneId])

  return <div ref={containerRef} className="w-full h-full" />
}
