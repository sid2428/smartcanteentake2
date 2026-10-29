"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, STATUS_COLOR } from "@/components/ui/badge";
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
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ orders: OrderSummary[] }>("/api/orders")
      .then((res) => setOrders(res.orders))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-zinc-500">Loading your orders…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <p className="mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">Order history</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Your orders</h1>
        <p className="mt-1 text-sm text-slate-500">Track payments, preparation and pickup in one place.</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-zinc-500">
            You haven&apos;t placed any orders yet.{" "}
            <Link href="/menu" className="text-orange-600 hover:underline">
              Go to Menu
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card className="transition-shadow hover:border-orange-300 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold">{o.code}</span>
                        <Badge color={STATUS_COLOR[o.status] || "gray"}>{o.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {formatDay(o.created_at)} at {formatTime(o.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-600">{formatINR(o.total_paise)}</div>
                      <div className="text-xs text-zinc-400">
                        {o.items?.reduce((acc, curr) => acc + curr.qty, 0) || 0} items
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    {o.items?.map((item) => (
                      <span
                        key={item.id}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {item.emoji} {item.dish_name} × {item.qty}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
