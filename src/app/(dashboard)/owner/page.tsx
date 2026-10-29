"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionTitle, Arrow } from "@/components/ui/page";
import { DishThumb } from "@/components/dish-photo";
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

const MANAGE_LINKS = [
  { href: "/owner/dishes", title: "Edit Dishes & Stock", blurb: "Prices, stock levels and menu visibility", icon: "🍛" },
  { href: "/owner/settings", title: "Timings, Slots & Refund Policy", blurb: "Opening hours, slot capacity, no-show rules", icon: "⏱" },
  { href: "/owner/refunds", title: "View Refund History", blurb: "Expired and uncollected tickets", icon: "₹" },
];

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

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const maxQty = Math.max(1, ...(stats?.topDishes ?? []).map((d) => Number(d.total_qty) || 0));

  const metrics = [
    { label: "Paid Orders", value: stats?.today.ordersCount || 0 },
    { label: "Active In Kitchen", value: stats?.today.ticketsActive || 0 },
    { label: "Redeemed / Served", value: stats?.today.ticketsRedeemed || 0 },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={today}
        title={
          <>
            Canteen <span className="italic text-forest-700">overview</span>
          </>
        }
        lede="Today's real-time operations & sales"
        actions={
          <>
            <Button variant="secondary" disabled={generatingSlots} onClick={handleGenerateSlots}>
              {generatingSlots ? "Generating Slots…" : "↻ Populate Daily Slots"}
            </Button>
            <Link href="/kitchen">
              <Button>
                Go to Kitchen <Arrow />
              </Button>
            </Link>
          </>
        }
      />

      {genMessage && (
        <p className="-mt-6 mb-10 animate-pop rounded-2xl bg-forest-50 px-5 py-3.5 text-sm text-forest-800 ring-1 ring-inset ring-forest-100">
          {genMessage}
        </p>
      )}

      {/* Headline numbers */}
      <section className="relative animate-rise overflow-hidden rounded-[2.25rem] bg-forest-800 px-7 py-10 text-cream-50 sm:px-12 sm:py-14">
        <svg viewBox="0 0 400 400" className="pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] text-forest-700" aria-hidden>
          <circle cx="200" cy="200" r="190" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="200" cy="200" r="90" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_2fr] lg:items-end">
          <div>
            <p className="eyebrow !text-terra-200">Today Revenue</p>
            <p className={`mt-4 font-display text-6xl font-light tracking-tight sm:text-7xl ${stats ? "" : "animate-pulse opacity-50"}`}>
              {formatINR(stats?.today.revenuePaise || 0)}
            </p>
            {stats && stats.today.ticketsExpired > 0 && (
              <p className="mt-3 text-sm text-forest-200">{stats.today.ticketsExpired} tickets expired today</p>
            )}
          </div>
          <dl className="grid grid-cols-3 divide-x divide-forest-600">
            {metrics.map((m) => (
              <div key={m.label} className="px-3 first:pl-0 sm:px-6">
                <dt className="text-[0.7rem] font-medium uppercase leading-snug tracking-[0.12em] text-forest-200">{m.label}</dt>
                <dd className={`mt-2 font-display text-4xl font-light tabular-nums sm:text-5xl ${stats ? "" : "animate-pulse opacity-50"}`}>
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mt-16 grid grid-cols-1 gap-14 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        {/* Top Dishes */}
        <section className="animate-rise [animation-delay:100ms]">
          <SectionTitle>Top Selling Dishes Today</SectionTitle>
          {stats?.topDishes && stats.topDishes.length > 0 ? (
            <ol className="stagger flex flex-col">
              {stats.topDishes.map((d, idx) => {
                const qty = Number(d.total_qty) || 0;
                return (
                  <li key={idx} style={{ "--i": idx } as React.CSSProperties} className="flex items-center gap-4 py-3.5">
                    <span className="w-6 font-display text-lg italic text-ink-faint">{idx + 1}</span>
                    <DishThumb name={d.dish_name} size="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-semibold text-ink">{d.dish_name}</span>
                        <span className="shrink-0 text-sm text-ink-muted">
                          {d.total_qty} sold ({formatINR(parseInt(d.total_paise, 10))})
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-200">
                        <div
                          className="h-full origin-left animate-[grow_1s_var(--ease-out-soft)_both] rounded-full bg-terra-400"
                          style={{ width: `${(qty / maxQty) * 100}%`, animationDelay: `${200 + idx * 80}ms` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-10 text-center font-display text-lg font-light italic text-ink-muted">
              {stats ? "No orders recorded yet today." : "Loading…"}
            </p>
          )}
        </section>

        {/* Quick Management */}
        <section className="animate-rise [animation-delay:180ms]">
          <SectionTitle>Quick Management</SectionTitle>
          <ul className="flex flex-col">
            {MANAGE_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="group -mx-3 flex items-center gap-4 rounded-2xl px-3 py-4 transition-colors duration-300 hover:bg-cream-50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream-200 text-lg text-forest-700 transition-colors duration-300 group-hover:bg-forest-100" aria-hidden>
                    {l.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{l.title}</span>
                    <span className="block text-xs text-ink-muted">{l.blurb}</span>
                  </span>
                  <Arrow className="h-4 w-4 text-ink-faint transition-all duration-300 group-hover:translate-x-1 group-hover:text-forest-700" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
