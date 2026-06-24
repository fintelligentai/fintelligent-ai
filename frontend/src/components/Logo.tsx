const SRC = 'https://thxcmjkzxqsncgaqufvc.supabase.co/storage/v1/object/public/logos/fintelligent.jpeg'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <img
      src={SRC}
      alt="Fintelligent"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), objectFit: 'cover', display: 'block', flexShrink: 0 }}
    />
  )
}
