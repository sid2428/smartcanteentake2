import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/server/http";
import { withTransaction } from "@/lib/server/db";
import { requireRole } from "@/lib/server/auth";

/** POST /api/orders/[id]/pay - simulate payment completion for an order */
export const POST = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireRole("student", "staff", "owner");
  const { id } = await params;

  const updatedOrder = await withTransaction(async (tx) => {
    const order = await tx.queryOne<{
      id: string;
      user_id: string;
      status: string;
      hold_expires_at: string;
    }>("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id]);

    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    if (session.role === "student" && order.user_id !== session.uid) {
      throw new HttpError(403, "Access denied");
    }

    if (order.status === "PAID" || order.status === "COMPLETED") {
      return order;
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new HttpError(400, `Cannot pay for order in status: ${order.status}`);
    }

    if (new Date(order.hold_expires_at).getTime() < Date.now()) {
      throw new HttpError(400, "Payment hold has expired for this order", "HOLD_EXPIRED");
    }

    // Mark order as paid
    const paid = await tx.queryOne(
      `UPDATE orders
       SET status = 'PAID', paid_at = now(), payment_method = 'UPI_MOCK', payment_ref = 'PAY_' || substr(md5(random()::text), 1, 10)
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // Tickets associated with this order remain in ISSUED state (ready for kitchen to see & prepare)
    return paid;
  });

  return NextResponse.json({ order: updatedOrder });
});
