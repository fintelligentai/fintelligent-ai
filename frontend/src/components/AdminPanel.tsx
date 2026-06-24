import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'

const ALL_COUNTRIES: { code: string; name: string }[] = [
  {code:'AF',name:'Afghanistan'},{code:'AL',name:'Albania'},{code:'DZ',name:'Algeria'},
  {code:'AO',name:'Angola'},{code:'AR',name:'Argentina'},{code:'AM',name:'Armenia'},
  {code:'AU',name:'Australia'},{code:'AT',name:'Austria'},{code:'AZ',name:'Azerbaijan'},
  {code:'BH',name:'Bahrain'},{code:'BD',name:'Bangladesh'},{code:'BY',name:'Belarus'},
  {code:'BE',name:'Belgium'},{code:'BZ',name:'Belize'},{code:'BJ',name:'Benin'},
  {code:'BO',name:'Bolivia'},{code:'BA',name:'Bosnia and Herzegovina'},{code:'BW',name:'Botswana'},
  {code:'BR',name:'Brazil'},{code:'BN',name:'Brunei'},{code:'BG',name:'Bulgaria'},
  {code:'BF',name:'Burkina Faso'},{code:'BI',name:'Burundi'},{code:'KH',name:'Cambodia'},
  {code:'CM',name:'Cameroon'},{code:'CA',name:'Canada'},{code:'CV',name:'Cape Verde'},
  {code:'CF',name:'Central African Republic'},{code:'TD',name:'Chad'},{code:'CL',name:'Chile'},
  {code:'CN',name:'China'},{code:'CO',name:'Colombia'},{code:'KM',name:'Comoros'},
  {code:'CG',name:'Congo'},{code:'CD',name:'Congo (DRC)'},{code:'CR',name:'Costa Rica'},
  {code:'HR',name:'Croatia'},{code:'CU',name:'Cuba'},{code:'CY',name:'Cyprus'},
  {code:'CZ',name:'Czech Republic'},{code:'DK',name:'Denmark'},{code:'DJ',name:'Djibouti'},
  {code:'DO',name:'Dominican Republic'},{code:'EC',name:'Ecuador'},{code:'EG',name:'Egypt'},
  {code:'SV',name:'El Salvador'},{code:'GQ',name:'Equatorial Guinea'},{code:'ER',name:'Eritrea'},
  {code:'EE',name:'Estonia'},{code:'ET',name:'Ethiopia'},{code:'FJ',name:'Fiji'},
  {code:'FI',name:'Finland'},{code:'FR',name:'France'},{code:'GA',name:'Gabon'},
  {code:'GM',name:'Gambia'},{code:'GE',name:'Georgia'},{code:'DE',name:'Germany'},
  {code:'GH',name:'Ghana'},{code:'GR',name:'Greece'},{code:'GT',name:'Guatemala'},
  {code:'GN',name:'Guinea'},{code:'GW',name:'Guinea-Bissau'},{code:'GY',name:'Guyana'},
  {code:'HT',name:'Haiti'},{code:'HN',name:'Honduras'},{code:'HK',name:'Hong Kong'},
  {code:'HU',name:'Hungary'},{code:'IS',name:'Iceland'},{code:'IN',name:'India'},
  {code:'ID',name:'Indonesia'},{code:'IR',name:'Iran'},{code:'IQ',name:'Iraq'},
  {code:'IE',name:'Ireland'},{code:'IL',name:'Israel'},{code:'IT',name:'Italy'},
  {code:'JM',name:'Jamaica'},{code:'JP',name:'Japan'},{code:'JO',name:'Jordan'},
  {code:'KZ',name:'Kazakhstan'},{code:'KE',name:'Kenya'},{code:'KR',name:'South Korea'},{code:'KW',name:'Kuwait'},
  {code:'KG',name:'Kyrgyzstan'},{code:'LA',name:'Laos'},{code:'LV',name:'Latvia'},
  {code:'LB',name:'Lebanon'},{code:'LS',name:'Lesotho'},{code:'LR',name:'Liberia'},
  {code:'LI',name:'Liechtenstein'},{code:'LY',name:'Libya'},{code:'LT',name:'Lithuania'},{code:'LU',name:'Luxembourg'},
  {code:'MG',name:'Madagascar'},{code:'MW',name:'Malawi'},{code:'MY',name:'Malaysia'},
  {code:'MV',name:'Maldives'},{code:'ML',name:'Mali'},{code:'MT',name:'Malta'},
  {code:'MR',name:'Mauritania'},{code:'MU',name:'Mauritius'},{code:'MX',name:'Mexico'},
  {code:'MC',name:'Monaco'},{code:'MD',name:'Moldova'},{code:'MN',name:'Mongolia'},{code:'MA',name:'Morocco'},
  {code:'MZ',name:'Mozambique'},{code:'MM',name:'Myanmar'},{code:'NA',name:'Namibia'},
  {code:'NP',name:'Nepal'},{code:'NL',name:'Netherlands'},{code:'NZ',name:'New Zealand'},
  {code:'NI',name:'Nicaragua'},{code:'NE',name:'Niger'},{code:'NG',name:'Nigeria'},
  {code:'NO',name:'Norway'},{code:'OM',name:'Oman'},{code:'PK',name:'Pakistan'},
  {code:'PA',name:'Panama'},{code:'PG',name:'Papua New Guinea'},{code:'PY',name:'Paraguay'},
  {code:'PE',name:'Peru'},{code:'PH',name:'Philippines'},{code:'PL',name:'Poland'},
  {code:'PT',name:'Portugal'},{code:'QA',name:'Qatar'},{code:'RO',name:'Romania'},
  {code:'RU',name:'Russia'},{code:'RW',name:'Rwanda'},{code:'SA',name:'Saudi Arabia'},
  {code:'SN',name:'Senegal'},{code:'RS',name:'Serbia'},{code:'SL',name:'Sierra Leone'},
  {code:'SG',name:'Singapore'},{code:'SK',name:'Slovakia'},{code:'SI',name:'Slovenia'},
  {code:'SO',name:'Somalia'},{code:'ZA',name:'South Africa'},{code:'SS',name:'South Sudan'},
  {code:'ES',name:'Spain'},{code:'LK',name:'Sri Lanka'},{code:'SD',name:'Sudan'},
  {code:'SR',name:'Suriname'},{code:'SZ',name:'Eswatini'},{code:'SE',name:'Sweden'},
  {code:'CH',name:'Switzerland'},{code:'SY',name:'Syria'},{code:'TW',name:'Taiwan'},
  {code:'TJ',name:'Tajikistan'},{code:'TZ',name:'Tanzania'},{code:'TH',name:'Thailand'},
  {code:'TG',name:'Togo'},{code:'TT',name:'Trinidad and Tobago'},{code:'TN',name:'Tunisia'},
  {code:'TR',name:'Turkey'},{code:'TM',name:'Turkmenistan'},{code:'UG',name:'Uganda'},
  {code:'UA',name:'Ukraine'},{code:'AE',name:'United Arab Emirates'},{code:'GB',name:'United Kingdom'},
  {code:'US',name:'United States'},{code:'UY',name:'Uruguay'},{code:'UZ',name:'Uzbekistan'},
  {code:'VE',name:'Venezuela'},{code:'VN',name:'Vietnam'},{code:'YE',name:'Yemen'},
  {code:'ZM',name:'Zambia'},{code:'ZW',name:'Zimbabwe'},
]

