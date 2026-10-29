import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { query } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { maybeSweep } from "@/lib/server/sweeps";
import { counterLoads, kitchenEstimates } from "@/lib/server/tracking";

/** GET /api/kitchen/tickets - tickets of paid orders awaiting preparation or pickup, with live estimates */
export const GET = handle(async (request: Request) => {
  await requireRole("staff", "owner");
  await maybeSweep();

  const { searchParams } = new URL(request.url);
  const counter = searchParams.get("counter");

  let sql = `
    SELECT t.*, d.emoji, d.prep_minutes, o.code as order_code, ps.starts_at as slot_starts_at, ps.ends_at as slot_ends_at
    FROM tickets t
    JOIN dishes d ON d.id = t.dish_id
    JOIN orders o ON o.id = t.order_id
    JOIN pickup_slots ps ON ps.id = o.slot_id
    WHERE t.status IN ('ISSUED', 'PREPARING', 'READY') AND o.status = 'PAID'
  `;
  const params: unknown[] = [];

  if (counter && counter !== "All") {
    params.push(counter);
    sql += ` AND t.counter = $1`;
  }

  sql += ` ORDER BY ps.starts_at ASC, t.created_at ASC`;

  const now = Date.now();
  const [rows, estimates] = await Promise.all([
    query<{ id: string; counter: string; status: string; slot_ends_at: string }>(sql, params),
    kitchenEstimates(now),
  ]);

  const tickets = rows.map((t) => {
    const est = estimates.get(t.id);
    return {
      ...t,
      ready_estimate_at: est ? new Date(est.readyAt).toISOString() : null,
      // Would miss its pickup slot at the current pace.
      at_risk: !!(est && t.status !== "READY" && est.readyAt > new Date(t.slot_ends_at).getTime()),
    };
  });

  return NextResponse.json(
    { tickets, loads: counterLoads(rows, estimates, now), server_time: new Date(now).toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
});
