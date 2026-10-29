"use client";

import { useState, type ReactNode } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { useLive } from "@/lib/use-live";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, ErrorState, LiveIndicator } from "@/components/ui/page";
import { DishThumb } from "@/components/dish-photo";
import { useToast } from "@/components/ui/toast";
import { COUNTERS, formatTime } from "@/lib/domain";

type KitchenTicket = {
  id: string;
  order_code: string;
  dish_name: string;
  emoji: string;
  qty: number;
  counter: string;
  status: "ISSUED" | "PREPARING" | "READY";
  slot_starts_at: string;
  created_at: string;
  ready_estimate_at: string | null;
  at_risk: boolean;
};

type CounterLoad = { counter: string; waiting: number; cooking: number; backlogMinutes: number };

export default function KitchenDashboard() {
  const { toast } = useToast();
  const [counterFilter, setCounterFilter] = useState<string>("All");
  // Tickets with a status change in flight: their buttons are disabled so a double tap sends one request.
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  const live = useLive(
    () =>
      api<{ tickets: KitchenTicket[]; loads: CounterLoad[] }>(
        `/api/kitchen/tickets?counter=${encodeURIComponent(counterFilter)}`,
      ),
    { intervalMs: 5_000, key: counterFilter },
  );
  const tickets = live.data?.tickets ?? [];
  const loads = live.data?.loads ?? [];
  const loading = live.loading && !live.data;

  async function updateStatus(id: string, nextStatus: "ISSUED" | "PREPARING" | "READY") {
    if (pending.has(id)) return;
    setPending((prev) => new Set(prev).add(id));
    try {
      await api(`/api/kitchen/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      toast(`Ticket marked as ${nextStatus}`, "success");
    } catch (err) {
      toast(errorMessage(err, "Failed to update status"), "error");
    } finally {
      await live.refresh();
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const issued = tickets.filter((t) => t.status === "ISSUED");
  const preparing = tickets.filter((t) => t.status === "PREPARING");
  const ready = tickets.filter((t) => t.status === "READY");

  return (
    <div>
      <PageHeader
        eyebrow="Kitchen"
        title={
          <>
            Orders <span className="italic text-forest-700">on the pass</span>
          </>
        }
        lede={
          <span className="flex flex-col gap-3">
            <LiveIndicator stale={live.stale} />
            {loads.length > 0 && (
              <span className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
                {loads.map((l) => (
                  <span key={l.counter}>
                    <span className="font-semibold text-ink-soft">{l.counter}</span> · {l.waiting} waiting · {l.cooking} cooking
                    {l.backlogMinutes > 0 && <> · clears in ~{l.backlogMinutes} min</>}
                  </span>
                ))}
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex rounded-full bg-cream-200 p-1" role="tablist" aria-label="Counter">
            {["All", ...COUNTERS].map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={counterFilter === c}
                onClick={() => setCounterFilter(c)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                  counterFilter === c ? "bg-cream-50 text-forest-800 shadow-soft" : "text-ink-muted hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <Loading label="Loading tickets…" />
      ) : !live.data ? (
        <ErrorState message={errorMessage(live.error)} onRetry={() => void live.refresh()} />
      ) : (
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8 xl:gap-12">
          <Lane title="Incoming" count={issued.length} dot="bg-[#5a7b8c]" empty="No new incoming orders">
            {issued.map((t) => (
              <TicketTile key={t.id} t={t}>
                <Button size="sm" className="w-full" disabled={pending.has(t.id)} onClick={() => updateStatus(t.id, "PREPARING")}>
                  Start Preparing →
                </Button>
              </TicketTile>
            ))}
          </Lane>

          <Lane title="Cooking" count={preparing.length} dot="bg-[#c9952c]" empty="No dishes currently cooking">
            {preparing.map((t) => (
              <TicketTile key={t.id} t={t} accent="ring-[#ecd9a8]">
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={pending.has(t.id)} onClick={() => updateStatus(t.id, "ISSUED")}>
                    ↩ Back
                  </Button>
                  <Button size="sm" variant="accent" className="flex-1" disabled={pending.has(t.id)} onClick={() => updateStatus(t.id, "READY")}>
                    Mark Ready ✓
                  </Button>
                </div>
              </TicketTile>
            ))}
          </Lane>

          <Lane title="Ready at Counter" count={ready.length} dot="bg-forest-500" empty="No items waiting for pickup">
            {ready.map((t) => (
              <TicketTile key={t.id} t={t} accent="ring-forest-200" tone="bg-forest-50">
                <p className="text-xs leading-relaxed text-forest-700">
                  Counter: {t.counter}. Waiting for student to scan QR code at counter.
                </p>
              </TicketTile>
            ))}
          </Lane>
        </div>
      )}
    </div>
  );
}

function Lane({
  title,
  count,
  dot,
  empty,
  children,
}: {
  title: string;
  count: number;
  dot: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <section className="animate-rise">
      <div className="mb-5 flex items-end justify-between border-b border-cream-300 pb-3">
        <h2 className="flex items-center gap-2.5 font-display text-xl font-normal text-ink">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
          {title}
        </h2>
        <span key={count} className="animate-pop font-display text-3xl font-light tabular-nums text-ink-muted">
          {count}
        </span>
      </div>
      <div className="stagger flex flex-col gap-4">
        {children.length > 0 ? (
          children
        ) : (
          <p className="rounded-3xl border border-dashed border-cream-300 py-10 text-center text-sm text-ink-faint">{empty}</p>
        )}
      </div>
    </section>
  );
}

function TicketTile({
  t,
  children,
  accent = "ring-cream-200",
  tone = "bg-cream-50",
}: {
  t: KitchenTicket;
  children: ReactNode;
  accent?: string;
  tone?: string;
}) {
  return (
    <article className={`rounded-[1.5rem] p-5 shadow-soft ring-1 ring-inset transition-shadow duration-300 hover:shadow-lift ${tone} ${accent}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono font-semibold tracking-widest text-ink">#{t.order_code}</span>
        <span className="rounded-full bg-cream-200/80 px-2.5 py-1 font-medium text-ink-soft">
          Slot: {formatTime(t.slot_starts_at)}
        </span>
      </div>
      <div className="my-4 flex items-center gap-3">
        <DishThumb name={t.dish_name} emoji={t.emoji} size="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight text-ink">{t.dish_name}</p>
          <p className="text-xs text-ink-muted">{t.counter} counter</p>
        </div>
        <span className="font-display text-3xl font-light text-terra-500">×{t.qty}</span>
      </div>
      {t.status !== "READY" && t.ready_estimate_at && (
        <p className={`-mt-1 mb-3 text-xs ${t.at_risk ? "font-semibold text-terra-600" : "text-ink-muted"}`}>
          {t.at_risk ? "Behind slot · " : ""}Est. ready {formatTime(t.ready_estimate_at)}
        </p>
      )}
      {children}
    </article>
  );
}