function CountrySelect({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = ALL_COUNTRIES.filter(c =>
    !selected.includes(c.code) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
  )

  function toggle(code: string) {
    if (selected.includes(code)) onChange(selected.filter(c => c !== code))
    else { onChange([...selected, code]); setSearch('') }
  }

  function openDropdown() {
    if (ref.current) setRect(ref.current.getBoundingClientRect())
    setOpen(true)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={openDropdown}
        style={{
          minHeight: 36,
          background: 'rgba(255,255,255,0.04)',
          border: open ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.09)',
          borderRadius: 8,
          padding: '4px 8px',
          cursor: 'text',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          alignItems: 'center',
        }}
      >
        {selected.map(code => {
          const country = ALL_COUNTRIES.find(c => c.code === code)
          return (
            <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 5, padding: '2px 6px', fontSize: 10, color: '#c4b5fd' }}>
              {code} · {country?.name ?? code}
              <button onClick={e => { e.stopPropagation(); toggle(code) }} style={{ color: '#7c3aed', cursor: 'pointer', fontSize: 11, lineHeight: 1, background: 'none', border: 'none' }}>✕</button>
            </span>
          )
        })}
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); openDropdown() }}
          onFocus={openDropdown}
          placeholder={selected.length === 0 ? 'Search countries…' : ''}
          style={{ border: 'none', outline: 'none', background: 'transparent', color: '#d4d6e0', fontSize: 11, minWidth: 100, flex: 1 }}
        />
      </div>

      {open && filtered.length > 0 && rect && createPortal(
        <div style={{
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 99999,
          background: '#0f1019',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          maxHeight: 260,
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {filtered.map(c => (
            <button
              key={c.code}
              onMouseDown={e => { e.preventDefault(); toggle(c.code) }}
              style={{ width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280', width: 24, flexShrink: 0 }}>{c.code}</span>
              {c.name}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

interface Profile {
  id:                string
  tier:              string
  is_admin:          boolean
  broker_account_id: string | null
  broker_name:       string | null
  created_at:        string
  email?:            string
}

interface Broker {
  id:             string
  name:           string
  tagline:        string | null
  logo_url:       string | null
  affiliate_link: string
  countries:      string[]
  active:         boolean
  display_order:  number
}

type Tab = 'users' | 'brokers'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 8,
  color: '#d4d6e0',
  fontSize: 12,
  outline: 'none',
  padding: '8px 11px',
}

const FIELD_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 7,
  color: '#d4d6e0',
  fontSize: 11,
  outline: 'none',
  padding: '7px 10px',
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab]           = useState<Tab>('users')
  const [tierFilter, setTierFilter] = useState<'all' | 'premium' | 'free'>('all')
  const [sortDir, setSortDir]       = useState<'desc' | 'asc'>('desc')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [brokers, setBrokers]   = useState<Broker[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)

  const emptyBroker = { name: '', tagline: '', affiliate_link: '', logo_url: '', countries: [] as string[], display_order: '', active: false }
  const [brokerForm, setBrokerForm]   = useState(emptyBroker)
  const [brokerSaving, setBrokerSaving] = useState(false)
  const [brokerMsg, setBrokerMsg]       = useState('')

  const [editingBrokerId, setEditingBrokerId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', tagline: '', affiliate_link: '', logo_url: '', countries: [] as string[], display_order: 0 })
  const [editSaving, setEditSaving] = useState(false)

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setProfiles(data ?? [])
    setLoading(false)
  }, [])

  const loadBrokers = useCallback(async () => {
    const { data } = await supabase.from('broker_partners').select('id, name, tagline, logo_url, affiliate_link, countries, active, display_order').order('display_order')
    setBrokers(data ?? [])
  }, [])

  useEffect(() => { loadProfiles(); loadBrokers() }, [loadProfiles, loadBrokers])

  async function setTier(id: string, tier: string) {
    setSaving(id)
    await supabase.from('profiles').update({ tier }).eq('id', id)
    setProfiles(p => p.map(u => u.id === id ? { ...u, tier } : u))
    setSaving(null)
  }

  function startEdit(br: Broker) {
    setEditingBrokerId(br.id)
    setEditForm({ name: br.name, tagline: br.tagline ?? '', affiliate_link: br.affiliate_link, logo_url: br.logo_url ?? '', countries: br.countries, display_order: br.display_order })
  }

  async function saveEdit(id: string) {
    setEditSaving(true)
    const countries = editForm.countries
    await supabase.from('broker_partners').update({ name: editForm.name, tagline: editForm.tagline || null, affiliate_link: editForm.affiliate_link, logo_url: editForm.logo_url || null, countries, display_order: Number(editForm.display_order) }).eq('id', id)
    setBrokers(b => b.map(br => br.id === id ? { ...br, name: editForm.name, tagline: editForm.tagline || null, affiliate_link: editForm.affiliate_link, logo_url: editForm.logo_url || null, countries, display_order: Number(editForm.display_order) } : br))
    setEditingBrokerId(null)
    setEditSaving(false)
  }

  async function toggleBrokerActive(id: string, active: boolean) {
    await supabase.from('broker_partners').update({ active: !active }).eq('id', id)
    setBrokers(b => b.map(br => br.id === id ? { ...br, active: !active } : br))
  }

  async function deleteBroker(id: string) {
    if (!confirm('Delete this broker?')) return
    await supabase.from('broker_partners').delete().eq('id', id)
    setBrokers(b => b.filter(br => br.id !== id))
  }

  async function addBroker() {
    setBrokerSaving(true); setBrokerMsg('')
    const countries = brokerForm.countries
    const { error } = await supabase.from('broker_partners').insert({ name: brokerForm.name, tagline: brokerForm.tagline || null, affiliate_link: brokerForm.affiliate_link, logo_url: brokerForm.logo_url || null, countries, display_order: Number(brokerForm.display_order), active: brokerForm.active })
    if (error) setBrokerMsg(error.message)
    else { setBrokerForm(emptyBroker); setBrokerMsg('Added!'); await loadBrokers() }
    setBrokerSaving(false)
  }

  const filtered = profiles
    .filter(p =>
      (!search || (p.email ?? p.id).toLowerCase().includes(search.toLowerCase()) ||
      (p.broker_account_id ?? '').toLowerCase().includes(search.toLowerCase())) &&
      (tierFilter === 'all' || p.tier === tierFilter)
    )
    .sort((a, b) => sortDir === 'desc'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  const premiumCount = profiles.filter(p => p.tier === 'premium').length
  const freeCount    = profiles.filter(p => p.tier === 'free').length

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ padding: 16 }}>
      <div
        className="w-full max-w-3xl rounded-2xl flex flex-col"
        style={{
          background: 'linear-gradient(145deg, #12131e 0%, #0c0d16 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0" style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-4">
            <span className="text-[13px] font-bold text-white">Admin Panel</span>
            <div className="flex items-center gap-1">
              {(['users', 'brokers'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={['text-[11px] font-semibold capitalize rounded-lg cursor-pointer transition-all border',
                    tab === t
                      ? 'bg-violet-600/30 text-violet-300 border-violet-500/40'
                      : 'text-gray-600 border-transparent hover:text-gray-400 hover:border-white/8',
                  ].join(' ')}
                  style={{ padding: '4px 12px' }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-700 hover:text-gray-400 transition-colors cursor-pointer text-lg leading-none">✕</button>
        </div>

        {/* Users tab */}
        {tab === 'users' && (
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">

            {/* Stats bar */}
            {!loading && (
              <div className="flex items-center gap-3 shrink-0" style={{ padding: '12px 24px 0' }}>
                <span className="text-[10px] text-gray-600">{profiles.length} total</span>
                <span className="text-gray-800" style={{ fontSize: 10 }}>·</span>
                <span className="text-[10px] text-violet-400 font-semibold">{premiumCount} premium</span>
                <span className="text-gray-800" style={{ fontSize: 10 }}>·</span>
                <span className="text-[10px] text-gray-600">{freeCount} free</span>
              </div>
            )}

            {/* Search + filters */}
            <div className="flex items-center gap-2 shrink-0" style={{ padding: '10px 24px 8px' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by email or broker ID…"
                style={{ ...INPUT_STYLE, flex: 1 }}
              />
              {/* Tier filter */}
              {(['all', 'premium', 'free'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className="text-[10px] font-semibold capitalize rounded-lg cursor-pointer transition-all shrink-0 border"
                  style={{
                    padding: '6px 10px',
                    background: tierFilter === t
                      ? t === 'premium' ? 'rgba(124,58,237,0.2)' : t === 'free' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.08)'
                      : 'transparent',
                    color: tierFilter === t
                      ? t === 'premium' ? '#a78bfa' : '#d1d5db'
                      : '#6b7280',
                    border: tierFilter === t
                      ? t === 'premium' ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.15)'
                      : '1px solid transparent',
                  }}
                >
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
              {/* Sort toggle */}
              <button
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                className="text-[10px] text-gray-600 hover:text-gray-300 transition-colors cursor-pointer shrink-0 rounded-lg border border-transparent hover:border-white/8"
                style={{ padding: '6px 8px' }}
                title={sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
              >
                {sortDir === 'desc' ? '↓ Newest' : '↑ Oldest'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '0 24px 16px' }}>
              {loading && <div className="text-[11px] text-gray-700 text-center" style={{ padding: '24px 0' }}>Loading…</div>}
              {!loading && filtered.length === 0 && (
                <div className="text-[11px] text-gray-700 text-center" style={{ padding: '24px 0' }}>No users found.</div>
              )}
              {!loading && filtered.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3"
                  style={{
                    padding: '11px 0',
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-gray-300 truncate font-mono">{p.email ?? p.id.slice(0, 20) + '…'}</div>
                    {(p.broker_name || p.broker_account_id) && (
                      <div className="text-[10px] text-gray-600" style={{ marginTop: 3 }}>
                        {p.broker_name && <span className="text-gray-500">{p.broker_name}</span>}
                        {p.broker_name && p.broker_account_id && <span className="text-gray-700"> · </span>}
                        {p.broker_account_id && <span>{p.broker_account_id}</span>}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-700" style={{ marginTop: 2 }}>
                      Joined {new Date(p.created_at).toLocaleDateString()}
                      {p.is_admin && <span className="text-amber-600"> · admin</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[10px] font-semibold rounded-md"
                      style={{
                        padding: '3px 8px',
                        background: p.tier === 'premium' ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.06)',
                        color: p.tier === 'premium' ? '#a78bfa' : '#6b7280',
                        border: p.tier === 'premium' ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {p.tier}
                    </span>
                    <button
                      onClick={() => setTier(p.id, p.tier === 'premium' ? 'free' : 'premium')}
                      disabled={saving === p.id}
                      className="text-[10px] font-semibold rounded-md cursor-pointer transition-all disabled:opacity-40"
                      style={{
                        padding: '3px 10px',
                        border: p.tier === 'premium' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(124,58,237,0.3)',
                        color: p.tier === 'premium' ? '#f87171' : '#a78bfa',
                        background: 'transparent',
                      }}
                    >
                      {saving === p.id ? '…' : p.tier === 'premium' ? 'Downgrade' : 'Upgrade'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0" style={{ padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={loadProfiles} className="text-[11px] text-gray-700 hover:text-gray-400 cursor-pointer transition-colors">↻ Refresh</button>
            </div>
          </div>
        )}

        {/* Brokers tab */}
        {tab === 'brokers' && (
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">

            {/* Scrollable broker list */}
            <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '16px 24px 8px' }}>
              <div className="flex flex-col gap-2">
                {brokers.map(br => (
                  <div
                    key={br.id}
                    className="rounded-xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex items-center gap-3" style={{ padding: '12px 14px' }}>
                      {br.logo_url && (
                        <img src={br.logo_url} alt={br.name} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-gray-200">{br.name}</span>
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider rounded"
                            style={{
                              padding: '2px 6px',
                              background: br.active ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                              color: br.active ? '#34d399' : '#6b7280',
                              border: br.active ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            {br.active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-[10px] text-gray-700">#{br.display_order}</span>
                        </div>
                        {br.tagline && <div className="text-[10px] text-gray-600" style={{ marginTop: 2 }}>{br.tagline}</div>}
                        <div className="text-[10px] text-gray-700 truncate" style={{ marginTop: 2 }}>{br.affiliate_link}</div>
                        {br.countries.length > 0 && (
                          <div className="text-[10px] text-gray-700" style={{ marginTop: 2 }}>{br.countries.join(', ')}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => editingBrokerId === br.id ? setEditingBrokerId(null) : startEdit(br)}
                          className="text-[10px] font-medium rounded-md cursor-pointer transition-all"
                          style={{ padding: '4px 9px', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', background: 'transparent' }}
                        >
                          {editingBrokerId === br.id ? 'Cancel' : 'Edit'}
                        </button>
                        <button
                          onClick={() => toggleBrokerActive(br.id, br.active)}
                          className="text-[10px] font-medium rounded-md cursor-pointer transition-all text-gray-600 hover:text-gray-300"
                          style={{ padding: '4px 9px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent' }}
                        >
                          {br.active ? 'Pause' : 'Enable'}
                        </button>
                        <button
                          onClick={() => deleteBroker(br.id)}
                          className="text-[10px] font-medium rounded-md cursor-pointer transition-all"
                          style={{ padding: '4px 9px', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', background: 'transparent' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Inline edit */}
                    {editingBrokerId === br.id && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px', background: 'rgba(0,0,0,0.2)' }}>
                        <div className="flex flex-col gap-2">
                          {[
                            { key: 'name',           label: 'Name',           placeholder: 'e.g. Exness' },
                            { key: 'tagline',         label: 'Tagline',        placeholder: 'e.g. Trade globally with low spreads' },
                            { key: 'affiliate_link',  label: 'Affiliate link', placeholder: 'https://…' },
                            { key: 'logo_url',        label: 'Logo URL',       placeholder: 'https://… (direct image URL)' },
                            { key: 'display_order',   label: 'Order',          placeholder: 'Display order (e.g. 10, 20, 30…)' },
                          ].map(({ key, label, placeholder }) => (
                            <div key={key} className="flex items-center gap-3">
                              <span className="text-[10px] text-gray-600 shrink-0" style={{ width: 80, textAlign: 'right' }}>{label}</span>
                              <input
                                value={(editForm as any)[key]}
                                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                placeholder={placeholder}
                                style={FIELD_STYLE}
                              />
                            </div>
                          ))}
                          <div className="flex items-start gap-3">
                            <span className="text-[10px] text-gray-600 shrink-0" style={{ width: 80, textAlign: 'right', paddingTop: 8 }}>Geos</span>
                            <div style={{ flex: 1 }}>
                              <CountrySelect selected={editForm.countries} onChange={v => setEditForm(f => ({ ...f, countries: v }))} />
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => saveEdit(br.id)}
                          disabled={editSaving || !editForm.name || !editForm.affiliate_link}
                          className="w-full text-white text-[11px] font-semibold rounded-lg cursor-pointer disabled:opacity-40 transition-all"
                          style={{ padding: '9px 0', marginTop: 12, background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', border: '1px solid rgba(124,58,237,0.4)' }}
                        >
                          {editSaving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pinned Add Broker form */}
            <div className="shrink-0" style={{ padding: '14px 24px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-gray-600 uppercase tracking-[0.12em] font-semibold" style={{ marginBottom: 10 }}>Add broker</p>
              <div className="flex flex-col gap-2">
                {[
                  { key: 'name',           placeholder: 'Name *' },
                  { key: 'tagline',         placeholder: 'Tagline' },
                  { key: 'affiliate_link',  placeholder: 'Affiliate link *' },
                  { key: 'logo_url',        placeholder: 'Logo URL' },
                  { key: 'display_order',   placeholder: 'Display order (e.g. 10, 20, 30…)' },
                ].map(({ key, placeholder }) => (
                  <input
                    key={key}
                    value={(brokerForm as any)[key]}
                    onChange={e => setBrokerForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={FIELD_STYLE}
                  />
                ))}
                <CountrySelect selected={brokerForm.countries} onChange={v => setBrokerForm(f => ({ ...f, countries: v }))} />
                <label className="flex items-center gap-2 cursor-pointer" style={{ padding: '4px 2px' }}>
                  <div
                    onClick={() => setBrokerForm(f => ({ ...f, active: !f.active }))}
                    style={{
                      width: 36, height: 20, borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s',
                      background: brokerForm.active ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.1)',
                      border: brokerForm.active ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.12)',
                      position: 'relative', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: brokerForm.active ? 18 : 2,
                      width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                    }} />
                  </div>
                  <span className="text-[11px] text-gray-500">
                    Active (visible in app){brokerForm.active ? ' — ON' : ' — OFF'}
                  </span>
                </label>
              </div>
              {brokerMsg && (
                <p className="text-[11px]" style={{ marginTop: 8, color: brokerMsg === 'Added!' ? '#34d399' : '#f87171' }}>{brokerMsg}</p>
              )}
              <button
                onClick={addBroker}
                disabled={brokerSaving || !brokerForm.name || !brokerForm.affiliate_link}
                className="w-full text-white text-[12px] font-semibold rounded-lg cursor-pointer disabled:opacity-40 transition-all"
                style={{ padding: '10px 0', marginTop: 10, background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', border: '1px solid rgba(124,58,237,0.4)' }}
              >
                {brokerSaving ? 'Adding…' : 'Add Broker'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
