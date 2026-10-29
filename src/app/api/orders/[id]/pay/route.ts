import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";
import { releaseUnpaidOrder } from "@/lib/server/sweeps";

const PaySchema = z.object({
  /** Demo only: lets you try the declined-payment path of the simulated UPI flow. */
  simulate: z.enum(["success", "declined"]).default("success"),
});

const STATUS_MESSAGE: Record<string, string> = {
  PAYMENT_FAILED: "This order was cancelled or its payment window ran out. Please place it again.",
  CLOSED: "This order is already closed.",
};

/** POST /api/orders/[id]/pay - simulate payment completion for an order */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("student", "staff", "owner");
  const { id } = await params;
  // Body is optional; an empty or non-JSON body means a normal (successful) payment.
  const raw = await request.json().catch(() => ({}));
  const { simulate } = PaySchema.parse(raw ?? {});

  const outcome = await withTransaction(async (tx) => {
    const order = await tx.queryOne<{
      id: string;
      user_id: string;
      slot_id: string;
      status: string;
      hold_expires_at: string;
    }>("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id]);

    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    if (session.role === "student" && order.user_id !== session.uid) {
      throw new HttpError(403, "Access denied");
    }

    // Paying twice (double tap, retry after a dropped response) is a no-op, not a second charge.
    if (order.status === "PAID" || order.status === "COMPLETED") {
      return { kind: "ok" as const, order };
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new HttpError(409, STATUS_MESSAGE[order.status] ?? `Cannot pay for order in status: ${order.status}`, "NOT_PAYABLE");
    }

    if (new Date(order.hold_expires_at).getTime() < Date.now()) {
      // Release the held stock and slot now rather than waiting for the next sweep, and
      // commit that, so the student immediately sees the order as expired.
      await releaseUnpaidOrder(tx, order);
      return { kind: "expired" as const };
    }

    if (simulate === "declined") {
      return { kind: "declined" as const };
    }

    // Mark order as paid
    const paid = await tx.queryOne(
      `UPDATE orders
       SET status = 'PAID', paid_at = now(), payment_method = 'UPI_MOCK', payment_ref = 'PAY_' || substr(md5(random()::text), 1, 10)
       WHERE id = $1 AND status = 'PENDING_PAYMENT'
       RETURNING *`,
      [id]
    );

    // Tickets associated with this order remain in ISSUED state (ready for kitchen to see & prepare)
    return { kind: "ok" as const, order: paid };
  });

  if (outcome.kind === "expired") {
    throw new HttpError(410, "The payment window for this order has closed, so it was cancelled. Please order again.", "HOLD_EXPIRED");
  }
  if (outcome.kind === "declined") {
    throw new HttpError(402, "Payment was declined. You haven't been charged. Please try again.", "PAYMENT_DECLINED");
  }

  return NextResponse.json({ order: outcome.order });
});
