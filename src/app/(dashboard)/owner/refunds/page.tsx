"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="space-y-6">
      <CardHeader>
        <CardTitle>Refunds & Expired Tickets</CardTitle>
      </CardHeader>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-canteen-200 bg-canteen-50">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Dish</th>
                  <th className="p-3">Counter</th>
                  <th className="p-3">Refund %</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 text-xs text-zinc-500">
                      {formatDay(r.created_at)} {formatTime(r.created_at)}
                    </td>
                    <td className="p-3 font-medium">
                      <div>{r.user_name}</div>
                      <div className="text-xs text-zinc-400">{r.user_email}</div>
                    </td>
                    <td className="p-3">{r.dish_name}</td>
                    <td className="p-3">{r.counter}</td>
                    <td className="p-3">
                      <Badge color={r.percent === 100 ? "green" : "yellow"}>
                        {r.percent}%
                      </Badge>
                    </td>
                    <td className="p-3 font-bold text-orange-600">
                      {formatINR(r.amount_paise)}
                    </td>
                    <td className="p-3 text-xs text-zinc-500">{r.reason}</td>
                  </tr>
                ))}
                {refunds.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400">
                      No refunds recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
