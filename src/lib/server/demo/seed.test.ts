import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDemoDatabase } from "./seed";

describe("demo seed", () => {
  it("keeps the demo cases intact alongside four weeks of history", async () => {
    const db = await createDemoDatabase();
    const one = async <T,>(sql: string) => (await db.query<T>(sql)).rows[0];

    const demo = await one<{ codes: string[] }>(
      "SELECT array_agg(code ORDER BY code) AS codes FROM orders WHERE code LIKE 'DEMO%'",
    );
    expect(demo.codes).toEqual(["DEMOA", "DEMOB", "DEMOC", "DEMOD", "DEMOE"]);

    // History lives on other accounts, so the demo student's order list stays readable.
    const student = await one<{ n: number }>(
      "SELECT count(*)::int AS n FROM orders o JOIN users u ON u.id = o.user_id WHERE u.email = 'student@demo.com'",
    );
    expect(student.n).toBe(5);

    const history = await one<{ orders: number; days: number; open: number }>(
      `SELECT count(*)::int AS orders, count(DISTINCT date(created_at))::int AS days,
              count(*) FILTER (WHERE status <> 'COMPLETED')::int AS open
       FROM orders WHERE code LIKE 'H%'`,
    );
    expect(history.days).toBe(28);
    expect(history.orders).toBeGreaterThan(500);
    expect(history.open).toBe(0);

    // Past orders must not eat into today's stock: Masala Dosa starts at 40, DEMOA holds 1.
    const dosa = await one<{ stock: number }>("SELECT stock FROM dishes WHERE name = 'Masala Dosa'");
    expect(dosa.stock).toBe(39);

    await db.close();
  }, 60_000);
});
