import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useGeoCountry } from '../hooks/useGeoCountry'
import { Logo } from './Logo'

interface Broker {
  id:             string
  name:           string
  logo_url:       string | null
  tagline:        string | null
  affiliate_link: string
  countries:      string[]
  display_order:  number
}

function LogoBox({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false)
  const initials = name.slice(0, 2).toUpperCase()

  if (!logoUrl || failed) {
    return (
      <div className="flex items-center justify-center shrink-0" style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <span className="text-[12px] font-bold text-violet-300">{initials}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center shrink-0 overflow-hidden" style={{ width: 44, height: 44, borderRadius: 10, background: '#fff', padding: 6 }}>
      <img src={logoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setFailed(true)} />
    </div>
  )
}

interface Props {
  onClose:         () => void
  onEnterBrokerId: () => void
  isAdmin?:        boolean
}

export function UnlockScreen({ onClose, onEnterBrokerId, isAdmin }: Props) {
  const country = useGeoCountry()
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('broker_partners')
      .select('*')
      .eq('active', true)
      .order('display_order')
      .then(({ data }) => {
        setBrokers(data ?? [])
        setLoading(false)
      })
  }, [])

  const sorted = [...brokers]
    .filter(b => isAdmin || !country || b.countries.length === 0 || b.countries.includes(country))
    .sort((a, b) => a.display_order - b.display_order)

  function openBroker(link: string) {
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ padding: 16 }}
    >
      <div
        className="w-full max-w-lg flex flex-col rounded-2xl"
        style={{
          background: 'linear-gradient(145deg, #12131e 0%, #0c0d16 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)',
          maxHeight: 'calc(100dvh - 32px)',
        }}
      >
        {/* Header */}
        <div className="shrink-0" style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <div className="flex items-center" style={{ gap: 8 }}>
              <Logo size={20} />
              <span className="text-[12px] font-bold text-white tracking-tight">Fintelligent</span>
              <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.14em', color: 'rgba(0,210,168,0.5)' }}>S&D</span>
            </div>
            <button onClick={onClose} className="text-gray-700 hover:text-gray-400 transition-colors cursor-pointer flex items-center justify-center" style={{ minWidth: 44, minHeight: 44, fontSize: 18 }}>✕</button>
          </div>

          <h2 className="text-[15px] font-bold text-white" style={{ marginBottom: 4 }}>Unlock Full Access</h2>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            Sign up with a broker partner and make a qualifying deposit — you'll get full Premium access at no extra cost.
          </p>
        </div>

        {/* How it works — compact inline steps on mobile, 3-col on larger screens */}
        <div className="shrink-0" style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center" style={{ gap: 6 }}>
            {[
              { n: '1', text: 'Open broker account' },
              { n: '2', text: 'Make a deposit' },
              { n: '3', text: 'Submit broker ID' },
            ].map(({ n, text }, i, arr) => (
              <>
                <div key={n} className="flex items-center" style={{ gap: 6, flex: 1 }}>
                  <div className="flex items-center justify-center shrink-0" style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                    <span className="text-[10px] font-bold text-violet-300">{n}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-tight">{text}</p>
                </div>
                {i < arr.length - 1 && <span className="text-gray-700 shrink-0" style={{ fontSize: 10 }}>→</span>}
              </>
            ))}
          </div>
        </div>

        {/* Broker list */}
        <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '12px 24px' }}>
          {loading && (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse rounded-xl" style={{ height: 68, background: 'rgba(255,255,255,0.03)' }} />
              ))}
            </div>
          )}
          {!loading && sorted.length === 0 && (
            <div className="flex items-center justify-center" style={{ padding: '32px 0' }}>
              <p className="text-[12px] text-gray-600 text-center">No broker partners available in your region right now.</p>
            </div>
          )}
          {!loading && sorted.map(broker => (
            <button
              key={broker.id}
              onClick={() => openBroker(broker.affiliate_link)}
              className="w-full flex items-center text-left cursor-pointer group transition-all"
              style={{
                gap: 14,
                padding: '14px 16px',
                marginBottom: 8,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(124,58,237,0.07)'
                e.currentTarget.style.border = '1px solid rgba(124,58,237,0.2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)'
              }}
            >
              <LogoBox name={broker.name} logoUrl={broker.logo_url} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center" style={{ gap: 8, marginBottom: 3 }}>
                  <span className="text-[13px] font-semibold text-gray-200">{broker.name}</span>
                  {isAdmin && country && !broker.countries.includes(country) && broker.countries.length > 0 && (
                    <span className="text-[10px] font-semibold" style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.15)' }}>
                      Outside your region
                    </span>
                  )}
                </div>
                {broker.tagline && (
                  <p className="text-[11px] text-gray-600">{broker.tagline}</p>
                )}
              </div>
              <span className="text-gray-600 text-[13px] shrink-0" style={{ transition: 'color 0.15s' }}>→</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0" style={{ padding: '4px 24px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-600">Already deposited?</p>
            <button
              onClick={() => { onClose(); onEnterBrokerId() }}
              className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 cursor-pointer transition-colors flex items-center"
              style={{ minHeight: 44, paddingLeft: 12 }}
            >
              Enter broker ID →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
