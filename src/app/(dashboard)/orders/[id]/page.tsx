"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_COLOR } from "@/components/ui/badge";
import { Loading, Arrow } from "@/components/ui/page";
import { DishThumb } from "@/components/dish-photo";
import { useToast } from "@/components/ui/toast";
import { formatINR, formatTime, formatDay } from "@/lib/domain";

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
  }[];
  slot?: {
    starts_at: string;
    ends_at: string;
  };
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadOrder() {
      try {
        const res = await api<{ order: OrderDetail }>(`/api/orders/${id}`);
        if (!cancelled) setOrder(res.order);
      } catch (err) {
        if (!cancelled) toast(err instanceof Error ? err.message : "Failed to load order", "error");
      }
    }
    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey, toast]);

  async function handlePay() {
    setPaying(true);
    try {
      await api(`/api/orders/${id}/pay`, { method: "POST" });
      toast("Payment successful! Tickets generated.", "success");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Payment failed", "error");
    } finally {
      setPaying(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await api(`/api/orders/${id}/cancel`, { method: "POST" });
      toast("Order cancelled", "info");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to cancel", "error");
    } finally {
      setCancelling(false);
    }
  }

  if (!order) {
    return <Loading label="Loading order details…" />;
  }

  const isPending = order.status === "PENDING_PAYMENT";
  const isPaid = order.status === "PAID" || order.status === "COMPLETED" || order.status === "CLOSED";

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/orders"
        className="mb-8 inline-flex animate-fade items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-forest-700"
      >
        <Arrow className="h-4 w-4 rotate-180" /> All orders
      </Link>

      <div className="grid gap-12 lg:grid-cols-[1fr_24rem] lg:gap-16">
        {/* Order summary */}
        <section className="animate-rise">
          <p className="eyebrow mb-3">Order Reference</p>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-mono text-5xl font-semibold tracking-[0.18em] text-ink sm:text-6xl">{order.code}</h1>
            <Badge color={STATUS_COLOR[order.status] || "gray"}>{order.status}</Badge>
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Placed {formatDay(order.created_at)} at {formatTime(order.created_at)}
          </p>

          <h2 className="mt-12 border-b border-cream-300 pb-3 font-display text-xl font-normal text-ink">Items Ordered</h2>
          <ul className="stagger divide-y divide-cream-200">
            {order.items.map((item, i) => (
              <li key={item.id} style={{ "--i": i + 2 } as React.CSSProperties} className="flex items-center gap-4 py-5">
                <DishThumb name={item.dish_name} emoji={item.emoji} size="h-16 w-16" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg text-ink">{item.dish_name}</p>
                  <p className="text-xs text-ink-muted">Counter: {item.counter}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink">{formatINR(item.unit_paise * item.qty)}</p>
                  <p className="text-xs text-ink-muted">
                    {formatINR(item.unit_paise)} × {item.qty}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t border-cream-300 pt-5">
            <span className="text-sm font-semibold text-ink-soft">Total</span>
            <span className="font-display text-4xl text-forest-700">{formatINR(order.total_paise)}</span>
          </div>
        </section>

        {/* Pickup + actions */}
        <aside className="flex animate-rise flex-col gap-6 [animation-delay:120ms]">
          {order.slot && (
            <div className="relative overflow-hidden rounded-[2rem] bg-forest-800 p-7 text-cream-50">
              <svg
                viewBox="0 0 200 200"
                className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 text-forest-700"
                aria-hidden
              >
                <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
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
              <p className="font-display text-xl text-terra-700">Almost there</p>
              <p className="mt-2 text-sm leading-relaxed text-terra-700/80">
                Slot and items held. Please complete payment before hold expires.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Button size="lg" className="w-full" disabled={paying} onClick={handlePay}>
                  {paying ? "Processing UPI…" : "Pay with UPI / QR"}
                </Button>
                <Button variant="ghost" disabled={cancelling} onClick={handleCancel} className="w-full hover:!bg-terra-100 hover:!text-terra-700">
                  {cancelling ? "Cancelling…" : "Cancel order"}
                </Button>
              </div>
            </div>
          )}

          {isPaid && (
            <div className="rounded-[2rem] bg-forest-50 p-7 ring-1 ring-inset ring-forest-100">
              <span className="flex h-12 w-12 animate-pop items-center justify-center rounded-full bg-forest-600 text-cream-50" aria-hidden>
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m5 10.5 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="mt-4 font-display text-xl text-forest-800">Payment Received!</p>
              <p className="mt-2 text-sm leading-relaxed text-forest-700/80">
                View your rotating QR tickets to redeem food at the counter.
              </p>
              <Link href="/tickets" className="mt-6 block">
                <Button size="lg" className="w-full">
                  View Active Tickets <Arrow />
                </Button>
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
