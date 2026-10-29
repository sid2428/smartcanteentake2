import "server-only";
import { refundAmount, refundPercentOnExpiry, type TicketStatus } from "@/lib/domain";
import { withTransaction, type Tx } from "./db";

/**
 * Puts an unpaid order's stock and slot capacity back and cancels its tickets.
 * Caller must hold a row lock on the order and have checked it is PENDING_PAYMENT.
 */
export async function releaseUnpaidOrder(tx: Tx, order: { id: string; slot_id: string }): Promise<void> {
  const items = await tx.query<{ dish_id: string; qty: number }>(
    "SELECT dish_id, qty FROM order_items WHERE order_id = $1",
    [order.id],
  );
  for (const item of items) {
    await tx.query("UPDATE dishes SET stock = stock + $1 WHERE id = $2", [item.qty, item.dish_id]);
  }
  await tx.query("UPDATE pickup_slots SET booked = GREATEST(0, booked - 1) WHERE id = $1", [order.slot_id]);
  await tx.query("UPDATE orders SET status = 'PAYMENT_FAILED' WHERE id = $1", [order.id]);
  await tx.query("UPDATE tickets SET status = 'CANCELLED' WHERE order_id = $1", [order.id]);
}

export type SweepResult = { releasedHolds: number; expiredTickets: number; closedOrders: number };

/**
 * 1. Releases orders whose payment hold ran out.
 * 2. Expires uncollected tickets of paid orders and records refunds.
 * 3. Closes paid orders with no open tickets left.
 * SKIP LOCKED lets concurrent sweeps run without blocking or double-processing.
 */
export async function sweepExpired(): Promise<SweepResult> {
  return withTransaction(async (tx) => {
    const staleOrders = await tx.query<{ id: string; slot_id: string }>(
      `SELECT id, slot_id FROM orders
       WHERE status = 'PENDING_PAYMENT' AND hold_expires_at < now()
       FOR UPDATE SKIP LOCKED`,
    );
    for (const order of staleOrders) await releaseUnpaidOrder(tx, order);

    const settings = await tx.queryOne<{ no_show_refund_percent: number }>(
      "SELECT no_show_refund_percent FROM settings WHERE id = 1",
    );
    const noShowRefundPercent = settings?.no_show_refund_percent ?? 50;

    const openTickets = await tx.query<{ id: string; user_id: string; amount_paise: number; status: TicketStatus }>(
      `SELECT t.id, t.user_id, t.amount_paise, t.status
       FROM tickets t
       JOIN orders o ON o.id = t.order_id
       WHERE t.status IN ('ISSUED', 'PREPARING', 'READY') AND t.expires_at < now() AND o.status = 'PAID'
       FOR UPDATE OF t SKIP LOCKED`,
    );

    for (const ticket of openTickets) {
      await tx.query("UPDATE tickets SET status = 'EXPIRED' WHERE id = $1", [ticket.id]);

      const percent = refundPercentOnExpiry(ticket.status, noShowRefundPercent);
      const amountPaise = refundAmount(ticket.amount_paise, percent);
      if (amountPaise > 0) {
        await tx.query(
          `INSERT INTO refunds (ticket_id, user_id, amount_paise, percent, reason)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (ticket_id) DO NOTHING`,
          [ticket.id, ticket.user_id, amountPaise, percent, `Automatic refund: ticket uncollected (${ticket.status})`],
        );
      }

      await tx.query("INSERT INTO ticket_events (ticket_id, event, detail) VALUES ($1, $2, $3)", [
        ticket.id,
        "AUTO_EXPIRED",
        JSON.stringify({ previousStatus: ticket.status, refundPaise: amountPaise }),
      ]);
    }

    const closed = await tx.query(
      `UPDATE orders o SET status = 'CLOSED'
       WHERE o.status = 'PAID'
         AND NOT EXISTS (
           SELECT 1 FROM tickets t WHERE t.order_id = o.id AND t.status IN ('ISSUED', 'PREPARING', 'READY')
         )
       RETURNING o.id`,
    );

    return { releasedHolds: staleOrders.length, expiredTickets: openTickets.length, closedOrders: closed.length };
  });
}

const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

/**
 * Runs `sweepExpired()` at most once a minute per server instance. Called from busy
 * read paths so holds and tickets expire on time even where cron can only run daily
 * (Vercel Hobby). Never throws: a failed sweep must not break the request.
 */
export async function maybeSweep(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  try {
    await sweepExpired();
  } catch (error) {
    console.error("sweepExpired failed", error);
  }
}
