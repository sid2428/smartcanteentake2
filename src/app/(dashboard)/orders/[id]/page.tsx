"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { useLive } from "@/lib/use-live";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_COLOR } from "@/components/ui/badge";
import { Loading, Arrow, ErrorState, LiveIndicator } from "@/components/ui/page";
import { DishThumb } from "@/components/dish-photo";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatTime, formatDay, type OrderStage } from "@/lib/domain";

type Stage = OrderStage | "CANCELLED" | "EXPIRED";

type OrderDetail = {
  id: string;
  code: string;
  status: string;
  total_paise: number;
  hold_expires_at: string;
  created_at: string;
  items: {
    id: string;
    dish_id: string;
    dish_name: string;
    emoji: string;
    qty: number;
    unit_paise: number;
    counter: string;
    is_veg: boolean;
  }[];
  slot?: {
    starts_at: string;
    ends_at: string;
  };
  tickets: {
    id: string;
    dish_id: string;
    dish_name: string;
    counter: string;
    qty: number;
    status: string;
    ready_estimate_at: string | null;
    ahead: number | null;
  }[];
  tracking: {
    stage: Stage;
    ready_estimate_at: string | null;
    running_late: boolean;
    ahead: number;
    server_time: string;
  };
};

const STEPS: { stage: OrderStage; label: string }[] = [
  { stage: "PLACED", label: "Placed" },
  { stage: "PAID", label: "Paid" },
  { stage: "PREPARING", label: "Cooking" },
  { stage: "READY", label: "Ready" },
  { stage: "COLLECTED", label: "Collected" },
];

const TERMINAL: Stage[] = ["COLLECTED", "CANCELLED", "EXPIRED"];

