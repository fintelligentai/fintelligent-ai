import { useEffect, useRef, useState } from 'react'
import type { ZoneDetectionResult } from '../types/zone'

export type AlertPermission = 'default' | 'granted' | 'denied'

export function useZoneAlerts(data: ZoneDetectionResult | undefined, enabled: boolean) {
  const [permission, setPermission] = useState<AlertPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  // Track zone IDs we've already alerted this session to avoid spam
  const alertedRef = useRef<Set<string>>(new Set())

  async function requestPermission() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  useEffect(() => {
    if (!enabled || !data || permission !== 'granted') return

    const { current_price, atr_14, supply_zones, demand_zones, asset } = data
    const allZones = [...supply_zones, ...demand_zones]

    for (const zone of allZones) {
      const top    = Math.max(zone.proximal, zone.distal)
      const bottom = Math.min(zone.proximal, zone.distal)
      const isSupply = zone.zone_type === 'supply'

      const inZone      = current_price >= bottom && current_price <= top
      const approaching = isSupply
        ? current_price >= top - atr_14 && current_price < top       // approaching supply from below
        : current_price <= bottom + atr_14 && current_price > bottom  // approaching demand from above

      const alertKey = inZone
        ? `in:${zone.zone_id}`
        : approaching
        ? `near:${zone.zone_id}`
        : null

      if (!alertKey || alertedRef.current.has(alertKey)) continue
      alertedRef.current.add(alertKey)

      const zoneLabel  = isSupply ? 'Supply' : 'Demand'
      const priceRange = `${zone.proximal.toLocaleString(undefined, { maximumFractionDigits: 2 })} – ${zone.distal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

      const title = inZone
        ? `${asset} entered ${zoneLabel} Zone`
        : `${asset} approaching ${zoneLabel} Zone`
      const body = inZone
        ? `Price ${current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })} is inside zone ${priceRange} (${zone.formation_pattern})`
        : `Price ${current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })} is within 1 ATR of zone ${priceRange} (${zone.formation_pattern})`

      new Notification(title, {
        body,
        icon: '/favicon.svg',
        tag: alertKey,
      })
    }
  }, [data, enabled, permission])

  // Reset alerted zones when asset changes
  useEffect(() => {
    alertedRef.current.clear()
  }, [data?.asset])

  return { permission, requestPermission }
}
