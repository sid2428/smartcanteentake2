import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/server/http";
import { queryOne } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";

/** GET /api/orders/[id] */
export const GET = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("student", "staff", "owner");
  const { id } = await params;

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
        'dish_name', d.name, 'emoji', d.emoji, 'counter', d.counter
     )) AS items
     FROM order_items oi
     JOIN dishes d ON d.id = oi.dish_id
     WHERE oi.order_id = $1`,
    [id]
  );

  const slot = await queryOne(
    "SELECT starts_at, ends_at FROM pickup_slots WHERE id = $1",
    [order.slot_id]
  );

  return NextResponse.json({
    order: {
      ...order,
      items: items?.items ?? [],
      slot,
    },
  });
});
