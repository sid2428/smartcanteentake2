import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/server/http";
import { query, queryOne } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { maybeSweep } from "@/lib/server/sweeps";
import { kitchenEstimates } from "@/lib/server/tracking";
import { orderStage } from "@/lib/domain";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/orders/[id] — order details plus live tracking: each dish's kitchen status and an
 * estimated ready time from the current kitchen queue. Polled by the order page.
 */
export const GET = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("student", "staff", "owner");
  const { id } = await params;
  // A malformed id would otherwise surface as a Postgres cast error (500).
  if (!UUID_RE.test(id)) throw new HttpError(404, "Order not found");

  // Expire stale payment holds / uncollected tickets first, so the status shown is current.
  await maybeSweep();

  const order = await queryOne<{
    id: string;
    code: string;
    user_id: string;
    slot_id: string;
    total_paise: number;
    status: string;
    payment_method: string | null;
    payment_ref: string | null;
    hold_expires_at: string;
    paid_at: string | null;
    created_at: string;
  }>("SELECT * FROM orders WHERE id = $1", [id]);

  if (!order) {
    throw new HttpError(404, "Order not found");
  }

  if (session.role === "student" && order.user_id !== session.uid) {
    throw new HttpError(403, "Access denied");
  }

  const items = await queryOne<{ items: unknown[] | null }>(
    `SELECT json_agg(json_build_object(
        'id', oi.id, 'dish_id', oi.dish_id, 'qty', oi.qty, 'unit_paise', oi.unit_paise,
        'dish_name', d.name, 'emoji', d.emoji, 'counter', d.counter, 'is_veg', d.is_veg
     )) AS items
     FROM order_items oi
     JOIN dishes d ON d.id = oi.dish_id
     WHERE oi.order_id = $1`,
    [id]
  );

  const slot = await queryOne<{ starts_at: string; ends_at: string }>(
    "SELECT starts_at, ends_at FROM pickup_slots WHERE id = $1",
    [order.slot_id]
  );

  const tickets = await query<{
    id: string;
    dish_id: string;
    dish_name: string;
    counter: string;
    qty: number;
    status: string;
    preparing_at: string | null;
    ready_at: string | null;
    redeemed_at: string | null;
    expires_at: string;
  }>(
    `SELECT id, dish_id, dish_name, counter, qty, status, preparing_at, ready_at, redeemed_at, expires_at
     FROM tickets WHERE order_id = $1 ORDER BY created_at, dish_name`,
    [id],
  );

  const now = Date.now();
  const estimates = order.status === "PAID" ? await kitchenEstimates(now) : new Map();
  const trackedTickets = tickets.map((t) => {
    const est = estimates.get(t.id);
    return { ...t, ready_estimate_at: est ? new Date(est.readyAt).toISOString() : null, ahead: est?.ahead ?? null };
  });

  const open = trackedTickets.filter((t) => t.ready_estimate_at && t.status !== "READY");
  const etaMs = open.length ? Math.max(...open.map((t) => new Date(t.ready_estimate_at!).getTime())) : null;

  return NextResponse.json({
    order: {
      ...order,
      items: items?.items ?? [],
      slot,
      tickets: trackedTickets,
      tracking: {
        stage: orderStage(order.status, tickets.map((t) => t.status)),
        ready_estimate_at: etaMs ? new Date(etaMs).toISOString() : null,
        /** True when the estimate lands after the pickup slot closes. */
        running_late: !!(etaMs && slot && etaMs > new Date(slot.ends_at).getTime()),
        ahead: open.length ? Math.max(...open.map((t) => t.ahead ?? 0)) : 0,
        server_time: new Date(now).toISOString(),
      },
    },
  });
});
