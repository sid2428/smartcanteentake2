import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { query } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { maybeSweep } from "@/lib/server/sweeps";

/** GET /api/kitchen/tickets - tickets of paid orders awaiting preparation or pickup */
export const GET = handle(async (request: Request) => {
  await requireRole("staff", "owner");
  await maybeSweep();

  const { searchParams } = new URL(request.url);
  const counter = searchParams.get("counter");

  let sql = `
    SELECT t.*, d.emoji, o.code as order_code, ps.starts_at as slot_starts_at
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

  const tickets = await query(sql, params);
  return NextResponse.json({ tickets });
});
