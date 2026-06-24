import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  onClose: () => void
}

interface Broker {
  id:   string
  name: string
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 10,
  color: '#d4d6e0',
  fontSize: 12,
  outline: 'none',
  padding: '10px 12px',
}

const SELECT_STYLE: React.CSSProperties = {
  ...{
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 10,
    color: '#d4d6e0',
    fontSize: 12,
    outline: 'none',
    padding: '10px 12px',
    cursor: 'pointer',
    appearance: 'none' as const,
  }
}

export function AccountSettingsModal({ onClose }: Props) {
  const { user, tier, refreshProfile } = useAuth()
  const [brokerId, setBrokerId]     = useState('')
  const [brokerName, setBrokerName] = useState('')
  const [brokers, setBrokers]       = useState<Broker[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('profiles').select('broker_account_id, broker_name').eq('id', user.id).single(),
      supabase.from('broker_partners').select('id, name').eq('active', true).order('display_order'),
    ]).then(([profile, brokerList]) => {
      setBrokerId(profile.data?.broker_account_id ?? '')
      setBrokerName(profile.data?.broker_name ?? '')
      setBrokers(brokerList.data ?? [])
      setLoading(false)
    })
  }, [user])

  async function save() {
    if (!user) return
    setSaving(true); setError(''); setSaved(false)
    const { error } = await supabase.from('profiles').update({
      broker_account_id: brokerId.trim() || null,
      broker_name:       brokerName || null,
    }).eq('id', user.id)
    if (error) setError(error.message)
    else { setSaved(true); await refreshProfile() }
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ padding: 16 }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #12131e 0%, #0c0d16 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-[14px] font-bold text-white">Account Settings</h2>
            <p className="text-[11px] text-gray-600" style={{ marginTop: 2 }}>Manage your plan and broker</p>
          </div>
          <button onClick={onClose} className="text-gray-700 hover:text-gray-400 transition-colors cursor-pointer text-lg leading-none">✕</button>
        </div>

        {/* Account info card */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <span className="text-[10px] text-gray-600 uppercase tracking-[0.12em] font-semibold">Email</span>
              <span className="text-[11px] text-gray-300 font-mono">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-600 uppercase tracking-[0.12em] font-semibold">Plan</span>
              <span
                className="text-[10px] font-bold rounded-md"
                style={{
                  padding: '3px 8px',
                  background: tier === 'premium' ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.06)',
                  color: tier === 'premium' ? '#a78bfa' : '#6b7280',
                  border: tier === 'premium' ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {tier === 'premium' ? '✦ Premium' : 'Free'}
              </span>
            </div>
          </div>
        </div>

        {/* Broker section */}
        <div style={{ padding: '16px 24px' }}>
          <p className="text-[10px] text-gray-600 uppercase tracking-[0.12em] font-semibold" style={{ marginBottom: 6 }}>Broker verification</p>
          <p className="text-[11px] text-gray-600 leading-relaxed" style={{ marginBottom: 12 }}>
            Select the broker you signed up with and enter the account email or ID you used. We'll verify your deposit and upgrade your account.
          </p>

          {loading ? (
            <div className="flex flex-col gap-2">
              <div className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              <div className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div style={{ position: 'relative' }}>
                <select
                  value={brokerName}
                  onChange={e => { setBrokerName(e.target.value); setSaved(false) }}
                  style={SELECT_STYLE}
                >
                  <option value="" style={{ background: '#0f1019' }}>Select broker…</option>
                  {brokers.map(b => (
                    <option key={b.id} value={b.name} style={{ background: '#0f1019' }}>{b.name}</option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 10, pointerEvents: 'none' }}>▾</span>
              </div>
              <input
                type="text"
                value={brokerId}
                onChange={e => { setBrokerId(e.target.value); setSaved(false) }}
                placeholder="Account email or ID (e.g. john@example.com)"
                style={INPUT_STYLE}
              />
            </div>
          )}

          {error && <p className="text-[11px] text-red-400" style={{ marginTop: 8 }}>{error}</p>}
          {saved && <p className="text-[11px] text-emerald-400" style={{ marginTop: 8 }}>Saved — we'll verify your deposit shortly.</p>}

          {tier === 'free' && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 10 }}>
              <p className="text-[11px] text-violet-400 leading-relaxed">
                Once you've deposited with a broker partner, fill in the fields above. We'll verify and upgrade your account to Premium.
              </p>
            </div>
          )}
        </div>

        {/* Support */}
        <div className="text-center" style={{ padding: '0 24px 14px' }}>
          <p className="text-[10px] text-gray-700">
            Need help?{' '}
            <a href="mailto:fintelligent.ai@gmail.com" className="text-gray-500 hover:text-violet-400 transition-colors">
              fintelligent.ai@gmail.com
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2" style={{ padding: '0 24px 24px' }}>
          <button
            onClick={onClose}
            className="flex-1 text-[12px] text-gray-600 hover:text-gray-300 transition-colors cursor-pointer rounded-xl"
            style={{ padding: '10px 0', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent' }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex-1 text-white text-[12px] font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            style={{ padding: '10px 0', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', border: '1px solid rgba(124,58,237,0.5)', boxShadow: '0 4px 16px rgba(109,40,217,0.3)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
