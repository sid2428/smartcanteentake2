import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/server/http";
import { queryOne } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { deriveTicketKey } from "@/lib/tickets/qr-code";
import { env } from "@/lib/server/env";

/** GET /api/tickets/[id]/key - get ticket signing key to generate local rotating QR offline/in-browser */
export const GET = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("student");
  const { id } = await params;

  const ticket = await queryOne<{ id: string; user_id: string; status: string; order_status: string; expires_at: string }>(
    `SELECT t.id, t.user_id, t.status, t.expires_at, o.status AS order_status
     FROM tickets t JOIN orders o ON o.id = t.order_id
     WHERE t.id = $1`,
    [id]
  );

  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }

  if (ticket.user_id !== session.uid) {
    throw new HttpError(403, "Access denied");
  }

  if (ticket.order_status !== "PAID" || !["ISSUED", "PREPARING", "READY"].includes(ticket.status)) {
    throw new HttpError(400, "This ticket is not eligible for a QR code", "TICKET_NOT_ELIGIBLE");
  }

  if (new Date(ticket.expires_at).getTime() <= Date.now()) {
    throw new HttpError(400, "This ticket has expired", "TICKET_EXPIRED");
  }

  const key = await deriveTicketKey(env.ticketSecret, ticket.id);
  return NextResponse.json(
    { ticketId: ticket.id, key, status: ticket.status },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
