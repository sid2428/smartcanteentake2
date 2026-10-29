"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/domain";

type Stats = {
  today: {
    ordersCount: number;
    revenuePaise: number;
    ticketsRedeemed: number;
    ticketsActive: number;
    ticketsExpired: number;
  };
  topDishes: {
    dish_name: string;
    total_qty: string;
    total_paise: string;
  }[];
};

export default function OwnerDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("/api/owner/stats")
      .then(setStats)
      .catch((err) => console.error(err));
  }, []);

  async function handleGenerateSlots() {
    setGeneratingSlots(true);
    setGenMessage(null);
    try {
      const res = await api<{ ok: boolean; created: number }>("/api/slots/generate", {
        method: "POST",
      });
      setGenMessage(`Success! Generated ${res.created} new pickup slots for today & tomorrow.`);
    } catch (err) {
      setGenMessage(err instanceof Error ? err.message : "Failed to generate slots");
    } finally {
      setGeneratingSlots(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Canteen Overview</h2>
          <p className="text-sm text-zinc-500">Today&apos;s real-time operations & sales</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={generatingSlots}
            onClick={handleGenerateSlots}
          >
            {generatingSlots ? "Generating Slots…" : "🔄 Populate Daily Slots"}
          </Button>
          <Link href="/kitchen">
            <Button>Go to Kitchen 👨‍🍳</Button>
          </Link>
        </div>
      </div>

      {genMessage && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          {genMessage}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Today Revenue
            </span>
            <div className="mt-1 text-2xl font-bold text-orange-600">
              {formatINR(stats?.today.revenuePaise || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Paid Orders
            </span>
            <div className="mt-1 text-2xl font-bold">
              {stats?.today.ordersCount || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Active In Kitchen
            </span>
            <div className="mt-1 text-2xl font-bold text-blue-600">
              {stats?.today.ticketsActive || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Redeemed / Served
            </span>
            <div className="mt-1 text-2xl font-bold text-green-600">
              {stats?.today.ticketsRedeemed || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Dishes */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Dishes Today</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topDishes && stats.topDishes.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {stats.topDishes.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{d.dish_name}</span>
                    <span className="text-zinc-500">
                      {d.total_qty} sold ({formatINR(parseInt(d.total_paise, 10))})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-zinc-400">No orders recorded yet today.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/owner/dishes" className="block">
              <Button variant="outline" className="w-full justify-start text-left">
                🍛 Edit Dishes & Stock
              </Button>
            </Link>
            <Link href="/owner/settings" className="block">
              <Button variant="outline" className="w-full justify-start text-left">
                ⚙️ Timings, Slots & Refund Policy
              </Button>
            </Link>
            <Link href="/owner/refunds" className="block">
              <Button variant="outline" className="w-full justify-start text-left">
                💰 View Refund History
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
