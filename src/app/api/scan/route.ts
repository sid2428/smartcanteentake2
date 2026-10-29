import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody, HttpError } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { verifyQrPayload } from "@/lib/tickets/qr-code";
import { env } from "@/lib/server/env";

const ScanSchema = z.object({
  payload: z.string().min(1),
});

/** POST /api/scan - verify QR and redeem ticket */
export const POST = handle(async (request: Request) => {
  const session = await requireRole("staff", "owner");
  const { payload } = await parseBody(request, ScanSchema);

  // 1. Verify rotating signature & clock freshness
  const verification = await verifyQrPayload(env.ticketSecret, payload, Date.now());
  if (!verification.ok) {
    if (verification.reason === "STALE_CODE") {
      throw new HttpError(400, "QR code has expired. Please refresh the student app screen.", "STALE_CODE");
    }
    if (verification.reason === "BAD_SIGNATURE") {
      throw new HttpError(400, "Invalid QR code signature.", "BAD_SIGNATURE");
    }
    throw new HttpError(400, "Malformed QR code.", "MALFORMED");
  }

  const { ticketId } = verification;

  // 2. Database update in atomic transaction
  const redeemed = await withTransaction(async (tx) => {
    const ticket = await tx.queryOne<{
      id: string;
      order_id: string;
      dish_name: string;
      qty: number;
      counter: string;
      status: string;
      expires_at: string;
      order_status: string;
    }>(
      `SELECT t.*, o.status AS order_status
       FROM tickets t JOIN orders o ON o.id = t.order_id
       WHERE t.id = $1
       FOR UPDATE OF t`,
      [ticketId],
    );

    if (!ticket) {
      throw new HttpError(404, "Ticket not found");
    }

    if (ticket.order_status === "PENDING_PAYMENT" || ticket.order_status === "PAYMENT_FAILED") {
      throw new HttpError(400, "This order hasn't been paid for", "UNPAID");
    }

    if (ticket.status === "REDEEMED") {
      throw new HttpError(400, "Ticket has already been redeemed!", "ALREADY_REDEEMED");
    }

    if (ticket.status === "CANCELLED" || ticket.status === "EXPIRED") {
      throw new HttpError(400, `Cannot redeem ticket in ${ticket.status} status`, "INVALID_STATUS");
    }

    // Update ticket to REDEEMED
    const updated = await tx.queryOne(
      `UPDATE tickets
       SET status = 'REDEEMED', redeemed_at = now(), redeemed_by = $1
       WHERE id = $2
       RETURNING *`,
      [session.uid, ticketId]
    );

    // Audit log
    await tx.query(
      "INSERT INTO ticket_events (ticket_id, event, actor_id, detail) VALUES ($1, $2, $3, $4)",
      [ticketId, "REDEEMED_SCAN", session.uid, JSON.stringify({ scannedStep: verification.step })]
    );

    // Check if all tickets for this order are redeemed -> mark order COMPLETED
    const remaining = await tx.queryOne<{ count: string }>(
      "SELECT count(*) as count FROM tickets WHERE order_id = $1 AND status != 'REDEEMED'",
      [ticket.order_id]
    );

    if (remaining && parseInt(remaining.count, 10) === 0) {
      await tx.query("UPDATE orders SET status = 'COMPLETED' WHERE id = $1", [ticket.order_id]);
    }

    return updated;
  });

  return NextResponse.json({ ok: true, ticket: redeemed });
});
