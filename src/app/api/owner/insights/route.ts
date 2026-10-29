import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { query } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { addDays, istDate, istToUtc } from "@/lib/domain";
import {
  dishForecasts,
  hourlyForecast,
  peakWindows,
  remainingShare,
  stockRisk,
  type HistoryDay,
} from "@/lib/insights";

/** Days of history the forecast learns from. */
const WINDOW_DAYS = 28;
/** Orders that represent real demand (paid at some point). */
const SOLD = "('PAID', 'COMPLETED', 'CLOSED')";

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * GET /api/owner/insights — demand prediction from order history: expected orders per hour
 * (by pickup time) with peak windows for today and tomorrow, the weekly pattern, and per-dish
 * demand with stock-out risk for the rest of today.
 */
export const GET = handle(async () => {
  await requireRole("owner");

  const now = Date.now();
  const today = istDate(now);
  const tomorrow = addDays(today, 1);
  const days: HistoryDay[] = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = addDays(today, i - WINDOW_DAYS);
    return { date, weekday: weekdayOf(date) };
  });
  const from = istToUtc(days[0].date, "00:00").toISOString();
  const todayStart = istToUtc(today, "00:00").toISOString();
  const tomorrowStart = istToUtc(tomorrow, "00:00").toISOString();

  const [hourlyRows, todayRows, dishRows, todayDishRows, dishes] = await Promise.all([
    query<{ date: string; hour: number; orders: number }>(
      `SELECT to_char(ps.starts_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date,
              extract(hour FROM ps.starts_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
              count(*)::int AS orders
       FROM orders o JOIN pickup_slots ps ON ps.id = o.slot_id
       WHERE o.status IN ${SOLD} AND ps.starts_at >= $1 AND ps.starts_at < $2
       GROUP BY 1, 2`,
      [from, todayStart],
    ),
    query<{ hour: number; orders: number }>(
      `SELECT extract(hour FROM ps.starts_at AT TIME ZONE 'Asia/Kolkata')::int AS hour, count(*)::int AS orders
       FROM orders o JOIN pickup_slots ps ON ps.id = o.slot_id
       WHERE o.status IN ${SOLD} AND ps.starts_at >= $1 AND ps.starts_at < $2
       GROUP BY 1`,
      [todayStart, tomorrowStart],
    ),
    query<{ dishId: string; date: string; qty: number }>(
      `SELECT t.dish_id AS "dishId",
              to_char(ps.starts_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date,
              sum(t.qty)::int AS qty
       FROM tickets t JOIN orders o ON o.id = t.order_id JOIN pickup_slots ps ON ps.id = o.slot_id
       WHERE o.status IN ${SOLD} AND t.status <> 'CANCELLED' AND ps.starts_at >= $1 AND ps.starts_at < $2
       GROUP BY 1, 2`,
      [from, todayStart],
    ),
    query<{ dish_id: string; qty: number }>(
      `SELECT t.dish_id, sum(t.qty)::int AS qty
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE o.status IN ('PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CLOSED') AND t.status <> 'CANCELLED'
         AND o.created_at >= $1 AND o.created_at < $2
       GROUP BY 1`,
      [todayStart, tomorrowStart],
    ),
    query<{ id: string; name: string; emoji: string; stock: number; active: boolean; counter: string }>(
      "SELECT id, name, emoji, stock, active, counter FROM dishes ORDER BY name",
    ),
  ]);

  // Today
  const todayForecast = hourlyForecast(hourlyRows, days, weekdayOf(today));
  const actualByHour = new Map(todayRows.map((r) => [r.hour, r.orders]));
  const istNow = new Date(now + (5 * 60 + 30) * 60_000);
  const hourNow = istNow.getUTCHours();
  const minuteNow = istNow.getUTCMinutes();
  const todayPeaks = peakWindows(todayForecast);
  const nextPeak =
    [...todayPeaks].sort((a, b) => a.startHour - b.startHour).find((p) => p.endHour > hourNow) ?? null;

  // Tomorrow
  const tomorrowForecast = hourlyForecast(hourlyRows, days, weekdayOf(tomorrow));

  // Weekly pattern: average orders per day for each weekday.
  const perDate = new Map<string, number>();
  for (const r of hourlyRows) perDate.set(r.date, (perDate.get(r.date) ?? 0) + r.orders);
  const weekdays = Array.from({ length: 7 }, (_, weekday) => {
    const ds = days.filter((d) => d.weekday === weekday);
    const total = ds.reduce((s, d) => s + (perDate.get(d.date) ?? 0), 0);
    return { weekday, avg: ds.length ? Math.round((total / ds.length) * 10) / 10 : 0 };
  });

  // Dishes: expected demand and whether stock lasts the day.
  const share = remainingShare(todayForecast, hourNow, minuteNow);
  const forecasts = new Map(dishForecasts(dishRows, days, weekdayOf(today)).map((f) => [f.dishId, f]));
  const soldToday = new Map(todayDishRows.map((r) => [r.dish_id, r.qty]));
  const dishInsights = dishes
    .filter((d) => d.active)
    .map((d) => {
      const f = forecasts.get(d.id);
      const expected = f?.expected ?? 0;
      const expectedRemaining = Math.round(expected * share * 10) / 10;
      const risk = stockRisk(d.stock, expectedRemaining);
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        counter: d.counter,
        stock: d.stock,
        expected_today: expected,
        expected_remaining: expectedRemaining,
        sold_today: soldToday.get(d.id) ?? 0,
        last7: f?.last7 ?? 0,
        prev7: f?.prev7 ?? 0,
        trend_pct: f?.trendPct ?? null,
        risk,
        restock: risk === "OK" ? 0 : Math.max(0, Math.ceil(expectedRemaining) - d.stock),
      };
    })
    .sort((a, b) => b.expected_today - a.expected_today);

  const sum = (xs: { expected: number }[]) => Math.round(xs.reduce((s, x) => s + x.expected, 0));

  return NextResponse.json(
    {
      generated_at: new Date(now).toISOString(),
      history_days: WINDOW_DAYS,
      has_history: hourlyRows.length > 0,
      today: {
        date: today,
        weekday: weekdayOf(today),
        hour_now: hourNow,
        hourly: todayForecast.map((f) => ({ ...f, actual: actualByHour.get(f.hour) ?? 0 })),
        peaks: todayPeaks,
        next_peak: nextPeak,
        expected_total: sum(todayForecast),
        actual_so_far: todayRows.reduce((s, r) => s + r.orders, 0),
      },
      tomorrow: {
        date: tomorrow,
        weekday: weekdayOf(tomorrow),
        peaks: peakWindows(tomorrowForecast),
        expected_total: sum(tomorrowForecast),
      },
      weekdays,
      dishes: dishInsights,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
