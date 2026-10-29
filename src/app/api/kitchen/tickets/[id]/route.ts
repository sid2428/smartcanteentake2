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
    const ticket = await tx.queryOne<{ id: string; status: TicketStatus }>(
      "SELECT id, status FROM tickets WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (!ticket) {
      throw new HttpError(404, "Ticket not found");
    }

    if (!canKitchenMove(ticket.status, body.status)) {
      throw new HttpError(400, `Cannot transition ticket from ${ticket.status} to ${body.status}`);
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
