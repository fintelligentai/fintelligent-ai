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
      <div className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 9, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <span className="text-[11px] font-bold text-violet-300">{initials}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center shrink-0 overflow-hidden" style={{ width: 40, height: 40, borderRadius: 9, background: '#fff', padding: 5 }}>
      <img src={logoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setFailed(true)} />
    </div>
  )
}

interface Props {
  reason:      string
  isLoggedIn:  boolean
  isAdmin?:    boolean
  onSignIn:    () => void
  onSettings:  () => void
  onClose:     () => void
}

export function GatePrompt({ reason, isLoggedIn, isAdmin, onSignIn, onSettings, onClose }: Props) {
  const country = useGeoCountry()
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('broker_partners')
      .select('*')
      .eq('active', true)
      .order('display_order')
      .then(({ data }) => { setBrokers(data ?? []); setLoading(false) })
  }, [])

  const visible = brokers.filter(b =>
    isAdmin || !country || b.countries.length === 0 || b.countries.includes(country)
  )

  function openBroker(link: string) {
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  function handleAlreadyDeposited() {
    onClose()
    if (isLoggedIn) onSettings()
    else onSignIn()
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ padding: 16 }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col"
        style={{
          background: 'linear-gradient(145deg, #12131e 0%, #0c0d16 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="shrink-0" style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <div className="flex items-center" style={{ gap: 8 }}>
              <Logo size={20} />
              <span className="text-[12px] font-bold text-white tracking-tight">Fintelligent</span>
              <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.14em', color: 'rgba(0,210,168,0.5)' }}>S&D</span>
            </div>
            <button onClick={onClose} className="text-gray-700 hover:text-gray-400 transition-colors cursor-pointer text-lg leading-none">✕</button>
          </div>

          <h2 className="text-[15px] font-bold text-white" style={{ marginBottom: 5 }}>Unlock Premium — it's free</h2>
          <p className="text-[12px] text-gray-500 leading-relaxed" style={{ marginBottom: 12 }}>{reason}</p>

          {/* Value prop */}
          <div style={{ padding: '10px 13px', background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 10 }}>
            <p className="text-[11px] text-violet-300 leading-relaxed">
              Open an account with one of our broker partners and make a deposit — you'll get full Premium access at no extra cost.
            </p>
          </div>
        </div>

        {/* Broker list */}
        <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '14px 24px' }}>
          <p className="text-[10px] font-semibold uppercase text-gray-600" style={{ letterSpacing: '0.12em', marginBottom: 10 }}>Choose a broker to get started</p>

          {loading && (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse rounded-xl" style={{ height: 62, background: 'rgba(255,255,255,0.03)' }} />
              ))}
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p className="text-[12px] text-gray-600">No broker partners available in your region right now.</p>
              <p className="text-[11px] text-gray-700" style={{ marginTop: 6 }}>
                Contact us at{' '}
                <a href="mailto:fintelligent.ai@gmail.com" className="text-violet-500 hover:text-violet-400 transition-colors">
                  fintelligent.ai@gmail.com
                </a>
              </p>
            </div>
          )}

          {!loading && visible.map(broker => (
            <button
              key={broker.id}
              onClick={() => openBroker(broker.affiliate_link)}
              className="w-full flex items-center text-left cursor-pointer transition-all"
              style={{ gap: 13, padding: '12px 14px', marginBottom: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.border = '1px solid rgba(124,58,237,0.22)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)' }}
            >
              <LogoBox name={broker.name} logoUrl={broker.logo_url} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-gray-200" style={{ marginBottom: 2 }}>{broker.name}</div>
                {broker.tagline && <p className="text-[11px] text-gray-600">{broker.tagline}</p>}
              </div>
              <div style={{ padding: '5px 11px', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.4)', flexShrink: 0 }}>
                <span className="text-[11px] font-semibold text-white">Open account →</span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer — already deposited path */}
        <div className="shrink-0" style={{ padding: '12px 24px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <p className="text-[11px] text-gray-600">Already deposited with a partner?</p>
            <button
              onClick={handleAlreadyDeposited}
              className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 cursor-pointer transition-colors"
            >
              {isLoggedIn ? 'Submit your broker ID →' : 'Sign up & submit ID →'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full text-[11px] text-gray-700 hover:text-gray-500 cursor-pointer transition-colors"
            style={{ background: 'transparent', border: 'none' }}
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  )
}
