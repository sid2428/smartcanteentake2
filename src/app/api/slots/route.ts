import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { query, queryOne } from "@/lib/server/db";
import { maybeSweep } from "@/lib/server/sweeps";

/** GET /api/slots — list available (future, not full) pickup slots. */
export const GET = handle(async () => {
  // Frees capacity held by abandoned, unpaid orders before listing.
  await maybeSweep();

  const settings = await queryOne<{ min_lead_minutes: number }>(
    "SELECT min_lead_minutes FROM settings WHERE id = 1",
  );
  const leadMs = (settings?.min_lead_minutes ?? 10) * 60_000;
  const earliest = new Date(Date.now() + leadMs).toISOString();

  const slots = await query(
    `SELECT id, starts_at, ends_at, capacity, booked
     FROM pickup_slots
     WHERE starts_at >= $1 AND booked < capacity
     ORDER BY starts_at
     LIMIT 50`,
    [earliest],
  );

  return NextResponse.json({ slots });
});
