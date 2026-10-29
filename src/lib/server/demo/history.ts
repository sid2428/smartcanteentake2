import "server-only";
import type { Transaction } from "@electric-sql/pglite";
import { addDays, istDate, istToUtc } from "@/lib/domain";
import { seedId, slotId } from "./ids";

/**
 * Four weeks of completed orders from other students, so the owner's demand prediction has
 * history to learn from. Deterministic (seeded PRNG + seeded ids), so every server instance
 * generates the same rows. Never touches stock: these orders are in the past.
 */

const HISTORY_DAYS = 28;
const CAMPUS_STUDENTS = 8;

/** Relative order volume by IST hour: breakfast, a strong lunch peak, and evening snacks. */
const HOUR_WEIGHT: Record<number, number> = {
  7: 3, 8: 9, 9: 7, 10: 4, 11: 5, 12: 12, 13: 14, 14: 7, 15: 3, 16: 5, 17: 9, 18: 6, 19: 4, 20: 3, 21: 2, 22: 1,
};

/** Base orders per weekday (0 = Sunday). */
const DAY_VOLUME = [10, 34, 36, 35, 37, 31, 18];

/** What students order at different times of day. Weights are relative. */
const MEALS: { hours: number[]; dishes: Record<string, number> }[] = [
  { hours: [7, 8, 9, 10], dishes: { "Idli Sambar": 5, "Masala Dosa": 6, "Filter Coffee": 6, "Masala Chai": 4, "Vada Pav": 1 } },
  {
    hours: [11, 12, 13, 14],
    dishes: { "Veg Thali": 7, "Paneer Butter Masala": 4, "Chicken Biryani": 5, "Veg Hakka Noodles": 3, "Mango Lassi": 3, "Masala Dosa": 2 },
  },
  {
    hours: [15, 16, 17, 18],
    dishes: { "Samosa (2 pcs)": 7, "Vada Pav": 6, "Masala Chai": 7, "Gulab Jamun (2 pcs)": 3, "Filter Coffee": 2 },
  },
  {
    hours: [19, 20, 21, 22],
    dishes: { "Chicken Biryani": 5, "Veg Hakka Noodles": 4, "Paneer Butter Masala": 3, "Masala Dosa": 3, "Gulab Jamun (2 pcs)": 2 },
  },
];

/** Dishes gaining popularity over the four weeks (multiplier reached on the most recent day). */
const RISING: Record<string, number> = { "Chicken Biryani": 1.8, "Mango Lassi": 2.2 };
const FALLING: Record<string, number> = { "Veg Hakka Noodles": 0.5 };

type Dish = { id: string; name: string; counter: string; price_paise: number };

