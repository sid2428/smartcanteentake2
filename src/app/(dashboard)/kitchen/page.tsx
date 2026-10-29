"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
};

export default function KitchenDashboard() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [counterFilter, setCounterFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchTickets() {
      try {
        const res = await api<{ tickets: KitchenTicket[] }>(
          `/api/kitchen/tickets?counter=${encodeURIComponent(counterFilter)}`
        );
        if (!cancelled) setTickets(res.tickets);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTickets();
    const interval = setInterval(fetchTickets, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [counterFilter, reloadKey]);

  async function updateStatus(id: string, nextStatus: "ISSUED" | "PREPARING" | "READY") {
    try {
      await api(`/api/kitchen/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      toast(`Ticket marked as ${nextStatus}`, "success");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update status", "error");
    }
  }

  const issued = tickets.filter((t) => t.status === "ISSUED");
  const preparing = tickets.filter((t) => t.status === "PREPARING");
  const ready = tickets.filter((t) => t.status === "READY");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Kitchen Orders Board</h2>
          <p className="text-sm text-zinc-500">Live ticket queue updating every 5s</p>
        </div>

        <div className="flex gap-2">
          {["All", ...COUNTERS].map((c) => (
            <button
              key={c}
              onClick={() => setCounterFilter(c)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                counterFilter === c
                  ? "bg-orange-600 text-white"
                  : "border border-canteen-200 bg-white text-slate-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500">Loading tickets…</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Incoming / Issued Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-blue-600 dark:text-blue-400">
                Incoming ({issued.length})
              </h3>
            </div>
            <div className="space-y-3">
              {issued.map((t) => (
                <Card key={t.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">#{t.order_code}</span>
                      <span className="text-xs text-zinc-400">Slot: {formatTime(t.slot_starts_at)}</span>
                    </div>
                    <div className="my-2 flex items-center gap-2">
                      <span className="text-2xl">{t.emoji}</span>
                      <div className="font-semibold">
                        {t.dish_name} <span className="text-orange-600 font-bold">×{t.qty}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-2">
                      <Badge color="blue">{t.counter}</Badge>
                      <Button size="sm" onClick={() => updateStatus(t.id, "PREPARING")}>
                        Start Preparing ➔
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {issued.length === 0 && (
                <div className="py-8 text-center text-xs text-zinc-400">No new incoming orders</div>
              )}
            </div>
          </div>

          {/* Preparing Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-amber-600 dark:text-amber-400">
                Cooking ({preparing.length})
              </h3>
            </div>
            <div className="space-y-3">
              {preparing.map((t) => (
                <Card key={t.id} className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">#{t.order_code}</span>
                      <span className="text-xs text-zinc-400">Slot: {formatTime(t.slot_starts_at)}</span>
                    </div>
                    <div className="my-2 flex items-center gap-2">
                      <span className="text-2xl">{t.emoji}</span>
                      <div className="font-semibold">
                        {t.dish_name} <span className="text-orange-600 font-bold">×{t.qty}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => updateStatus(t.id, "ISSUED")}
                      >
                        ↩ Back
                      </Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus(t.id, "READY")}>
                        Mark Ready ✓
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {preparing.length === 0 && (
                <div className="py-8 text-center text-xs text-zinc-400">No dishes currently cooking</div>
              )}
            </div>
          </div>

          {/* Ready for Pickup Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-green-600 dark:text-green-400">
                Ready at Counter ({ready.length})
              </h3>
            </div>
            <div className="space-y-3">
              {ready.map((t) => (
                  <Card key={t.id} className="border-l-4 border-l-green-500 bg-veg-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">#{t.order_code}</span>
                      <Badge color="green">Ready</Badge>
                    </div>
                    <div className="my-2 flex items-center gap-2">
                      <span className="text-2xl">{t.emoji}</span>
                      <div className="font-semibold">
                        {t.dish_name} <span className="text-orange-600 font-bold">×{t.qty}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      Counter: {t.counter}. Waiting for student to scan QR code at counter.
                    </p>
                  </CardContent>
                </Card>
              ))}
              {ready.length === 0 && (
                <div className="py-8 text-center text-xs text-zinc-400">No items waiting for pickup</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
