import "server-only";
import { estimateReadyTimes, type QueueTicket, type TicketEstimate } from "@/lib/domain";
import { query } from "./db";

type QueueRow = {
  id: string;
  counter: string;
  status: QueueTicket["status"];
  qty: number;
  prep_minutes: number;
  preparing_at: string | null;
  slot_starts_at: string;
  created_at: string;
};

/**
 * Ready-time estimates for every open ticket in the kitchen, computed from the live queue.
 * Re-run on each request, so estimates move as soon as the kitchen changes a status or new
 * orders join the queue.
 */
export async function kitchenEstimates(nowMs = Date.now()): Promise<Map<string, TicketEstimate>> {
  const rows = await query<QueueRow>(
    `SELECT t.id, t.counter, t.status, t.qty, d.prep_minutes, t.preparing_at, ps.starts_at AS slot_starts_at, t.created_at
     FROM tickets t
     JOIN orders o ON o.id = t.order_id
     JOIN dishes d ON d.id = t.dish_id
     JOIN pickup_slots ps ON ps.id = o.slot_id
     WHERE t.status IN ('ISSUED', 'PREPARING', 'READY') AND o.status = 'PAID'`,
  );
  return estimateReadyTimes(
    rows.map((r) => ({
      id: r.id,
      counter: r.counter,
      status: r.status,
      qty: r.qty,
      prepMinutes: r.prep_minutes,
      preparingAt: r.preparing_at ? new Date(r.preparing_at).getTime() : null,
      slotStartsAt: new Date(r.slot_starts_at).getTime(),
      createdAt: new Date(r.created_at).getTime(),
    })),
    nowMs,
  );
}

export type CounterLoad = { counter: string; waiting: number; cooking: number; backlogMinutes: number };

/** How busy each counter is right now: tickets waiting/cooking and minutes until its queue clears. */
export function counterLoads(
  tickets: { id: string; counter: string; status: string }[],
  estimates: Map<string, TicketEstimate>,
  nowMs = Date.now(),
): CounterLoad[] {
  const loads = new Map<string, CounterLoad>();
  for (const t of tickets) {
    if (!loads.has(t.counter)) loads.set(t.counter, { counter: t.counter, waiting: 0, cooking: 0, backlogMinutes: 0 });
    const load = loads.get(t.counter)!;
    if (t.status === "ISSUED") load.waiting++;
    if (t.status === "PREPARING") load.cooking++;
    const est = estimates.get(t.id);
    if (est && t.status !== "READY") {
      load.backlogMinutes = Math.max(load.backlogMinutes, Math.ceil((est.readyAt - nowMs) / 60_000));
    }
  }
  return [...loads.values()].sort((a, b) => a.counter.localeCompare(b.counter));
}
