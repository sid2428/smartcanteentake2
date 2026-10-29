import type { ReactNode } from "react";

/** Editorial page heading: small eyebrow, large serif title, optional lede and actions. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-10 flex animate-rise flex-wrap items-end justify-between gap-6 sm:mb-14 ${className}`}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="font-display text-[2.4rem] font-light leading-[1.05] tracking-tight text-ink sm:text-[3.25rem]">
          {title}
        </h1>
        {lede && <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

/** Section title used inside pages, with a hairline rule. */
export function SectionTitle({ children, aside, className = "" }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={`mb-5 flex items-baseline justify-between gap-4 border-b border-cream-300 pb-3 ${className}`}>
      <h2 className="font-display text-xl font-normal tracking-tight text-ink">{children}</h2>
      {aside && <div className="text-sm text-ink-muted">{aside}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] animate-fade flex-col items-center justify-center gap-4 text-ink-muted" role="status">
      <span className="relative flex h-10 w-10">
        <span className="absolute inset-0 animate-ping rounded-full bg-forest-200 opacity-60" />
        <span className="relative m-auto h-3 w-3 rounded-full bg-forest-600" />
      </span>
      <p className="font-display text-lg italic">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon = "🍃",
  title,
  children,
  className = "",
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex animate-rise flex-col items-center py-16 text-center ${className}`}>
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cream-200 text-2xl" aria-hidden>
        {icon}
      </span>
      <p className="font-display text-2xl font-light text-ink">{title}</p>
      {children && <div className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">{children}</div>}
    </div>
  );
}

export function Arrow({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Full-section error with a retry, for when a page's data couldn't load at all. */
export function ErrorState({
  title = "We couldn't load this",
  message,
  onRetry,
  className = "",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex animate-rise flex-col items-center py-16 text-center ${className}`} role="alert">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-terra-50 text-terra-500" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 8v5m0 3h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="font-display text-2xl font-light text-ink">{title}</p>
      {message && <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 rounded-full border border-cream-400 px-5 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-forest-500 hover:text-forest-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Small "Live" / "Reconnecting…" marker for screens that refresh themselves. */
export function LiveIndicator({ stale, className = "" }: { stale?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-medium ${stale ? "text-terra-600" : "text-ink-muted"} ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        {!stale && <span className="absolute inset-0 animate-ping rounded-full bg-forest-400" />}
        <span className={`relative h-2 w-2 rounded-full ${stale ? "bg-terra-400" : "bg-forest-500"}`} />
      </span>
      {stale ? "Reconnecting…" : "Live"}
    </span>
  );
}