/** Small, fast, seedable PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T extends string>(weights: Record<T, number>, rand: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

async function insertRows(tx: Transaction, table: string, columns: string[], rows: unknown[][]): Promise<void> {
  const CHUNK = 250;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: unknown[] = [];
    const values = chunk.map((row) => {
      const start = params.length;
      params.push(...row);
      return `(${row.map((_, j) => `$${start + j + 1}`).join(", ")})`;
    });
    await tx.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values.join(", ")} ON CONFLICT DO NOTHING`, params);
  }
}

export async function seedHistory(tx: Transaction, dishes: Map<string, Dish>, passwordHash: string, staffId: string, now: number) {
  const rand = rng(20261030);

  const users: string[] = [];
  const userRows: unknown[][] = [];
  for (let i = 1; i <= CAMPUS_STUDENTS; i++) {
    const id = seedId("user", "campus", String(i));
    users.push(id);
    userRows.push([id, `Campus Student ${i}`, `campus${i}@history.demo`, "student", passwordHash]);
  }
  await insertRows(tx, "users", ["id", "name", "email", "role", "password_hash"], userRows);

  const today = istDate(now);
  const slotRows: unknown[][] = [];
  const orderRows: unknown[][] = [];
  const itemRows: unknown[][] = [];
  const ticketRows: unknown[][] = [];
  const hours = Object.keys(HOUR_WEIGHT).map(Number);
  let serial = 0;

  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const date = addDays(today, -back);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const progress = (HISTORY_DAYS - back) / (HISTORY_DAYS - 1); // 0 on the oldest day → 1 on yesterday
    const volume = Math.round(DAY_VOLUME[weekday] * (0.85 + rand() * 0.3) * (1 + 0.15 * progress));

    const slotsToday = new Set<number>();
    for (let n = 0; n < volume; n++) {
      const hour = pick(Object.fromEntries(hours.map((h) => [String(h), HOUR_WEIGHT[h]])) as Record<string, number>, rand);
      const h = Number(hour);
      const minute = Math.floor(rand() * 4) * 15;
      const slotStart = istToUtc(date, `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
      const slotKey = slotStart.getTime();
      if (!slotsToday.has(slotKey)) {
        slotsToday.add(slotKey);
        slotRows.push([slotId(slotStart), slotStart.toISOString(), new Date(slotKey + 15 * 60_000).toISOString(), 25, 0]);
      }

      const meal = MEALS.find((m) => m.hours.includes(h)) ?? MEALS[1];
      const weights: Record<string, number> = {};
      for (const [name, w] of Object.entries(meal.dishes)) {
        const rise = RISING[name] ? 1 + (RISING[name] - 1) * progress : 1;
        const fall = FALLING[name] ? 1 - (1 - FALLING[name]) * progress : 1;
        weights[name] = w * rise * fall;
      }

      const lines = new Map<string, number>();
      const lineCount = rand() < 0.55 ? 1 : rand() < 0.8 ? 2 : 3;
      for (let l = 0; l < lineCount; l++) {
        const name = pick(weights, rand);
        lines.set(name, Math.min(3, (lines.get(name) ?? 0) + (rand() < 0.8 ? 1 : 2)));
      }

      serial++;
      const code = `H${String(serial).padStart(4, "0")}`; // contains 0/1, never produced by generateOrderCode
      const orderId = seedId("order", code);
      const createdAt = slotKey - (20 + Math.floor(rand() * 40)) * 60_000;
      const userId = users[Math.floor(rand() * users.length)];
      let total = 0;

      for (const [name, qty] of lines) {
        const dish = dishes.get(name);
        if (!dish) continue;
        const amount = dish.price_paise * qty;
        total += amount;
        itemRows.push([seedId("item", code, name), orderId, dish.id, qty, dish.price_paise]);
        ticketRows.push([
          seedId("ticket", code, name), orderId, userId, dish.id, dish.name, dish.counter, qty, amount, "REDEEMED",
          new Date(slotKey + 45 * 60_000).toISOString(),
          new Date(slotKey - 12 * 60_000).toISOString(),
          new Date(slotKey - 2 * 60_000).toISOString(),
          new Date(slotKey + Math.floor(rand() * 15) * 60_000).toISOString(),
          staffId,
          new Date(createdAt).toISOString(),
        ]);
      }
      orderRows.push([
        orderId, code, userId, slotId(slotStart), total, "COMPLETED", "UPI_MOCK", `PAY_${code}`,
        new Date(createdAt + 10 * 60_000).toISOString(), new Date(createdAt + 60_000).toISOString(), new Date(createdAt).toISOString(),
      ]);
    }
  }

  await insertRows(tx, "pickup_slots", ["id", "starts_at", "ends_at", "capacity", "booked"], slotRows);
  await insertRows(
    tx,
    "orders",
    ["id", "code", "user_id", "slot_id", "total_paise", "status", "payment_method", "payment_ref", "hold_expires_at", "paid_at", "created_at"],
    orderRows,
  );
  await insertRows(tx, "order_items", ["id", "order_id", "dish_id", "qty", "unit_paise"], itemRows);
  await insertRows(
    tx,
    "tickets",
    ["id", "order_id", "user_id", "dish_id", "dish_name", "counter", "qty", "amount_paise", "status", "expires_at",
      "preparing_at", "ready_at", "redeemed_at", "redeemed_by", "created_at"],
    ticketRows,
  );
}
