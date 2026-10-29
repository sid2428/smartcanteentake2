import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, HttpError } from "@/lib/server/http";
import { queryOne } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";

const SettingsSchema = z.object({
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotMinutes: z.number().int().min(5).max(120).optional(),
  slotCapacity: z.number().int().positive().optional(),
  minLeadMinutes: z.number().int().min(0).optional(),
  graceMinutes: z.number().int().min(0).optional(),
  noShowRefundPercent: z.number().int().min(0).max(100).optional(),
  paymentHoldMinutes: z.number().int().positive().optional(),
});

export const GET = handle(async () => {
  await requireRole("owner");
  const settings = await queryOne("SELECT * FROM settings WHERE id = 1");
  return NextResponse.json({ settings });
});

export const PATCH = handle(async (request: Request) => {
  await requireRole("owner");
  const body = await parseBody(request, SettingsSchema);

  // Validate the hours that will be in effect after this change, not just the fields sent.
  const current = await queryOne<{ open_time: string; close_time: string }>("SELECT open_time, close_time FROM settings WHERE id = 1");
  const open = body.openTime ?? current?.open_time?.slice(0, 5) ?? "08:00";
  const close = body.closeTime ?? current?.close_time?.slice(0, 5) ?? "22:00";
  if (close <= open) throw new HttpError(400, "Closing time must be after opening time", "BAD_HOURS");
  if (body.openTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.openTime)) throw new HttpError(400, "Invalid opening time");
  if (body.closeTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.closeTime)) throw new HttpError(400, "Invalid closing time");

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const map: Record<string, string> = {
    openTime: "open_time",
    closeTime: "close_time",
    slotMinutes: "slot_minutes",
    slotCapacity: "slot_capacity",
    minLeadMinutes: "min_lead_minutes",
    graceMinutes: "grace_minutes",
    noShowRefundPercent: "no_show_refund_percent",
    paymentHoldMinutes: "payment_hold_minutes",
  };

  for (const [key, col] of Object.entries(map)) {
    if ((body as Record<string, unknown>)[key] !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push((body as Record<string, unknown>)[key]);
    }
  }

  if (fields.length === 0) {
    const settings = await queryOne("SELECT * FROM settings WHERE id = 1");
    return NextResponse.json({ settings });
  }

  const settings = await queryOne(`UPDATE settings SET ${fields.join(", ")} WHERE id = 1 RETURNING *`, values);
  return NextResponse.json({ settings });
});
