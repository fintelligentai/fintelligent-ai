import { useEffect, useState } from 'react'

const CACHE_KEY = 'fintelligent_geo_country'

export function useGeoCountry() {
  const [country, setCountry] = useState<string | null>(() => {
    return sessionStorage.getItem(CACHE_KEY)
  })

  useEffect(() => {
    if (country) return
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => {
        const code = d?.country_code ?? null
        if (code) {
          sessionStorage.setItem(CACHE_KEY, code)
          setCountry(code)
        }
      })
      .catch(() => {})
  }, [])

  return country
}
