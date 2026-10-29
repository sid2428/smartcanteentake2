import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { query } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { maybeSweep } from "@/lib/server/sweeps";

/** GET /api/tickets - list user's active/recent tickets */
export const GET = handle(async () => {
  const session = await requireRole("student", "staff", "owner");
  await maybeSweep();

  const tickets = await query(
    `SELECT t.*, d.emoji, o.code as order_code
     FROM tickets t
     JOIN dishes d ON d.id = t.dish_id
     JOIN orders o ON o.id = t.order_id
     WHERE t.user_id = $1 AND o.status IN ('PAID', 'COMPLETED', 'CLOSED')
     ORDER BY t.created_at DESC
     LIMIT 50`,
    [session.uid]
  );

  return NextResponse.json({ tickets });
});
