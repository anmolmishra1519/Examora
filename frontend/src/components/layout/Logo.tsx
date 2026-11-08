export function Logomark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#26326B" />
      <path d="M13 12H27" stroke="#F7F6F1" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M13 20H23" stroke="#F7F6F1" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M13 28H27" stroke="#F7F6F1" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M23.5 22.5L26.5 25.5L32 19" stroke="#8FE3B8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-xl font-semibold tracking-tight text-ink ${className}`}>
      Examora
    </span>
  );
}
