export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="w-full max-w-4xl">
        <header className="mb-8 text-center sm:mb-10">
          <div className="mb-3 inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-sm font-bold text-white shadow-sm" aria-hidden>
              SC
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Smart Canteen</h1>
          </div>
          <p className="text-sm text-slate-500">College canteen ordering with QR pickup</p>
        </header>
        {children}
      </div>
    </main>
  );
}
