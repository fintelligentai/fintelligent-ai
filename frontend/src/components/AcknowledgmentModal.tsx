import { useState } from 'react'
import { Logo } from './Logo'

const STORAGE_KEY = 'fintelligent_ack_v1'

export function isAcknowledged() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function AcknowledgmentModal({ onAcknowledge }: { onAcknowledge: () => void }) {
  const [checked, setChecked] = useState(false)

  function handleContinue() {
    if (!checked) return
    localStorage.setItem(STORAGE_KEY, 'true')
    onAcknowledge()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ padding: 16 }}>
      <div
        className="w-full max-w-md rounded-2xl overflow-y-auto"
        style={{
          background: 'linear-gradient(145deg, #12131e 0%, #0c0d16 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)',
          maxHeight: 'calc(100dvh - 40px)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Logo size={22} />
            <span className="text-[13px] font-bold text-white tracking-tight">Fintelligent</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(0,210,168,0.5)' }}>S&D</span>
          </div>
          <h2 className="text-[16px] font-bold text-white mb-1">Important Notice</h2>
          <p className="text-[11px] text-gray-600">Please read before continuing</p>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 28px' }}>
          <p className="text-[12px] text-gray-400 leading-relaxed" style={{ marginBottom: 12 }}>
            Fintelligent AI is an educational analytical tool. All zones, scores, and signals are
            generated algorithmically based on historical supply and demand patterns and are{' '}
            <span className="text-gray-200 font-semibold">
              not personalized investment advice, trade recommendations, or guarantees of future performance.
            </span>
          </p>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            Trading financial instruments carries a high level of risk and may not be suitable for
            all investors. Past zone behavior does not predict future price action. You are solely
            responsible for any trading decisions you make.
          </p>
        </div>

        {/* Checkbox + CTA */}
        <div style={{ padding: '0 28px 28px' }}>
          <label
            className="flex items-start gap-3 cursor-pointer select-none"
            style={{ padding: '14px 16px', marginBottom: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}
          >
            <div className="relative shrink-0" style={{ marginTop: 1 }}>
              <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="sr-only" />
              <div
                className="w-4 h-4 rounded flex items-center justify-center transition-all"
                style={{
                  background: checked ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.05)',
                  border: checked ? '1px solid rgba(124,58,237,0.8)' : '1px solid rgba(255,255,255,0.18)',
                }}
              >
                {checked && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-[11px] text-gray-300 leading-relaxed">
              I understand that Fintelligent AI provides educational analysis only, not financial advice,
              and that I am solely responsible for my own trading decisions.
            </span>
          </label>

          <button
            onClick={handleContinue}
            disabled={!checked}
            className="w-full text-[13px] font-semibold rounded-xl transition-all"
            style={{
              padding: '12px 0',
              cursor: checked ? 'pointer' : 'not-allowed',
              background: checked
                ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                : 'rgba(255,255,255,0.05)',
              border: checked ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.07)',
              boxShadow: checked ? '0 4px 16px rgba(109,40,217,0.3)' : 'none',
              color: checked ? '#fff' : 'rgba(255,255,255,0.25)',
            }}
          >
            Continue to Fintelligent AI
          </button>
        </div>
      </div>
    </div>
  )
}