/** Ticks every second, for countdowns. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function minutesUntil(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.max(1, Math.ceil((new Date(iso).getTime() - now) / 60_000));
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const router = useRouter();
  const { add, updateQty } = useCart();
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const busy = useRef(false);
  const now = useNow();

  const [done, setDone] = useState(false);
  const live = useLive(
    async () => {
      const res = await api<{ order: OrderDetail }>(`/api/orders/${id}`);
      // Stop polling once nothing else can change.
      if (TERMINAL.includes(res.order.tracking.stage)) setDone(true);
      return res.order;
    },
    { intervalMs: 5_000, enabled: !done },
  );
  const order = live.data;
  const fatal = live.error instanceof ApiError && (live.error.status === 404 || live.error.status === 403);

  // When the payment window closes on screen, fetch again so the expiry shows without a reload.
  const holdMs = order ? new Date(order.hold_expires_at).getTime() - now : 0;
  const isPending = order?.status === "PENDING_PAYMENT";
  const holdLapsed = isPending && holdMs <= 0;
  const { refresh } = live;
  useEffect(() => {
    if (holdLapsed) void refresh();
  }, [holdLapsed, refresh]);

  async function run(kind: "pay" | "decline" | "cancel") {
    if (busy.current) return;
    busy.current = true;
    if (kind === "cancel") setCancelling(true);
    else setPaying(true);
    try {
      if (kind === "cancel") {
        await api(`/api/orders/${id}/cancel`, { method: "POST" });
        toast("Order cancelled", "info");
      } else {
        await api(`/api/orders/${id}/pay`, {
          method: "POST",
          body: JSON.stringify({ simulate: kind === "decline" ? "declined" : "success" }),
        });
        toast("Payment successful! Tickets generated.", "success");
      }
    } catch (err) {
      const fallback = kind === "cancel" ? "Failed to cancel" : "Payment failed";
      // A network error mid-payment may still have gone through; the refresh below shows the truth.
      const msg =
        err instanceof ApiError && err.isNetwork && kind !== "cancel"
          ? "We lost connection while paying. Checking whether it went through…"
          : errorMessage(err, fallback);
      toast(msg, "error");
    } finally {
      busy.current = false;
      setPaying(false);
      setCancelling(false);
      setDone(false);
      await refresh();
    }
  }

  function orderAgain() {
    if (!order) return;
    for (const item of order.items) {
      add({ dishId: item.dish_id, name: item.dish_name, emoji: item.emoji, pricePaise: item.unit_paise, isVeg: item.is_veg });
      updateQty(item.dish_id, item.qty);
    }
    toast("Added to your tray. Pick a new pickup time.", "success");
    router.push("/menu");
  }

  if (!order) {
    if (live.loading) return <Loading label="Loading order details…" />;
    return (
      <ErrorState
        title={fatal ? "Order not found" : "We couldn't load this order"}
        message={fatal ? "It may belong to another account, or the demo data was reset." : errorMessage(live.error)}
        onRetry={fatal ? undefined : () => void refresh()}
      />
    );
  }

  const { tracking } = order;
  const stage = tracking.stage;
  const stepIndex = STEPS.findIndex((s) => s.stage === stage);
  const etaMin = minutesUntil(tracking.ready_estimate_at, now);
  const holdLeft = Math.max(0, Math.floor(holdMs / 1000));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link
          href="/orders"
          className="inline-flex animate-fade items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-forest-700"
        >
          <Arrow className="h-4 w-4 rotate-180" /> All orders
        </Link>
        {!TERMINAL.includes(stage) && <LiveIndicator stale={live.stale} />}
      </div>

      {/* Headline */}
      <section className="animate-rise">
        <p className="eyebrow mb-3">Order Reference</p>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-mono text-5xl font-semibold tracking-[0.18em] text-ink sm:text-6xl">{order.code}</h1>
          <Badge color={STATUS_COLOR[order.status] || "gray"}>{order.status}</Badge>
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          Placed {formatDay(order.created_at)} at {formatTime(order.created_at)}
        </p>
      </section>

      {/* Progress */}
      {stage !== "CANCELLED" && stage !== "EXPIRED" && (
        <section className="mt-12 animate-rise [animation-delay:60ms]" aria-label="Order progress">
          <ol className="relative grid grid-cols-5">
            <span className="absolute left-[10%] right-[10%] top-[0.6rem] h-[2px] rounded-full bg-cream-300" aria-hidden />
            <span
              className="absolute left-[10%] top-[0.6rem] h-[2px] rounded-full bg-forest-600 transition-[width] duration-1000 ease-[var(--ease-out-soft)]"
              style={{ width: `${(Math.max(0, stepIndex) / (STEPS.length - 1)) * 80}%` }}
              aria-hidden
            />
            {STEPS.map((s, i) => {
              const reached = i <= stepIndex;
              const current = i === stepIndex;
              return (
                <li key={s.stage} className="relative flex flex-col items-center gap-3 text-center" aria-current={current ? "step" : undefined}>
                  <span
                    className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-500 ${
                      reached ? "bg-forest-600" : "bg-cream-300"
                    }`}
                  >
                    {current && !TERMINAL.includes(stage) && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-forest-400 opacity-60" />
                    )}
                    {reached && <span className="h-1.5 w-1.5 rounded-full bg-cream-50" />}
                  </span>
                  <span className={`text-[0.7rem] font-semibold sm:text-xs ${current ? "text-forest-800" : reached ? "text-ink-soft" : "text-ink-faint"}`}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_24rem] lg:gap-16">
        {/* Items, each with its own live status */}
        <section className="animate-rise [animation-delay:100ms]">
          <h2 className="border-b border-cream-300 pb-3 font-display text-xl font-normal text-ink">Items Ordered</h2>
          <ul className="divide-y divide-cream-200">
            {order.items.map((item) => {
              const ticket = order.tickets.find((t) => t.dish_id === item.dish_id);
              const itemEta = ticket && ticket.status !== "READY" ? minutesUntil(ticket.ready_estimate_at, now) : null;
              return (
                <li key={item.id} className="flex items-center gap-4 py-5">
                  <DishThumb name={item.dish_name} emoji={item.emoji} size="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg text-ink">{item.dish_name}</p>
                    <p className="text-xs text-ink-muted">
                      Counter: {item.counter}
                      {order.status === "PAID" && itemEta !== null && <span className="text-forest-700"> · ~{itemEta} min</span>}
                    </p>
                    {ticket && order.status !== "PENDING_PAYMENT" && (
                      <Badge key={ticket.status} color={STATUS_COLOR[ticket.status] || "gray"} className="mt-2 animate-pop">
                        {ticket.status}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink">{formatINR(item.unit_paise * item.qty)}</p>
                    <p className="text-xs text-ink-muted">
                      {formatINR(item.unit_paise)} × {item.qty}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-baseline justify-between border-t border-cream-300 pt-5">
            <span className="text-sm font-semibold text-ink-soft">Total</span>
            <span className="font-display text-4xl text-forest-700">{formatINR(order.total_paise)}</span>
          </div>
        </section>

        {/* Live status + actions */}
        <aside className="flex animate-rise flex-col gap-6 [animation-delay:140ms]">
          {(stage === "PAID" || stage === "PREPARING") && (
            <div className="relative overflow-hidden rounded-[2rem] bg-forest-800 p-7 text-cream-50" aria-live="polite">
              <Rings />
              <p className="eyebrow relative !text-terra-200">{stage === "PREPARING" ? "Cooking now" : "In the queue"}</p>
              {etaMin !== null ? (
                <>
                  <p className="relative mt-4 font-display text-5xl font-light">
                    ~{etaMin} <span className="text-2xl text-forest-200">min</span>
                  </p>
                  <p className="relative mt-2 text-sm text-forest-200">
                    Estimated ready around {formatTime(tracking.ready_estimate_at!)}
                    {tracking.ahead > 0 && ` · ${tracking.ahead} ${tracking.ahead === 1 ? "dish" : "dishes"} ahead of yours`}
                  </p>
                </>
              ) : (
                <p className="relative mt-4 font-display text-3xl font-light">Almost ready</p>
              )}
              {order.slot && (
                <p className="relative mt-6 border-t border-forest-600 pt-4 text-sm text-forest-100">
                  Pickup slot {formatTime(order.slot.starts_at)} – {formatTime(order.slot.ends_at)}, {formatDay(order.slot.starts_at)}
                  {tracking.running_late && (
                    <span className="mt-2 block text-terra-200">The kitchen is busy right now, so this may run a little past your slot.</span>
                  )}
                </p>
              )}
            </div>
          )}

          {stage === "READY" && (
            <div className="rounded-[2rem] bg-forest-50 p-7 ring-1 ring-inset ring-forest-100" aria-live="polite">
              <CheckBadge />
              <p className="mt-4 font-display text-2xl text-forest-800">Ready at the counter</p>
              <p className="mt-2 text-sm leading-relaxed text-forest-700/80">Show your QR ticket at the counter to collect.</p>
              <Link href="/tickets" className="mt-6 block">
                <Button size="lg" className="w-full">
                  Show my QR <Arrow />
                </Button>
              </Link>
            </div>
          )}

          {stage === "COLLECTED" && (
            <div className="rounded-[2rem] bg-cream-50 p-7 shadow-soft">
              <CheckBadge />
              <p className="mt-4 font-display text-2xl text-ink">Collected. Enjoy your meal!</p>
              <Button variant="outline" className="mt-6 w-full" onClick={orderAgain}>
                Order this again
              </Button>
            </div>
          )}

          {(stage === "CANCELLED" || stage === "EXPIRED") && (
            <div className="rounded-[2rem] bg-terra-50 p-7 ring-1 ring-inset ring-terra-100">
              <p className="font-display text-2xl text-terra-700">
                {stage === "CANCELLED" ? "This order was cancelled" : "This order wasn't collected"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-terra-700/80">
                {stage === "CANCELLED"
                  ? "Nothing was charged, and the items went back on the menu."
                  : "The pickup window passed. Any refund due has been recorded automatically."}
              </p>
              <Button className="mt-6 w-full" onClick={orderAgain}>
                Order again
              </Button>
            </div>
          )}

          {isPending && order.slot && (
            <div className="relative overflow-hidden rounded-[2rem] bg-forest-800 p-7 text-cream-50">
              <Rings />
              <p className="eyebrow relative !text-terra-200">Pickup Time</p>
              <p className="relative mt-4 font-display text-4xl font-light">
                {formatTime(order.slot.starts_at)}
                <span className="text-forest-300"> – {formatTime(order.slot.ends_at)}</span>
              </p>
              <p className="relative mt-2 text-sm text-forest-200">{formatDay(order.slot.starts_at)}</p>
            </div>
          )}

          {isPending && (
            <div className="rounded-[2rem] bg-terra-50 p-7 ring-1 ring-inset ring-terra-100">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-display text-xl text-terra-700">Almost there</p>
                <span
                  className={`font-mono text-sm tabular-nums ${holdLeft < 60 ? "text-terra-600" : "text-terra-700/70"}`}
                  aria-label="Time left to pay"
                >
                  {Math.floor(holdLeft / 60)}:{String(holdLeft % 60).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-terra-700/80">
                Slot and items held. Please complete payment before hold expires.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Button size="lg" className="w-full" disabled={paying || cancelling || holdLapsed} onClick={() => run("pay")}>
                  {paying ? "Processing UPI…" : "Pay with UPI / QR"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={paying || cancelling}
                  onClick={() => run("cancel")}
                  className="w-full hover:!bg-terra-100 hover:!text-terra-700"
                >
                  {cancelling ? "Cancelling…" : "Cancel order"}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => run("decline")}
                disabled={paying || cancelling || holdLapsed}
                className="mt-4 w-full text-center text-[0.7rem] text-terra-700/60 underline-offset-4 hover:underline disabled:opacity-40"
              >
                Demo: simulate a declined payment
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Rings() {
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 text-forest-700" aria-hidden>
      <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CheckBadge() {
  return (
    <span className="flex h-12 w-12 animate-pop items-center justify-center rounded-full bg-forest-600 text-cream-50" aria-hidden>
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m5 10.5 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
