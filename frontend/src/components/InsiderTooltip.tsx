import { createPortal } from 'react-dom'
import { useTooltip } from '../hooks/useTooltip'
import type { InsiderDetail } from '../api/client'

interface Props {
  details: InsiderDetail[]
  label:   string
}

export function InsiderTooltip({ details, label }: Props) {
  const { triggerRef, visible, hoverProps, tapProps, tooltipStyle } = useTooltip({ width: 240 })

  if (!details.length) return null

  return (
    <>
      <span
        ref={triggerRef}
        {...hoverProps}
        {...tapProps}
        className="ml-1 text-[10px] text-gray-600 cursor-default select-none border border-white/10 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center hover:border-white/30 hover:text-gray-400 transition-colors shrink-0"
      >
        ⓘ
      </span>
      {visible && createPortal(
        <div style={tooltipStyle}>
          <div className="bg-[#1a1b24] border border-white/20 rounded-lg p-3 shadow-2xl text-[11px] space-y-2">
            <div className="text-gray-500 uppercase tracking-widest text-[10px] font-semibold">{label}</div>
            {details.map((d, i) => (
              <div key={i} className="flex justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-gray-200 truncate">{d.name}</div>
                  <div className="text-gray-600 text-[10px]">{d.role}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-gray-300">{d.value_fmt}</div>
                  <div className="text-gray-600 text-[10px]">{d.shares.toLocaleString()} shares</div>
                  {d.pct_of_holdings != null && (
                    <div className="text-gray-600 text-[10px]">{d.pct_of_holdings}% of holdings</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
