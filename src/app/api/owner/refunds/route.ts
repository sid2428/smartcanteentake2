import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { query } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";

/** GET /api/owner/refunds - list all issued refunds */
export const GET = handle(async () => {
  await requireRole("owner");

  const refunds = await query(
    `SELECT r.*, u.name as user_name, u.email as user_email, t.dish_name, t.counter
     FROM refunds r
     JOIN users u ON u.id = r.user_id
     JOIN tickets t ON t.id = r.ticket_id
     ORDER BY r.created_at DESC
     LIMIT 100`
  );

  return NextResponse.json({ refunds });
});
