import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/server/http";
import { query, queryOne } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { slotId } from "@/lib/server/demo/ids";
import { istDate, addDays, slotWindowsForDay } from "@/lib/domain";

/**
 * Creates pickup slots for today and tomorrow (IST). Idempotent: existing slots are skipped.
 * Called from the owner dashboard ("Populate Daily Slots").
 */
export const POST = handle(async () => {
  await requireRole("owner", "staff");

  const settings = await queryOne<{
    open_time: string; close_time: string; slot_minutes: number; slot_capacity: number;
  }>("SELECT open_time, close_time, slot_minutes, slot_capacity FROM settings WHERE id = 1");

  if (!settings) throw new HttpError(500, "Settings not found");

  const today = istDate(Date.now());
  const windows = [today, addDays(today, 1)].flatMap((date) =>
    slotWindowsForDay(date, settings.open_time.slice(0, 5), settings.close_time.slice(0, 5), settings.slot_minutes),
  );
  if (windows.length === 0) return NextResponse.json({ ok: true, created: 0 });

  const params: unknown[] = [];
  const values = windows.map((w) => {
    params.push(slotId(w.startsAt), w.startsAt.toISOString(), w.endsAt.toISOString(), settings.slot_capacity);
    const n = params.length;
    return `($${n - 3}::uuid, $${n - 2}::timestamptz, $${n - 1}::timestamptz, $${n}::int)`;
  });

  const inserted = await query(
    `INSERT INTO pickup_slots (id, starts_at, ends_at, capacity) VALUES ${values.join(", ")}
     ON CONFLICT (starts_at) DO NOTHING
     RETURNING id`,
    params,
  );

  return NextResponse.json({ ok: true, created: inserted.length });
});
