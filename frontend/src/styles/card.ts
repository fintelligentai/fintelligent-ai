import type { CSSProperties } from 'react'

// ── Neutral warm-red base (IPO Major, Insider cards, Zone cards) ────────────
export const cardBase: CSSProperties = {
  background:
    'radial-gradient(circle at 84% 10%, rgba(220,48,16,0.11) 0%, transparent 52%), ' +
    'linear-gradient(138deg, #1d0404 0%, #110101 60%, #0d0101 100%)',
  boxShadow: '0 2px 20px rgba(190,30,10,0.13), 0 1px 4px rgba(0,0,0,0.55)',
  border: '1px solid rgba(205,58,18,0.22)',
  borderRadius: '14px',
}

export const cardSelected: CSSProperties = {
  background:
    'radial-gradient(circle at 84% 10%, rgba(220,48,16,0.16) 0%, transparent 52%), ' +
    'linear-gradient(138deg, #230505 0%, #160202 60%, #0e0101 100%)',
  boxShadow:
    '0 0 0 1.5px rgba(210,62,20,0.55), ' +
    '0 4px 28px rgba(190,30,10,0.22), ' +
    '0 1px 4px rgba(0,0,0,0.6)',
  border: '1px solid rgba(210,65,22,0.55)',
  borderRadius: '14px',
}

// ── BUY signal card (green) ─────────────────────────────────────────────────
export const cardBuy: CSSProperties = {
  background:
    'radial-gradient(circle at 84% 10%, rgba(16,210,90,0.09) 0%, transparent 52%), ' +
    'linear-gradient(138deg, #04120a 0%, #020c05 60%, #010a04 100%)',
  boxShadow: '0 2px 20px rgba(10,185,70,0.10), 0 1px 4px rgba(0,0,0,0.55)',
  border: '1px solid rgba(22,195,80,0.20)',
  borderRadius: '14px',
}

export const cardBuySelected: CSSProperties = {
  background:
    'radial-gradient(circle at 84% 10%, rgba(16,210,90,0.15) 0%, transparent 52%), ' +
    'linear-gradient(138deg, #061808 0%, #041005 60%, #030d04 100%)',
  boxShadow:
    '0 0 0 1.5px rgba(22,195,80,0.55), ' +
    '0 4px 28px rgba(10,185,70,0.18), ' +
    '0 1px 4px rgba(0,0,0,0.6)',
  border: '1px solid rgba(22,195,80,0.55)',
  borderRadius: '14px',
}

// ── SELL signal card (red) ──────────────────────────────────────────────────
export const cardSell: CSSProperties = {
  background:
    'radial-gradient(circle at 84% 10%, rgba(220,40,20,0.10) 0%, transparent 52%), ' +
    'linear-gradient(138deg, #1a0303 0%, #0e0101 60%, #0a0101 100%)',
  boxShadow: '0 2px 20px rgba(190,25,10,0.12), 0 1px 4px rgba(0,0,0,0.55)',
  border: '1px solid rgba(200,40,18,0.22)',
  borderRadius: '14px',
}

export const cardSellSelected: CSSProperties = {
  background:
    'radial-gradient(circle at 84% 10%, rgba(220,40,20,0.16) 0%, transparent 52%), ' +
    'linear-gradient(138deg, #220303 0%, #150101 60%, #0e0101 100%)',
  boxShadow:
    '0 0 0 1.5px rgba(200,40,18,0.55), ' +
    '0 4px 28px rgba(190,25,10,0.22), ' +
    '0 1px 4px rgba(0,0,0,0.6)',
  border: '1px solid rgba(200,40,18,0.55)',
  borderRadius: '14px',
}

// ── IPO Notable card (amber/orange) ────────────────────────────────────────
export const cardNotable: CSSProperties = {
  background:
    'radial-gradient(circle at 84% 10%, rgba(220,130,18,0.10) 0%, transparent 52%), ' +
    'linear-gradient(138deg, #1a0d02 0%, #110801 60%, #0c0601 100%)',
  boxShadow: '0 2px 20px rgba(180,100,10,0.12), 0 1px 4px rgba(0,0,0,0.55)',
  border: '1px solid rgba(200,120,20,0.22)',
  borderRadius: '14px',
}

// ── IPO Standard card (neutral dark) ───────────────────────────────────────
export const cardStandard: CSSProperties = {
  background:
    'radial-gradient(circle at 84% 10%, rgba(80,80,95,0.07) 0%, transparent 52%), ' +
    'linear-gradient(138deg, #111118 0%, #0c0c12 60%, #09090f 100%)',
  boxShadow: '0 2px 16px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.50)',
  border: '1px solid rgba(150,150,175,0.11)',
  borderRadius: '14px',
}

// ── Shared typography & divider helpers ────────────────────────────────────
export const WARM_LABEL     = 'text-[10px] uppercase tracking-widest font-medium'
export const WARM_LABEL_COLOR = 'rgba(255,175,100,0.38)'

export const DIVIDER: CSSProperties = {
  height:     '1px',
  background: 'rgba(200,68,24,0.13)',
  margin:     '12px 0',
}
