"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Loading, EmptyState } from "@/components/ui/page";
import { DishThumb } from "@/components/dish-photo";
import { formatINR, formatDay, formatTime } from "@/lib/domain";

type Refund = {
  id: string;
  user_name: string;
  user_email: string;
  dish_name: string;
  counter: string;
  amount_paise: number;
  percent: number;
  reason: string;
  created_at: string;
};

export default function OwnerRefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ refunds: Refund[] }>("/api/owner/refunds")
      .then((res) => setRefunds(res.refunds))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const totalPaise = refunds.reduce((s, r) => s + r.amount_paise, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title={
          <>
            Refunds <span className="italic text-forest-700">&amp; expired tickets</span>
          </>
        }
        lede="Recorded automatically when a ticket expires uncollected. Never-prepared food is refunded in full."
      />

      {loading ? (
        <Loading />
      ) : refunds.length === 0 ? (
        <EmptyState icon="₹" title="No refunds recorded yet." />
      ) : (
        <>
          <dl className="mb-14 flex animate-rise flex-wrap gap-x-14 gap-y-6">
            <div>
              <dt className="eyebrow">Total refunded</dt>
              <dd className="mt-2 font-display text-5xl font-light text-ink">{formatINR(totalPaise)}</dd>
            </div>
            <div className="border-l border-cream-300 pl-14">
              <dt className="eyebrow !text-ink-muted">Tickets</dt>
              <dd className="mt-2 font-display text-5xl font-light text-ink">{refunds.length}</dd>
            </div>
          </dl>

          <div className="hidden grid-cols-[8rem_minmax(0,1.4fr)_minmax(0,1.3fr)_5rem_6rem_minmax(0,1.3fr)] gap-4 border-b border-cream-300 pb-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-muted lg:grid">
            <span>Date</span>
            <span>Student</span>
            <span>Dish</span>
            <span>Refund %</span>
            <span className="text-right">Amount</span>
            <span>Reason</span>
          </div>
          <ul className="stagger">
            {refunds.map((r, i) => (
              <li
                key={r.id}
                style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-cream-200 py-5 lg:grid-cols-[8rem_minmax(0,1.4fr)_minmax(0,1.3fr)_5rem_6rem_minmax(0,1.3fr)]"
              >
                <span className="col-span-2 text-xs text-ink-muted lg:col-span-1">
                  {formatDay(r.created_at)} {formatTime(r.created_at)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.user_name}</p>
                  <p className="truncate text-xs text-ink-muted">{r.user_email}</p>
                </div>
                <span className="font-display text-xl text-terra-600 lg:hidden">{formatINR(r.amount_paise)}</span>
                <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                  <DishThumb name={r.dish_name} size="h-9 w-9" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{r.dish_name}</p>
                    <p className="text-xs text-ink-muted">{r.counter}</p>
                  </div>
                  <Badge color={r.percent === 100 ? "green" : "yellow"} className="ml-auto lg:hidden">
                    {r.percent}%
                  </Badge>
                </div>
                <span className="hidden lg:block">
                  <Badge color={r.percent === 100 ? "green" : "yellow"}>{r.percent}%</Badge>
                </span>
                <span className="hidden text-right font-display text-lg text-terra-600 lg:block">{formatINR(r.amount_paise)}</span>
                <span className="col-span-2 text-xs leading-relaxed text-ink-muted lg:col-span-1">{r.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
