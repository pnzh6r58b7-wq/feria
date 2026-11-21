"use client";

export default function Ring({ frac, color }: { frac: number; color: string }) {
  const C = 2 * Math.PI * 18;
  return (
    <svg className="ringsvg" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="18" fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle cx="22" cy="22" r="18" fill="none" stroke={`var(${color})`} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="800" fill={`var(${color})`} fontFamily="Manrope">
        {Math.round(frac * 100)}%
      </text>
    </svg>
  );
}
