import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, HttpError } from "@/lib/server/http";
import { query, withTransaction } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { generateOrderCode } from "@/lib/domain";

const OrderItemSchema = z.object({ dishId: z.string().uuid(), qty: z.number().int().positive().max(10) });

const PlaceOrderSchema = z.object({
  slotId: z.string().uuid(),
  items: z.array(OrderItemSchema).min(1).max(20),
});

/** GET /api/orders — list the student's orders. */
export const GET = handle(async () => {
  const session = await requireRole("student", "staff", "owner");

  const orders = await query(
    `SELECT o.*, json_agg(json_build_object(
        'id', oi.id, 'dish_id', oi.dish_id, 'qty', oi.qty, 'unit_paise', oi.unit_paise,
        'dish_name', d.name, 'emoji', d.emoji
     ) ORDER BY oi.id) AS items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN dishes d ON d.id = oi.dish_id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 50`,
    [session.uid],
  );

  return NextResponse.json({ orders });
});

/** POST /api/orders — place a new order (transaction: check stock, book slot, create tickets). */
export const POST = handle(async (request: Request) => {
  const session = await requireRole("student");
  const body = await parseBody(request, PlaceOrderSchema);

  const result = await withTransaction(async (tx) => {
    // 1. Book the pickup slot (atomically increment booked; bail if full or too soon / in the past).
    const slot = await tx.queryOne<{ id: string; capacity: number; booked: number; starts_at: string; ends_at: string }>(
      `UPDATE pickup_slots SET booked = booked + 1
       WHERE id = $1 AND booked < capacity
         AND starts_at >= now() + make_interval(mins => (SELECT min_lead_minutes FROM settings WHERE id = 1))
       RETURNING *`,
      [body.slotId],
    );
    if (!slot) throw new HttpError(409, "This pickup slot is no longer available", "SLOT_FULL");

    // 2. Lock and check stock for each dish; compute totals.
    let totalPaise = 0;
    const resolvedItems: { dish: Record<string, unknown>; qty: number }[] = [];

    for (const item of body.items) {
      const dish = await tx.queryOne<Record<string, unknown>>(
        "SELECT * FROM dishes WHERE id = $1 AND active = true FOR UPDATE",
        [item.dishId],
      );
      if (!dish) throw new HttpError(404, `Dish not found`);
      if ((dish.stock as number) < item.qty) throw new HttpError(409, `${dish.name} is out of stock`, "OUT_OF_STOCK");

      await tx.query("UPDATE dishes SET stock = stock - $1 WHERE id = $2", [item.qty, item.dishId]);
      totalPaise += (dish.price_paise as number) * item.qty;
      resolvedItems.push({ dish, qty: item.qty });
    }

    // 3. Create the order.
    const settings = await tx.queryOne<{ payment_hold_minutes: number; grace_minutes: number }>(
      "SELECT payment_hold_minutes, grace_minutes FROM settings WHERE id = 1",
    );
    const holdMin = settings?.payment_hold_minutes ?? 10;
    const graceMin = settings?.grace_minutes ?? 30;
    const holdExpiresAt = new Date(Date.now() + holdMin * 60_000).toISOString();

    const order = await tx.queryOne<{ id: string; code: string }>(
      `INSERT INTO orders (code, user_id, slot_id, total_paise, status, hold_expires_at)
       VALUES ($1, $2, $3, $4, 'PENDING_PAYMENT', $5)
       RETURNING id, code`,
      [generateOrderCode(), session.uid, body.slotId, totalPaise, holdExpiresAt],
    );

    // 4. Create order items + tickets.
    const ticketExpiresAt = new Date(new Date(slot.ends_at).getTime() + graceMin * 60_000).toISOString();

    for (const { dish, qty } of resolvedItems) {
      await tx.query(
        `INSERT INTO order_items (order_id, dish_id, qty, unit_paise)
         VALUES ($1, $2, $3, $4)`,
        [order!.id, dish.id, qty, dish.price_paise],
      );

      await tx.query(
        `INSERT INTO tickets (order_id, user_id, dish_id, dish_name, counter, qty, amount_paise, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ISSUED', $8)`,
        [order!.id, session.uid, dish.id, dish.name, dish.counter, qty, (dish.price_paise as number) * qty, ticketExpiresAt],
      );
    }

    return order;
  });

  return NextResponse.json({ order: result }, { status: 201 });
});
