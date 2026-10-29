import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, HttpError } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { canKitchenMove, TicketStatus } from "@/lib/domain";

const AdvanceStatusSchema = z.object({
  status: z.enum(["PREPARING", "READY", "ISSUED"]),
});

/** PATCH /api/kitchen/tickets/[id] - advance kitchen status */
export const PATCH = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("staff", "owner");
  const { id } = await params;
  const body = await parseBody(request, AdvanceStatusSchema);

  const updated = await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{ id: string; status: TicketStatus; order_status: string }>(
      `SELECT t.id, t.status, o.status AS order_status
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE t.id = $1 FOR UPDATE OF t`,
      [id]
    );

    if (!ticket) {
      throw new HttpError(404, "Ticket not found");
    }

    // Only cook what has been paid for.
    if (ticket.order_status !== "PAID") {
      throw new HttpError(409, "This order isn't paid (or is already closed), so it can't be moved.", "ORDER_NOT_PAID");
    }

    // Two staff tapping the same button: the second tap is a no-op, not an error.
    if (ticket.status === body.status) {
      return tx.queryOne("SELECT * FROM tickets WHERE id = $1", [id]);
    }

    if (!canKitchenMove(ticket.status, body.status)) {
      throw new HttpError(409, `This ticket is now ${ticket.status.toLowerCase()} and can't move to ${body.status.toLowerCase()}.`, "BAD_TRANSITION");
    }

    let timestampCol = "";
    if (body.status === "PREPARING") timestampCol = ", preparing_at = now()";
    else if (body.status === "READY") timestampCol = ", ready_at = now()";

    const res = await tx.queryOne(
      `UPDATE tickets
       SET status = $1 ${timestampCol}
       WHERE id = $2
       RETURNING *`,
      [body.status, id]
    );

    // Record audit event
    await tx.query(
      "INSERT INTO ticket_events (ticket_id, event, actor_id, detail) VALUES ($1, $2, $3, $4)",
      [id, `KITCHEN_${body.status}`, session.uid, JSON.stringify({ from: ticket.status, to: body.status })]
    );

    return res;
  });

  return NextResponse.json({ ticket: updated });
});
