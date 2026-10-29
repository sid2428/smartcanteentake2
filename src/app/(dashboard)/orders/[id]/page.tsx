"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, STATUS_COLOR } from "@/components/ui/badge";
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
    return <div className="py-12 text-center text-zinc-500">Loading order details…</div>;
  }

  const isPending = order.status === "PENDING_PAYMENT";
  const isPaid = order.status === "PAID" || order.status === "COMPLETED" || order.status === "CLOSED";

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Order Reference</span>
              <CardTitle className="text-2xl font-mono">{order.code}</CardTitle>
            </div>
            <Badge color={STATUS_COLOR[order.status] || "gray"}>{order.status}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {order.slot && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <span className="font-semibold">Pickup Time: </span>
              {formatDay(order.slot.starts_at)}, {formatTime(order.slot.starts_at)} - {formatTime(order.slot.ends_at)}
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">Items Ordered</h4>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xl">{item.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-medium">{item.dish_name}</div>
                      <div className="text-xs text-zinc-400">Counter: {item.counter}</div>
                    </div>
                  </div>
                    <div className="shrink-0 text-right">
                    <div>{formatINR(item.unit_paise * item.qty)}</div>
                    <div className="text-xs text-zinc-400">
                      {formatINR(item.unit_paise)} × {item.qty}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between border-t border-zinc-200 pt-3 font-bold dark:border-zinc-800">
              <span>Total</span>
              <span className="text-orange-600">{formatINR(order.total_paise)}</span>
            </div>
          </div>

          {isPending && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm text-amber-800">
                ⚠️ Slot and items held. Please complete payment before hold expires.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="flex-1" disabled={paying} onClick={handlePay}>
                  {paying ? "Processing UPI…" : "Pay with UPI / QR"}
                </Button>
                <Button variant="outline" disabled={cancelling} onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isPaid && (
            <div className="rounded-xl border border-green-200 bg-veg-50 p-4 text-center">
              <p className="text-sm font-medium text-green-800">
                Payment Received! View your rotating QR tickets to redeem food at the counter.
              </p>
              <Link href="/tickets">
                <Button className="mt-3">View Active Tickets 🎫</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
