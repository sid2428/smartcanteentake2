"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useLive } from "@/lib/use-live";
import { hourLabel, type PeakWindow } from "@/lib/insights";
import { PageHeader, SectionTitle, Loading, ErrorState, EmptyState } from "@/components/ui/page";
import { DishThumb } from "@/components/dish-photo";
import { useToast } from "@/components/ui/toast";

type Insights = {
  generated_at: string;
  history_days: number;
  has_history: boolean;
  today: {
    date: string;
    weekday: number;
    hour_now: number;
    hourly: { hour: number; expected: number; actual: number }[];
    peaks: PeakWindow[];
    next_peak: PeakWindow | null;
    expected_total: number;
    actual_so_far: number;
  };
  tomorrow: { date: string; weekday: number; peaks: PeakWindow[]; expected_total: number };
  weekdays: { weekday: number; avg: number }[];
  dishes: {
    id: string;
    name: string;
    emoji: string;
    counter: string;
    stock: number;
    expected_today: number;
    expected_remaining: number;
    sold_today: number;
    last7: number;
    prev7: number;
    trend_pct: number | null;
    risk: "OUT" | "LOW" | "OK";
    restock: number;
  }[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Chart colours: one forest hue in two lightness steps (validated: ΔE ≥ 26 under every CVD type),
// so "peak" reads by lightness, not by a second hue. "Today so far" is an ink tick: shape, not colour.
const BAR = "#7fa58a";
const BAR_PEAK = "#2f563b";

function windowLabel(p: PeakWindow): string {
  const start = hourLabel(p.startHour);
  const end = hourLabel(p.endHour);
  // "1 – 3 pm" when both ends share am/pm.
  return start.slice(-2) === end.slice(-2) ? `${start.slice(0, -3)} – ${end}` : `${start} – ${end}`;
}

/** Rounds a max up to a clean axis value (5, 10, 20, 25, 50…). */
function niceMax(n: number): number {
  if (n <= 0) return 5;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (n <= step * pow) return step * pow;
  return 10 * pow;
}

export default function InsightsPage() {
  const { toast } = useToast();
  const [restocking, setRestocking] = useState<string | null>(null);
  const live = useLive(() => api<Insights>("/api/owner/insights"), { intervalMs: 60_000 });

  async function restock(id: string, name: string, amount: number) {
    if (restocking) return;
    setRestocking(id);
    try {
      await api(`/api/owner/dishes/${id}`, { method: "PATCH", body: JSON.stringify({ stockDelta: amount }) });
      toast(`Restocked ${name} (+${amount})`, "success");
      await live.refresh();
    } catch (err) {
      toast(errorMessage(err, "Couldn't restock"), "error");
    } finally {
      setRestocking(null);
    }
  }

  if (live.loading && !live.data) return <Loading label="Crunching the numbers…" />;
  if (!live.data) return <ErrorState message={errorMessage(live.error)} onRetry={() => void live.refresh()} />;

  const data = live.data;
  const { today, tomorrow } = data;
  const atRisk = data.dishes.filter((d) => d.risk !== "OK");

  return (
    <div>
      <PageHeader
        eyebrow="Demand insights"
        title={
          <>
            Busy hours <span className="italic text-forest-700">&amp; best sellers</span>
          </>
        }
        lede={`Forecast from the last ${data.history_days} days of orders, weighted towards ${WEEKDAY_FULL[today.weekday]}s. Times are pickup times, when food needs to be ready.`}
      />

      {!data.has_history ? (
        <EmptyState icon="📈" title="Not enough history yet">
          Forecasts appear once a few days of orders have been collected.
        </EmptyState>
      ) : (
        <>
          {/* Headline figures */}
          <dl className="mb-16 grid animate-rise grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-cream-300">
            <div className="sm:pr-8">
              <dt className="text-sm text-ink-muted">Orders expected today</dt>
              <dd className="mt-2 text-5xl font-semibold tracking-tight text-ink sm:text-6xl">~{today.expected_total}</dd>
              <dd className="mt-2 text-sm text-ink-muted">{today.actual_so_far} so far</dd>
            </div>
            <div className="sm:px-8">
              <dt className="text-sm text-ink-muted">{today.next_peak ? "Next rush" : "Today's rush"}</dt>
              <dd className="mt-2 font-display text-3xl font-normal text-ink">
                {today.next_peak ? windowLabel(today.next_peak) : "Done for today"}
              </dd>
              {today.next_peak && <dd className="mt-2 text-sm text-ink-muted">~{Math.round(today.next_peak.expected)} orders</dd>}
            </div>
            <div className="sm:pl-8">
              <dt className="text-sm text-ink-muted">Tomorrow ({WEEKDAY_FULL[tomorrow.weekday]})</dt>
              <dd className="mt-2 font-display text-3xl font-normal text-ink">
                {tomorrow.peaks[0] ? windowLabel(tomorrow.peaks[0]) : "Quiet day"}
              </dd>
              <dd className="mt-2 text-sm text-ink-muted">~{tomorrow.expected_total} orders expected</dd>
            </div>
          </dl>

          <HourlyChart hourly={today.hourly} peaks={today.peaks} hourNow={today.hour_now} />

          <div className="mt-20 grid grid-cols-1 gap-16 lg:grid-cols-[1fr_22rem]">
            {/* Dishes */}
            <section className="animate-rise">
              <SectionTitle aside={atRisk.length > 0 ? `${atRisk.length} may run out` : "Stock looks fine"}>
                Expected demand by dish
              </SectionTitle>
              <DishList dishes={data.dishes} onRestock={restock} restocking={restocking} />
            </section>

            {/* Weekly pattern */}
            <section className="animate-rise [animation-delay:120ms]">
              <SectionTitle>Busiest days</SectionTitle>
              <WeekChart weekdays={data.weekdays} today={today.weekday} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function HourlyChart({
  hourly,
  peaks,
  hourNow,
}: {
  hourly: Insights["today"]["hourly"];
  peaks: PeakWindow[];
  hourNow: number;
}) {
  const active = hourly.filter((h) => h.expected > 0 || h.actual > 0);
  if (active.length === 0) return null;
  const from = Math.min(...active.map((h) => h.hour));
  const to = Math.max(...active.map((h) => h.hour));
  const hours = hourly.filter((h) => h.hour >= from && h.hour <= to);
  const max = niceMax(Math.max(...hours.map((h) => Math.max(h.expected, h.actual))));
  const ticks = [0, max / 2, max];
  const isPeak = (hour: number) => peaks.some((p) => hour >= p.startHour && hour < p.endHour);

  return (
    <section className="animate-rise [animation-delay:80ms]" aria-label="Expected orders by hour today">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-xl font-normal text-ink">Orders by pickup hour, today</h2>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted" aria-label="Legend">
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: BAR }} aria-hidden /> Expected
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: BAR_PEAK }} aria-hidden /> Peak hours
          </li>
          <li className="flex items-center gap-2">
            <span className="h-[2px] w-4 rounded-full bg-ink" aria-hidden /> Today so far
          </li>
        </ul>
      </div>

      <div className="relative h-64 pl-8" aria-hidden>
        {/* Gridlines + y ticks */}
        {ticks.map((t) => (
          <div key={t} className="absolute left-8 right-0 border-t border-cream-300" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -left-8 -translate-y-1/2 text-[0.65rem] tabular-nums text-ink-faint">{t}</span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-[2px]">
          {hours.map((h) => {
            const peak = isPeak(h.hour);
            const label = `${hourLabel(h.hour)}: ~${h.expected} expected, ${h.actual} so far`;
            return (
              <div
                key={h.hour}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
                tabIndex={0}
                aria-label={label}
              >
                <div
                  className="w-full max-w-6 rounded-t-[4px] transition-[height,opacity] duration-700 ease-[var(--ease-out-soft)] group-hover:opacity-80"
                  style={{ height: `${(h.expected / max) * 100}%`, background: peak ? BAR_PEAK : BAR }}
                />
                {h.actual > 0 && (
                  <span
                    className="absolute h-[2px] w-[calc(min(100%,1.5rem)+6px)] rounded-full bg-ink shadow-[0_0_0_2px_var(--color-cream-100)]"
                    style={{ bottom: `calc(${(h.actual / max) * 100}% - 1px)` }}
                  />
                )}
                {peak && !isPeak(h.hour - 1) && (
                  <span
                    className="absolute whitespace-nowrap text-[0.65rem] font-semibold text-ink-soft"
                    style={{ bottom: `calc(${(h.expected / max) * 100}% + 6px)` }}
                  >
                    Peak
                  </span>
                )}
                {/* Tooltip */}
                <span className="pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-xl bg-forest-900 px-3 py-2 text-left text-xs text-cream-100 shadow-lift group-hover:block group-focus-visible:block">
                  <span className="block font-semibold">{hourLabel(h.hour)}</span>
                  <span className="block">~{h.expected} expected</span>
                  <span className="block text-forest-200">{h.actual} so far</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* X axis */}
      <div className="mt-2 flex gap-[2px] pl-8 text-[0.65rem] text-ink-faint" aria-hidden>
        {hours.map((h, i) => (
          <span key={h.hour} className={`flex-1 text-center ${h.hour === hourNow ? "font-semibold text-forest-700" : ""}`}>
            {h.hour === hourNow ? "Now" : i % 2 === 0 ? hourLabel(h.hour).replace(" ", "") : ""}
          </span>
        ))}
      </div>

      <details className="mt-6 text-sm text-ink-muted">
        <summary className="cursor-pointer select-none text-xs font-semibold text-ink-soft hover:text-forest-700">View as table</summary>
        <table className="mt-4 w-full max-w-md text-left text-sm">
          <thead>
            <tr className="border-b border-cream-300 text-xs text-ink-muted">
              <th className="py-2 font-semibold">Hour</th>
              <th className="py-2 text-right font-semibold">Expected</th>
              <th className="py-2 text-right font-semibold">So far</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h.hour} className="border-b border-cream-200">
                <td className="py-1.5 text-ink">
                  {hourLabel(h.hour)}
                  {isPeak(h.hour) && <span className="ml-2 text-xs text-ink-muted">peak</span>}
                </td>
                <td className="py-1.5 text-right tabular-nums text-ink">{h.expected}</td>
                <td className="py-1.5 text-right tabular-nums text-ink">{h.actual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function WeekChart({ weekdays, today }: { weekdays: Insights["weekdays"]; today: number }) {
  // Monday-first reads naturally for a college week.
  const order = [1, 2, 3, 4, 5, 6, 0].map((d) => weekdays[d]);
  const max = Math.max(1, ...order.map((d) => d.avg));
  const busiest = order.reduce((a, b) => (b.avg > a.avg ? b : a));
  return (
    <div>
      <div className="flex h-44 items-end gap-[2px]" role="img" aria-label={`Average orders per day. Busiest: ${WEEKDAY_FULL[busiest.weekday]}.`}>
        {order.map((d) => {
          const strong = d.weekday === today;
          const labelled = d.weekday === busiest.weekday || strong;
          return (
            <div key={d.weekday} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${WEEKDAY_FULL[d.weekday]}: ~${d.avg} orders`}>
              {labelled && <span className="mb-1 text-[0.7rem] font-semibold tabular-nums text-ink-soft">{Math.round(d.avg)}</span>}
              <div
                className="w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                style={{ height: `${(d.avg / max) * 85}%`, background: strong ? BAR_PEAK : BAR }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px] text-[0.65rem] text-ink-faint">
        {order.map((d) => (
          <span key={d.weekday} className={`flex-1 text-center ${d.weekday === today ? "font-semibold text-forest-700" : ""}`}>
            {d.weekday === today ? "Today" : WEEKDAYS[d.weekday]}
          </span>
        ))}
      </div>
      <p className="mt-5 text-sm leading-relaxed text-ink-muted">
        {WEEKDAY_FULL[busiest.weekday]}s are busiest, averaging ~{Math.round(busiest.avg)} orders. Weekends are much quieter, so stock lighter.
      </p>
    </div>
  );
}

function DishList({
  dishes,
  onRestock,
  restocking,
}: {
  dishes: Insights["dishes"];
  onRestock: (id: string, name: string, amount: number) => void;
  restocking: string | null;
}) {
  const max = Math.max(1, ...dishes.map((d) => d.expected_today));
  return (
    <ol className="stagger">
      {dishes.map((d, i) => (
        <li
          key={d.id}
          style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 border-b border-cream-200 py-4"
        >
          <DishThumb name={d.name} emoji={d.emoji} size="h-11 w-11" className="row-span-2" />
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="truncate font-semibold text-ink">{d.name}</span>
            <span className="shrink-0 text-sm tabular-nums text-ink-soft">~{Math.round(d.expected_today)} today</span>
          </div>
          <div className="row-span-2 flex flex-col items-end gap-1 text-right">
            <StockStatus d={d} />
            {d.risk !== "OK" && d.restock > 0 && (
              <button
                onClick={() => onRestock(d.id, d.name, d.restock)}
                disabled={restocking !== null}
                className="rounded-full border border-cream-400 px-3 py-1 text-[0.7rem] font-semibold text-forest-700 transition-colors hover:border-forest-500 hover:bg-forest-50 disabled:opacity-50"
              >
                {restocking === d.id ? "Restocking…" : `Restock +${d.restock}`}
              </button>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-200" aria-hidden>
              <span
                className="block h-full origin-left animate-[grow_1s_var(--ease-out-soft)_both] rounded-full"
                style={{ width: `${(d.expected_today / max) * 100}%`, background: BAR, animationDelay: `${150 + i * 50}ms` }}
              />
            </span>
            <Trend pct={d.trend_pct} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="w-24 shrink-0 text-right text-xs text-ink-faint">new this week</span>;
  const flat = Math.abs(pct) < 5;
  const arrow = flat ? "→" : pct > 0 ? "↑" : "↓";
  return (
    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-ink-muted" title="Last 7 days vs the 7 before">
      <span aria-hidden>{arrow}</span> {flat ? "steady" : `${pct > 0 ? "+" : ""}${pct}% wk`}
    </span>
  );
}

function StockStatus({ d }: { d: Insights["dishes"][number] }) {
  if (d.risk === "OUT") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-terra-600">
        <span aria-hidden>⊘</span> Sold out
      </span>
    );
  }
  if (d.risk === "LOW") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-terra-600" title={`~${d.expected_remaining} more expected today`}>
        <span aria-hidden>⚠</span> {d.stock} left · may run out
      </span>
    );
  }
  return <span className="text-xs tabular-nums text-ink-muted">{d.stock} in stock</span>;
}
