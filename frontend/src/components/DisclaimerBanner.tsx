export function DisclaimerBanner() {
  return (
    <div className="px-4 sm:px-5 py-3 border-t border-white/5" style={{ background: 'rgba(8,9,14,0.95)' }}>
      <p className="text-[10px] text-gray-700 leading-relaxed tracking-wide">
        <span className="text-gray-600 font-semibold">Disclaimer: </span>
        Fintelligent AI is an educational analytical tool. All zones, scores, and signals are generated
        algorithmically based on historical supply and demand patterns and are not personalized investment
        advice, trade recommendations, or guarantees of future performance. Trading financial instruments
        carries a high level of risk and may not be suitable for all investors. Past zone behavior does
        not predict future price action. You are solely responsible for any trading decisions you make.
        Always conduct your own research and consider consulting a licensed financial advisor before trading.
      </p>
    </div>
  )
}
