/** Qatch mark: a magnifier on a dark tile. Decorative; pair it with visible text. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#17181C" />
      <circle cx="11.5" cy="11.5" r="5" fill="none" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M14.6 14.6 L18 18" stroke="#F97316" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
