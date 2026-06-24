interface Asset {
  ticker: string
  label: string
}

const ASSETS: Asset[] = [
  { ticker: 'BTC-USD', label: 'BTC/USD' },
  { ticker: 'XAUUSD=X', label: 'XAU/USD' },
  { ticker: 'EURUSD=X', label: 'EUR/USD' },
]

interface Props {
  selected: string
  onChange: (ticker: string) => void
}

export function AssetSelector({ selected, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {ASSETS.map((a) => (
        <button
          key={a.ticker}
          onClick={() => onChange(a.ticker)}
          className={[
            'px-4 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer',
            selected === a.ticker
              ? 'bg-violet-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white',
          ].join(' ')}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
