import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, HttpError } from "@/lib/server/http";
import { query, queryOne, withTransaction } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { generateOrderCode } from "@/lib/domain";

/** Most portions of one dish a single order may take. */
const MAX_QTY_PER_DISH = 10;

const OrderItemSchema = z.object({ dishId: z.string().uuid(), qty: z.number().int().positive().max(MAX_QTY_PER_DISH) });

const PlaceOrderSchema = z.object({
  slotId: z.string().uuid(),
  items: z.array(OrderItemSchema).min(1).max(20),
  /** Idempotency key: one per checkout attempt, reused on retries. */
  clientRef: z.string().min(8).max(64).optional(),
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

type ExistingOrder = { id: string; code: string };

async function findByClientRef(userId: string, clientRef: string | undefined): Promise<ExistingOrder | null> {
  if (!clientRef) return null;
  return queryOne<ExistingOrder>("SELECT id, code FROM orders WHERE user_id = $1 AND client_ref = $2", [userId, clientRef]);
}

/** POST /api/orders — place a new order (transaction: check stock, book slot, create tickets). */
export const POST = handle(async (request: Request) => {
  const session = await requireRole("student");
  const body = await parseBody(request, PlaceOrderSchema);

  // Same checkout attempt arriving twice (double-click, retry after a timeout): return the first order.
  const replay = await findByClientRef(session.uid, body.clientRef);
  if (replay) return NextResponse.json({ order: replay, replayed: true }, { status: 200 });

  // Merge repeated lines for the same dish, then lock dishes in a fixed order so two
  // concurrent checkouts can never wait on each other's locks.
  const merged = new Map<string, number>();
  for (const item of body.items) merged.set(item.dishId, (merged.get(item.dishId) ?? 0) + item.qty);
  for (const qty of merged.values()) {
    if (qty > MAX_QTY_PER_DISH) throw new HttpError(400, `You can order at most ${MAX_QTY_PER_DISH} of a dish at once`);
  }
  const lines = [...merged.entries()].sort(([a], [b]) => a.localeCompare(b));

  let result: ExistingOrder;
  try {
    result = await withTransaction(async (tx) => {
      // 1. Book the pickup slot (atomically increment booked; bail if full or too soon / in the past).
      const slot = await tx.queryOne<{ id: string; capacity: number; booked: number; starts_at: string; ends_at: string }>(
        `UPDATE pickup_slots SET booked = booked + 1
         WHERE id = $1 AND booked < capacity
           AND starts_at >= now() + make_interval(mins => (SELECT min_lead_minutes FROM settings WHERE id = 1))
         RETURNING *`,
        [body.slotId],
      );
      if (!slot) throw new HttpError(409, "This pickup slot is no longer available. Please pick another time.", "SLOT_FULL");

      // 2. Lock and check stock for each dish; compute totals. The decrement is conditional,
      //    so stock can never go negative even if a check above were ever skipped.
      let totalPaise = 0;
      const resolvedItems: { dish: Record<string, unknown>; qty: number }[] = [];

      for (const [dishId, qty] of lines) {
        const dish = await tx.queryOne<Record<string, unknown>>("SELECT * FROM dishes WHERE id = $1 FOR UPDATE", [dishId]);
        if (!dish || !dish.active) {
          throw new HttpError(409, `${dish?.name ?? "A dish in your tray"} is no longer on the menu`, "DISH_UNAVAILABLE");
        }
        const stock = dish.stock as number;
        if (stock < qty) {
          throw new HttpError(
            409,
            stock === 0 ? `${dish.name} just sold out` : `Only ${stock} ${dish.name} left. Please reduce the quantity.`,
            "OUT_OF_STOCK",
          );
        }

        const updated = await tx.queryOne("UPDATE dishes SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id", [
          qty,
          dishId,
        ]);
        if (!updated) throw new HttpError(409, `${dish.name} just sold out`, "OUT_OF_STOCK");
        totalPaise += (dish.price_paise as number) * qty;
        resolvedItems.push({ dish, qty });
      }

      // 3. Create the order.
      const settings = await tx.queryOne<{ payment_hold_minutes: number; grace_minutes: number }>(
        "SELECT payment_hold_minutes, grace_minutes FROM settings WHERE id = 1",
      );
      const holdMin = settings?.payment_hold_minutes ?? 10;
      const graceMin = settings?.grace_minutes ?? 30;
      const holdExpiresAt = new Date(Date.now() + holdMin * 60_000).toISOString();

      const order = await tx.queryOne<{ id: string; code: string }>(
        `INSERT INTO orders (code, user_id, slot_id, total_paise, status, hold_expires_at, client_ref)
         VALUES ($1, $2, $3, $4, 'PENDING_PAYMENT', $5, $6)
         RETURNING id, code`,
        [generateOrderCode(), session.uid, body.slotId, totalPaise, holdExpiresAt, body.clientRef ?? null],
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

      return order!;
    });
  } catch (error) {
    // Two copies of the same attempt raced past the replay check: the unique index stopped the
    // second one (and rolled back its stock/slot changes). Hand back the order that won.
    const existing = await findByClientRef(session.uid, body.clientRef);
    if (existing) return NextResponse.json({ order: existing, replayed: true }, { status: 200 });
    throw error;
  }

  return NextResponse.json({ order: result }, { status: 201 });
});
