/**
 * Demand prediction from order history. Pure functions (no I/O), unit tested in insights.test.ts.
 *
 * The model is deliberately simple and explainable: a forecast for a given day is a blend of
 * the average for the same weekday (canteens are strongly weekly) and the average across all
 * recent days. With too little same-weekday history it falls back to the overall average.
 */

export type HistoryDay = { date: string; weekday: number };
export type HourlyRow = { date: string; hour: number; orders: number };
export type DishDayRow = { dishId: string; date: string; qty: number };

/** Weight of the same-weekday average in the blend. */
const SAME_WEEKDAY_WEIGHT = 0.6;
/** Same-weekday history needed before it is trusted. */
const MIN_SAME_WEEKDAY_DAYS = 2;

function blend(values: Map<string, number>, days: HistoryDay[], targetWeekday: number): number {
  if (days.length === 0) return 0;
  const sum = (ds: HistoryDay[]) => ds.reduce((s, d) => s + (values.get(d.date) ?? 0), 0);
  const overall = sum(days) / days.length;
  const same = days.filter((d) => d.weekday === targetWeekday);
  if (same.length < MIN_SAME_WEEKDAY_DAYS) return overall;
  return SAME_WEEKDAY_WEIGHT * (sum(same) / same.length) + (1 - SAME_WEEKDAY_WEIGHT) * overall;
}

export type HourForecast = { hour: number; expected: number };

/** Expected orders for each hour of the target day (0–23). Days with no orders count as zero. */
export function hourlyForecast(rows: HourlyRow[], days: HistoryDay[], targetWeekday: number): HourForecast[] {
  const byHour = new Map<number, Map<string, number>>();
  for (const r of rows) {
    if (!byHour.has(r.hour)) byHour.set(r.hour, new Map());
    const m = byHour.get(r.hour)!;
    m.set(r.date, (m.get(r.date) ?? 0) + r.orders);
  }
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    expected: round1(blend(byHour.get(hour) ?? new Map(), days, targetWeekday)),
  }));
}

export type PeakWindow = { startHour: number; endHour: number; expected: number };

/**
 * The busiest stretches of the day: hours at or above `threshold` × the busiest hour, merged
 * into contiguous windows and ranked by expected orders. `endHour` is exclusive.
 */
export function peakWindows(forecast: HourForecast[], threshold = 0.6, limit = 3): PeakWindow[] {
  const max = Math.max(0, ...forecast.map((f) => f.expected));
  if (max === 0) return [];
  const hot = forecast.filter((f) => f.expected >= max * threshold).sort((a, b) => a.hour - b.hour);
  const windows: PeakWindow[] = [];
  for (const f of hot) {
    const last = windows[windows.length - 1];
    if (last && last.endHour === f.hour) {
      last.endHour = f.hour + 1;
      last.expected = round1(last.expected + f.expected);
    } else {
      windows.push({ startHour: f.hour, endHour: f.hour + 1, expected: f.expected });
    }
  }
  return windows.sort((a, b) => b.expected - a.expected).slice(0, limit);
}

export type DishForecast = {
  dishId: string;
  /** Expected portions on the target day. */
  expected: number;
  /** Portions in the most recent 7 days and the 7 before that. */
  last7: number;
  prev7: number;
  /** Percent change last7 vs prev7, or null when there is nothing to compare against. */
  trendPct: number | null;
};

/**
 * Expected portions per dish for the target day, plus a week-over-week trend.
 * `days` must be ordered oldest → newest and exclude the target day.
 */
export function dishForecasts(rows: DishDayRow[], days: HistoryDay[], targetWeekday: number): DishForecast[] {
  const byDish = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!byDish.has(r.dishId)) byDish.set(r.dishId, new Map());
    const m = byDish.get(r.dishId)!;
    m.set(r.date, (m.get(r.date) ?? 0) + r.qty);
  }
  const last7Dates = new Set(days.slice(-7).map((d) => d.date));
  const prev7Dates = new Set(days.slice(-14, -7).map((d) => d.date));

  return [...byDish.entries()]
    .map(([dishId, values]) => {
      let last7 = 0;
      let prev7 = 0;
      for (const [date, qty] of values) {
        if (last7Dates.has(date)) last7 += qty;
        else if (prev7Dates.has(date)) prev7 += qty;
      }
      return {
        dishId,
        expected: round1(blend(values, days, targetWeekday)),
        last7,
        prev7,
        trendPct: prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null,
      };
    })
    .sort((a, b) => b.expected - a.expected || b.last7 - a.last7);
}

/**
 * Share of the day's expected demand still to come at `hour:minute` (0–1). Used to turn a
 * full-day dish forecast into "how much more will we sell today" for stock warnings.
 */
export function remainingShare(forecast: HourForecast[], hour: number, minute: number): number {
  const total = forecast.reduce((s, f) => s + f.expected, 0);
  if (total === 0) return 0;
  let remaining = 0;
  for (const f of forecast) {
    if (f.hour > hour) remaining += f.expected;
    else if (f.hour === hour) remaining += f.expected * (1 - minute / 60);
  }
  return Math.min(1, Math.max(0, remaining / total));
}

export type StockRisk = "OUT" | "LOW" | "OK";

/** Compares stock on hand with the demand still expected today. */
export function stockRisk(stock: number, expectedRemaining: number): StockRisk {
  if (stock <= 0) return "OUT";
  if (expectedRemaining > 0 && stock < Math.ceil(expectedRemaining)) return "LOW";
  return "OK";
}

/** "1 pm", "12 am" style label for an hour of the day. */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
