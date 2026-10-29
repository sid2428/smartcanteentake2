import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { sweepExpired } from "@/lib/server/sweeps";

/**
 * POST /api/cron/expire-tickets - owner-triggered sweep: releases expired payment holds,
 * expires uncollected tickets (with refunds) and closes finished orders. The same sweep
 * also runs automatically, at most once a minute, when the menu/tickets/kitchen load.
 */
export const POST = handle(async () => {
  await requireRole("owner");
  const result = await sweepExpired();
  return NextResponse.json({ ok: true, ...result });
});
