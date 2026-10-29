"use client";

import Link from "next/link";
import { api, errorMessage } from "@/lib/api-client";
import { useLive } from "@/lib/use-live";
import { Badge, STATUS_COLOR } from "@/components/ui/badge";
import { PageHeader, Loading, EmptyState, ErrorState, Arrow, LiveIndicator } from "@/components/ui/page";
import { DishThumb } from "@/components/dish-photo";
import { formatINR, formatDay, formatTime } from "@/lib/domain";

type OrderSummary = {
  id: string;
  code: string;
  total_paise: number;
  status: string;
  created_at: string;
  items: {
    id: string;
    dish_name: string;
    emoji: string;
    qty: number;
  }[];
};

export default function OrdersListPage() {
  // Statuses change as the kitchen works, so keep the list fresh.
  const live = useLive(async () => (await api<{ orders: OrderSummary[] }>("/api/orders")).orders, { intervalMs: 15_000 });
  const orders = live.data ?? [];

  if (live.loading && !live.data) {
    return <Loading label="Loading your orders…" />;
  }

  if (!live.data) {
    return <ErrorState message={errorMessage(live.error)} onRetry={() => void live.refresh()} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Order history"
        title={
          <>
            Your <span className="italic text-forest-700">orders</span>
          </>
        }
        lede="Every meal you've ordered, newest first. Tap one to track it live, pay, or see pickup details."
        actions={<LiveIndicator stale={live.stale} />}
      />

      {orders.length === 0 ? (
        <EmptyState icon="🧾" title="No orders yet">
          You haven&apos;t placed any orders yet.{" "}
          <Link href="/menu" className="font-semibold text-forest-700 underline-offset-4 hover:underline">
            Go to Menu
          </Link>
        </EmptyState>
      ) : (
        <ul className="stagger border-t border-cream-300">
          {orders.map((o, i) => {
            const count = o.items?.reduce((acc, curr) => acc + curr.qty, 0) || 0;
            return (
              <li key={o.id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties} className="border-b border-cream-300">
                <Link
                  href={`/orders/${o.id}`}
                  className="group -mx-4 flex flex-col gap-4 rounded-3xl px-4 py-6 transition-colors duration-300 hover:bg-cream-50 sm:flex-row sm:items-center sm:gap-6"
                >
                  <span className="flex -space-x-4">
                    {o.items?.slice(0, 3).map((item) => (
                      <DishThumb
                        key={item.id}
                        name={item.dish_name}
                        emoji={item.emoji}
                        size="h-14 w-14"
                        className="ring-4 ring-cream-100 transition-transform duration-500 group-hover:-translate-y-0.5"
                      />
                    ))}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-base font-semibold tracking-widest text-ink">{o.code}</span>
                      <Badge color={STATUS_COLOR[o.status] || "gray"}>{o.status}</Badge>
                    </div>
                    <p className="mt-1.5 truncate text-sm text-ink-muted">
                      {o.items?.map((item) => `${item.dish_name} × ${item.qty}`).join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      {formatDay(o.created_at)} at {formatTime(o.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <div className="sm:text-right">
                      <div className="font-display text-2xl text-ink">{formatINR(o.total_paise)}</div>
                      <div className="text-xs text-ink-muted">{count} items</div>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-300 text-ink-muted transition-all duration-300 group-hover:border-forest-700 group-hover:bg-forest-700 group-hover:text-cream-50">
                      <Arrow />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
