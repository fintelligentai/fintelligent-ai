import { useState, useRef, useEffect, useCallback } from 'react'

interface TooltipPos {
  top:  number
  left: number
  translateUp: boolean
}

interface UseTooltipOptions {
  width?: number   // tooltip width in px, used to clamp to viewport
}

export function useTooltip({ width = 288 }: UseTooltipOptions = {}) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos]         = useState<TooltipPos>({ top: 0, left: 0, translateUp: true })
  const triggerRef            = useRef<HTMLSpanElement>(null)

  const open = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()

    // Clamp left so tooltip stays inside viewport
    let left = r.left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
    if (left < 8) left = 8

    const spaceAbove = r.top
    const translateUp = spaceAbove > 160

    setPos({
      top: translateUp ? r.top - 8 : r.bottom + 8,
      left,
      translateUp,
    })
    setVisible(true)
  }, [width])

  const close = useCallback(() => setVisible(false), [])

  const toggle = useCallback(() => {
    if (visible) close()
    else open()
  }, [visible, open, close])

  // Close on scroll or resize
  useEffect(() => {
    if (!visible) return
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [visible, close])

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!visible) return
    const onTouchOutside = (e: TouchEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('touchstart', onTouchOutside)
    return () => document.removeEventListener('touchstart', onTouchOutside)
  }, [visible, close])

  // Desktop: hover handlers
  const hoverProps = {
    onMouseEnter: open,
    onMouseLeave: close,
  }

  // Mobile: tap handler (prevents ghost click)
  const tapProps = {
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault()
      toggle()
    },
  }

  const tooltipStyle: React.CSSProperties = {
    position:  'fixed',
    top:       pos.top,
    left:      pos.left,
    width,
    transform: pos.translateUp ? 'translateY(-100%)' : 'none',
    zIndex:    99999,
  }

  return {
    triggerRef,
    visible,
    open,
    close,
    hoverProps,
    tapProps,
    tooltipStyle,
  }
}
