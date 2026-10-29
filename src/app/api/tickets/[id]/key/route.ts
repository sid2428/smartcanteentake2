import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/server/http";
import { queryOne } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { deriveTicketKey } from "@/lib/tickets/qr-code";
import { env } from "@/lib/server/env";

/** GET /api/tickets/[id]/key - get ticket signing key to generate local rotating QR offline/in-browser */
export const GET = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("student", "staff", "owner");
  const { id } = await params;

  const ticket = await queryOne<{ id: string; user_id: string; status: string }>(
    "SELECT id, user_id, status FROM tickets WHERE id = $1",
    [id]
  );

  if (!ticket) {
    throw new HttpError(404, "Ticket not found");
  }

  if (session.role === "student" && ticket.user_id !== session.uid) {
    throw new HttpError(403, "Access denied");
  }

  const key = await deriveTicketKey(env.ticketSecret, ticket.id);
  return NextResponse.json({ ticketId: ticket.id, key, status: ticket.status });
});
