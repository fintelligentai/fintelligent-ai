import { useState, useRef, useEffect } from 'react'

interface Props {
  email: string
  isAdmin: boolean
  onAdmin: () => void
  onSettings: () => void
  onSignOut: () => void
}

export function UserMenu({ email, isAdmin, onAdmin, onSettings, onSignOut }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/16 transition-all cursor-pointer"
        style={{ padding: '5px 10px' }}
      >
        <span className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-violet-300" style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.3)' }}>
          {initials}
        </span>
        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl z-50 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #12131e 0%, #0d0e18 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {/* Email header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] text-gray-600 uppercase tracking-[0.14em] font-semibold" style={{ marginBottom: 5 }}>Signed in as</p>
            <p className="text-[11px] text-gray-300 truncate" style={{ fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{email}</p>
          </div>

          {/* Menu items */}
          <div style={{ padding: '6px 0' }}>
            {isAdmin && (
              <button
                onClick={() => { onAdmin(); setOpen(false) }}
                className="w-full flex items-center gap-2.5 text-left text-[11px] font-semibold text-amber-500 hover:text-amber-400 transition-colors cursor-pointer"
                style={{ padding: '8px 16px' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-[13px]">⚙</span>
                <span>Admin Panel</span>
              </button>
            )}
            <button
              onClick={() => { onSettings(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 text-left text-[11px] text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
              style={{ padding: '8px 16px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="text-[13px]">⊙</span>
              <span>Settings</span>
            </button>

            <div style={{ margin: '4px 16px', height: 1, background: 'rgba(255,255,255,0.06)' }} />

            <button
              onClick={() => { onSignOut(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 text-left text-[11px] text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
              style={{ padding: '8px 16px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="text-[13px]">↪</span>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
