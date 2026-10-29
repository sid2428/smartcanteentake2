import { describe, expect, it } from "vitest";
import { dishForecasts, hourLabel, hourlyForecast, peakWindows, remainingShare, stockRisk, type HistoryDay } from "./insights";

// Two weeks: 2026-10-05 (Mon, weekday 1) … 2026-10-18 (Sun).
const days: HistoryDay[] = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-10-${String(5 + i).padStart(2, "0")}`,
  weekday: (1 + i) % 7,
}));

describe("hourlyForecast", () => {
  it("averages across all days, counting days without orders as zero", () => {
    const oneWeek = days.slice(0, 7); // one of each weekday: too little to trust same-weekday
    const rows = [{ date: "2026-10-06", hour: 13, orders: 14 }];
    const f = hourlyForecast(rows, oneWeek, 3);
    expect(f).toHaveLength(24);
    expect(f[13].expected).toBe(2); // 14 orders / 7 days
    expect(f[9].expected).toBe(0);
  });

  it("leans on the same weekday when there is enough history", () => {
    // Mondays (10-05, 10-12) are busy at 1 pm, other days quiet.
    const rows = [
      { date: "2026-10-05", hour: 13, orders: 20 },
      { date: "2026-10-12", hour: 13, orders: 20 },
      { date: "2026-10-07", hour: 13, orders: 6 },
    ];
    const monday = hourlyForecast(rows, days, 1)[13].expected;
    const thursday = hourlyForecast(rows, days, 4)[13].expected;
    // Monday: 0.6 × 20 + 0.4 × (46 / 14) ≈ 13.3. Thursday: 0.6 × 0 + 0.4 × 3.29 ≈ 1.3.
    expect(monday).toBeCloseTo(13.3, 1);
    expect(thursday).toBeCloseTo(1.3, 1);
  });

  it("returns zeros with no history", () => {
    expect(hourlyForecast([], [], 2).every((h) => h.expected === 0)).toBe(true);
  });
});

describe("peakWindows", () => {
  const forecast = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    expected: hour === 8 ? 6 : hour === 12 ? 9 : hour === 13 ? 10 : hour === 17 ? 4 : 1,
  }));

  it("merges adjacent busy hours and ranks windows", () => {
    expect(peakWindows(forecast)).toEqual([
      { startHour: 12, endHour: 14, expected: 19 },
      { startHour: 8, endHour: 9, expected: 6 },
    ]);
  });

  it("is empty when nothing is expected", () => {
    expect(peakWindows(forecast.map((f) => ({ ...f, expected: 0 })))).toEqual([]);
  });
});

describe("dishForecasts", () => {
  it("computes expected portions and week-over-week trend", () => {
    const rows = [
      ...days.slice(0, 7).map((d) => ({ dishId: "dosa", date: d.date, qty: 2 })),
      ...days.slice(7).map((d) => ({ dishId: "dosa", date: d.date, qty: 3 })),
      { dishId: "chai", date: days[13].date, qty: 5 },
    ];
    const [dosa, chai] = dishForecasts(rows, days, 1);
    expect(dosa.dishId).toBe("dosa");
    expect(dosa.last7).toBe(21);
    expect(dosa.prev7).toBe(14);
    expect(dosa.trendPct).toBe(50);
    expect(dosa.expected).toBeCloseTo(2.5, 1);
    expect(chai.trendPct).toBeNull(); // nothing the week before
  });
});

describe("remainingShare & stockRisk", () => {
  const forecast = Array.from({ length: 24 }, (_, hour) => ({ hour, expected: hour >= 10 && hour < 14 ? 5 : 0 }));

  it("tracks how much of the day's demand is still ahead", () => {
    expect(remainingShare(forecast, 9, 0)).toBe(1);
    expect(remainingShare(forecast, 12, 0)).toBe(0.5);
    expect(remainingShare(forecast, 12, 30)).toBe(0.375);
    expect(remainingShare(forecast, 15, 0)).toBe(0);
  });

  it("flags stock that won't last", () => {
    expect(stockRisk(0, 3)).toBe("OUT");
    expect(stockRisk(4, 6.2)).toBe("LOW");
    expect(stockRisk(7, 6.2)).toBe("OK");
    expect(stockRisk(5, 0)).toBe("OK");
  });

  it("labels hours", () => {
    expect(hourLabel(0)).toBe("12 am");
    expect(hourLabel(13)).toBe("1 pm");
    expect(hourLabel(12)).toBe("12 pm");
  });
});
