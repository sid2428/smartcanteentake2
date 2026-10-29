/** Wordmark with a small leaf-on-plate mark. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <circle cx="16" cy="16" r="16" className="fill-forest-700" />
        <path d="M9 19.5c0-4.5 3.6-9 10.5-9.5-.4 6.7-4.6 10.5-9.1 10.5" className="fill-cream-100" />
        <path d="M10 21c2.5-3 5-5 8-6.5" className="stroke-forest-700" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <circle cx="22.5" cy="21.5" r="2" className="fill-terra-400" />
      </svg>
      <span className="font-display text-[1.3rem] font-normal tracking-tight text-ink">
        Smart <span className="italic text-forest-700">Canteen</span>
      </span>
    </span>
  );
}
